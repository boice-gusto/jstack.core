import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import * as p from "@clack/prompts";
import {
  findPluginRoot,
  findProjectRoot,
  readConfig,
  readConfigOptional,
  writeConfig,
} from "../lib/config.js";
import { exitCancelled, handleCancel, isInteractive, nonInteractiveHint } from "../lib/cliUi.js";
import { discoverFromMcpJson, mergeMcpRegistry } from "../lib/mcp-discovery.js";
import { listPresetIds, resolvePreset } from "../lib/mcp-templates.js";
import type { McpRegistry } from "../types/mcp-registry.js";

interface McpFile {
  mcpServers?: Record<string, { command?: string; args?: string[]; url?: string; env?: Record<string, string> }>;
}

function mcpJsonPath(root: string): string {
  return join(root, ".mcp.json");
}

function readMcpFile(path: string): McpFile {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8")) as McpFile;
  } catch {
    return {};
  }
}

function writeMcpFile(path: string, data: McpFile): void {
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function syncRegistryFromDisk(root: string): void {
  const cfg = readConfigOptional(root);
  if (!cfg) return;
  const discovered = discoverFromMcpJson(root);
  writeConfig(root, { ...cfg, mcp_servers: mergeMcpRegistry(cfg.mcp_servers, discovered) });
}

export function runMcpList(): void {
  const cfg = readConfig(findProjectRoot());
  const reg = cfg.mcp_servers ?? {};
  console.log(chalk.bold("MCP registry"));
  for (const [id, s] of Object.entries(reg)) {
    console.log(`  ${s.status === "connected" ? "✔" : "○"} ${id}: ${s.label} (${s.tools.length} tools)`);
  }
}

export function runMcpRefresh(): void {
  const root = findProjectRoot();
  const cfg = readConfig(root);
  const discovered = discoverFromMcpJson(root);
  const merged = mergeMcpRegistry(cfg.mcp_servers ?? {}, discovered);
  writeConfig(root, { ...cfg, mcp_servers: merged });
  console.log(chalk.green(`Refreshed MCP registry (${Object.keys(merged).length} servers)`));
}

export function runMcpHealth(): void {
  runMcpList();
  console.log(chalk.dim("Deep health checks require live MCP — use your host's MCP panel."));
}

const MCP_ADD_HINTS: Record<string, string> = {
  github: "GitHub PR/issues (needs PAT)",
  notion: "Notion workspace",
  filesystem: "Local dirs as MCP roots",
  memory: "Ephemeral memory MCP",
  fetch: "HTTP fetch MCP",
  glean: "Glean search (instance + token)",
  gdrive: "Google Drive",
  "jstack-mock": "Local jstack MCP mock (fixtures)",
};

export async function runMcpAdd(serverIdMaybe?: string): Promise<void> {
  let id = serverIdMaybe?.trim().toLowerCase() ?? "";

  if (!id.length) {
    if (!isInteractive()) {
      console.error(chalk.red(`Usage: jstack mcp add <server>. ${nonInteractiveHint()}`));
      process.exit(1);
      return;
    }
    const ids = listPresetIds();
    const picked = await p.select<string>({
      message: "MCP preset to add",
      options: ids.map((sid) => ({
        value: sid,
        label: sid,
        hint: MCP_ADD_HINTS[sid],
      })),
    });
    if (handleCancel(picked)) exitCancelled();
    id = String(picked).trim().toLowerCase();
  }

  if (!id) {
    console.error(chalk.red("Usage: jstack mcp add <server>"));
    process.exit(1);
    return;
  }
  const root = findProjectRoot();
  const pluginRoot = findPluginRoot();
  const cfgOpt = readConfigOptional(root);
  const dbg = cfgOpt?.debug as Record<string, unknown> | undefined;
  const scenarioRaw =
    typeof dbg?.mock_mcp_scenario === "string" ? dbg.mock_mcp_scenario.trim() : "";
  const spec = resolvePreset(id, root, {
    pluginRoot,
    mockMcpScenario: scenarioRaw.length > 0 ? scenarioRaw : undefined,
  });
  if (!spec) {
    console.error(
      chalk.red(`Unknown server "${id}".`) +
        chalk.dim(` Try: ${listPresetIds().join(", ")}`),
    );
    process.exit(1);
  }

  const path = mcpJsonPath(root);
  const file = readMcpFile(path);
  const servers = { ...(file.mcpServers ?? {}) };
  if (servers[id]) {
    console.log(chalk.yellow(`"${id}" already exists in .mcp.json — not overwriting.`));
  } else {
    servers[id] = spec;
    writeMcpFile(path, { mcpServers: servers });
    console.log(chalk.green(`Added "${id}" to .mcp.json`));
    console.log(
      chalk.dim(
        "Set any required API tokens in your MCP host env or extend the server entry in .mcp.json.",
      ),
    );
  }

  syncRegistryFromDisk(root);
  if (!readConfigOptional(root)) {
    console.log(chalk.dim("No jstack.config.json yet — run jstack setup, then jstack mcp refresh."));
  }
}

export async function runMcpRemove(serverMaybe?: string): Promise<void> {
  let raw = serverMaybe?.trim() ?? "";
  const root = findProjectRoot();
  const path = mcpJsonPath(root);
  const file = readMcpFile(path);
  const servers = { ...(file.mcpServers ?? {}) };

  if (!raw.length) {
    if (!isInteractive()) {
      console.error(
        chalk.red(`Usage: jstack mcp remove <server>. ${nonInteractiveHint("`jstack mcp list`")}`),
      );
      process.exit(1);
      return;
    }
    const keys = Object.keys(servers);
    if (keys.length === 0) {
      console.log(chalk.yellow("No MCP servers in .mcp.json."));
      return;
    }
    const picked = await p.select<string>({
      message: "MCP server to remove",
      options: keys.map((k) => ({ value: k, label: k })),
    });
    if (handleCancel(picked)) exitCancelled();
    raw = String(picked);
  }

  const id = raw.toLowerCase();
  if (!id) {
    console.error(chalk.red("Usage: jstack mcp remove <server>"));
    process.exit(1);
    return;
  }
  const legacyKey = Object.keys(servers).find((k) => k.toLowerCase() === id);
  const key = legacyKey ?? id;
  if (!servers[key]) {
    console.log(chalk.yellow(`No server matching "${raw}" in .mcp.json`));
  } else {
    delete servers[key];
    writeMcpFile(path, { mcpServers: servers });
    console.log(chalk.green(`Removed "${key}" from .mcp.json`));
  }

  const cfg = readConfigOptional(root);
  if (cfg) {
    const reg: McpRegistry = { ...(cfg.mcp_servers ?? {}) };
    const regKey = Object.keys(reg).find((k) => k.toLowerCase() === id) ?? key;
    delete reg[regKey];
    writeConfig(root, { ...cfg, mcp_servers: reg });
    console.log(chalk.dim(`Dropped "${regKey}" from jstack.config.json mcp_servers`));
  }
}

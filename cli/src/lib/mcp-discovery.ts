import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { McpRegistry, McpServer } from "../types/mcp-registry.js";

interface McpFile {
  mcpServers?: Record<string, { command?: string; args?: string[]; url?: string }>;
}

/** Best-effort parse of .mcp.json without starting servers */
export function discoverFromMcpJson(projectRoot: string): McpRegistry {
  const p = join(projectRoot, ".mcp.json");
  if (!existsSync(p)) return {};
  let data: McpFile;
  try {
    data = JSON.parse(readFileSync(p, "utf8")) as McpFile;
  } catch {
    return {};
  }
  const servers = data.mcpServers ?? {};
  const registry: McpRegistry = {};
  for (const [id, spec] of Object.entries(servers)) {
    const server: McpServer = {
      label: humanize(id),
      description: spec.command
        ? `stdio MCP (${spec.command})`
        : spec.url
          ? `remote MCP (${spec.url})`
          : "MCP server",
      status: "connected",
      server_id: id,
      tools: [],
      used_by_skills: [],
      auto_discovered: true,
    };
    registry[id] = server;
  }
  return registry;
}

function humanize(id: string): string {
  return id
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export type McpMergeCollision = {
  serverId: string;
  resolution: "kept_existing" | "merged_fields" | "replaced";
  reason: string;
};

const BOILERPLATE_DESCRIPTION_RE =
  /^(?:stdio MCP \(.*\)|remote MCP \(.*\)|MCP server)$/;

export function mergeMcpRegistry(
  existing: McpRegistry | undefined,
  discovered: McpRegistry,
  opts?: { collisions?: McpMergeCollision[] },
): McpRegistry {
  const out: McpRegistry = { ...(existing ?? {}) };

  for (const [id, disc] of Object.entries(discovered)) {
    const prev = out[id];
    if (prev === undefined) {
      out[id] = disc;
      continue;
    }

    if (prev.auto_discovered === false) {
      // User-curated entry — preserve everything.
      opts?.collisions?.push({
        serverId: id,
        resolution: "kept_existing",
        reason: "user-curated entry preserved",
      });
      continue;
    }

    // Auto-discovered before; field-merge: refresh server_id, refresh
    // description only if the existing one was boilerplate, but preserve
    // user-touchable fields (label, used_by_skills, tools, configured_at).
    const description = BOILERPLATE_DESCRIPTION_RE.test(prev.description)
      ? disc.description
      : prev.description;

    out[id] = {
      ...prev,
      server_id: disc.server_id,
      description,
      label: prev.label,
      used_by_skills: prev.used_by_skills,
      tools: prev.tools,
      configured_at: prev.configured_at,
      auto_discovered: true,
    };

    opts?.collisions?.push({
      serverId: id,
      resolution: "merged_fields",
      reason: "kept user label/tools, refreshed server_id/description",
    });
  }

  return out;
}

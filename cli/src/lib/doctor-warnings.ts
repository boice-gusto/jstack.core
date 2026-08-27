import { existsSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import type { JstackConfig } from "../types/config.js";
import {
  isMockMcpServerEntry,
  mcpServerEnvString,
  readMcpServers,
} from "./mcp-file.js";
import { resolveMachineReadableSettings } from "./machine-readable.js";

export function gbrainTeamUrl(cfg: JstackConfig): string {
  return String(cfg.gbrain?.team?.url ?? "").trim();
}

export function gbrainPersonalUrl(cfg: JstackConfig): string {
  return String(cfg.gbrain?.personal?.url ?? "").trim();
}

export function sessionTarget(cfg: JstackConfig): string {
  return String(cfg.session?.default_gbrain_target ?? "team")
    .trim()
    .toLowerCase();
}

/** Config-shape warnings (knowledge_base roots, knowledge_storage, optional GBrain when merged search is on). */
export function collectDoctorConfigWarnings(
  projectRoot: string,
  cfg: JstackConfig,
  defaultsCfg?: JstackConfig,
): string[] {
  const warnings: string[] = [];
  const kb = cfg.knowledge_base;
  const roots = kb?.roots;
  if (Array.isArray(roots) && roots.length > 0) {
    for (const r of roots) {
      const rel = String(r).trim();
      if (!rel) continue;
      const abs = isAbsolute(rel) ? rel : resolve(projectRoot, rel);
      if (!existsSync(abs)) {
        warnings.push(
          `knowledge_base root missing on disk: ${rel} (resolved: ${abs}) — create it or fix jstack.config.json`,
        );
      }
    }
  }

  const ks = cfg.knowledge_storage;
  const ksTeam = ks?.team;
  const ksPersonal = ks?.personal;
  const ksTeamCo = String(ksTeam?.local_checkout ?? "").trim();
  const ksPersonalCo = String(ksPersonal?.local_checkout ?? "").trim();
  const ksTeamRem = String(ksTeam?.git_remote ?? "").trim();
  const ksPersonalRem = String(ksPersonal?.git_remote ?? "").trim();

  if (ksTeamRem && !ksTeamCo) {
    warnings.push(
      "knowledge_storage.team.git_remote is set but local_checkout is empty — clone the repo into a workspace-relative path and set local_checkout (then add it to knowledge_base.roots if needed).",
    );
  }
  if (ksPersonalRem && !ksPersonalCo) {
    warnings.push(
      "knowledge_storage.personal.git_remote is set but local_checkout is empty — clone your personal KB and set local_checkout.",
    );
  }

  for (const { rel, label } of [
    { rel: ksTeamCo, label: "knowledge_storage.team.local_checkout" },
    { rel: ksPersonalCo, label: "knowledge_storage.personal.local_checkout" },
  ]) {
    if (!rel) continue;
    const abs = isAbsolute(rel) ? rel : resolve(projectRoot, rel);
    if (!existsSync(abs)) {
      warnings.push(
        `${label} missing on disk: ${rel} (resolved: ${abs}) — clone/create or fix config.`,
      );
    }
  }

  const teamU = gbrainTeamUrl(cfg);
  const personalU = gbrainPersonalUrl(cfg);
  const kbGbrainInclude = kb?.gbrain?.include === true;
  if (kbGbrainInclude && !teamU && !personalU) {
    warnings.push(
      "knowledge_base.gbrain.include is true but neither gbrain.team.url nor gbrain.personal.url is set — set URLs or turn off gbrain.include.",
    );
  }

  const tgt = sessionTarget(cfg);
  if (kbGbrainInclude) {
    if (tgt === "team" && !teamU) {
      warnings.push(
        "session.default_gbrain_target is team and knowledge_base.gbrain.include is true but gbrain.team.url is empty.",
      );
    }
    if (tgt === "personal" && !personalU) {
      warnings.push(
        "session.default_gbrain_target is personal and knowledge_base.gbrain.include is true but gbrain.personal.url is empty.",
      );
    }
  }

  const pe = cfg.pe;
  if (pe && pe.configured === false) {
    warnings.push(
      "pe.configured is false — run `jstack setup --pe` or set pe.* in jstack.config.json before PE/team management reports.",
    );
  }

  const gb = cfg.cross_plugins?.gbrain;
  if (gb?.enabled === true) {
    const skills = gb.skills;
    if (!Array.isArray(skills) || skills.length === 0) {
      warnings.push(
        "cross_plugins.gbrain.enabled but skills[] is empty — list expected gbrain:* skill ids.",
      );
    }
  }

  const mr = resolveMachineReadableSettings(cfg, defaultsCfg);
  if (!mr.enabled) {
    warnings.push(
      "skills.machine_readable.enabled is false — automation (MCP wrappers, CI) must not auto-append --output=json|yaml; see skills/_core/references/output-formats.md.",
    );
  }
  if (mr.require_schema_ref) {
    warnings.push(
      "skills.machine_readable.require_schema_ref is true — JSON skill output should include a top-level $schema URI matching the skill schema $id.",
    );
  }

  return warnings;
}

function readMcpFixtureRootFromDisk(projectRoot: string): string | null {
  const servers = readMcpServers(projectRoot);
  if (!servers) return null;
  for (const [key, spec] of Object.entries(servers)) {
    if (!isMockMcpServerEntry(key, spec)) continue;
    const fromEnv = mcpServerEnvString(spec, "JSTACK_MCP_FIXTURE_ROOT");
    if (fromEnv) {
      return isAbsolute(fromEnv) ? fromEnv : resolve(projectRoot, fromEnv);
    }
  }
  return null;
}

/**
 * When `debug.mock_mcp` is true: warn if `.mcp.json` lacks the mock server entry and if the scenario fixture file is missing.
 */
export function collectMockMcpDoctorWarnings(
  projectRoot: string,
  pluginRoot: string,
  cfg: JstackConfig,
): string[] {
  const dbg = cfg.debug;
  if (dbg?.mock_mcp !== true) return [];

  const warnings: string[] = [];
  const scenarioRaw = String(dbg.mock_mcp_scenario ?? "").trim();
  const scenarioId = scenarioRaw.length > 0 ? scenarioRaw : "default";

  const mcpPath = join(projectRoot, ".mcp.json");
  if (!existsSync(mcpPath)) {
    warnings.push(
      "debug.mock_mcp is true but .mcp.json is missing — run `jstack mcp add jstack-mock` or merge the mock server entry.",
    );
    return warnings;
  }

  const fixtureRootFromMcp = readMcpFixtureRootFromDisk(projectRoot);
  const mockRoot = fixtureRootFromMcp ?? join(pluginRoot, "mcp-mock");
  const scenarioPath = join(mockRoot, "scenarios", scenarioId, "scenario.json");
  if (!existsSync(scenarioPath)) {
    warnings.push(
      `debug.mock_mcp is true but scenario file is missing: ${scenarioPath} — fix debug.mock_mcp_scenario, set JSTACK_MCP_FIXTURE_ROOT in .mcp.json (jstack-mock env), or add scenarios/${scenarioId}/scenario.json under the mock bundle.`,
    );
  }

  // We already know mcpPath exists (checked above), so a null result here means it failed to
  // parse, not that it's missing.
  const servers = readMcpServers(projectRoot);
  if (servers === null) {
    warnings.push(
      "debug.mock_mcp is true but .mcp.json could not be parsed — fix JSON.",
    );
    return warnings;
  }
  const hasMock = Object.entries(servers).some(([key, spec]) =>
    isMockMcpServerEntry(key, spec),
  );
  if (!hasMock) {
    warnings.push(
      "debug.mock_mcp is true but .mcp.json has no jstack-mock server (or path containing mcp-mock/server) — run `jstack mcp add jstack-mock`.",
    );
  }

  return warnings;
}

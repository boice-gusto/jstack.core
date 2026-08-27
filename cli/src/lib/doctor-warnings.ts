import { existsSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import type { JstackConfig } from "../types/config.js";
import {
  isMockMcpServerEntry,
  mcpServerEnvString,
  readMcpServers,
} from "./mcp-file.js";
import { resolveDependencies } from "./dependency-resolver.js";
import { resolveMachineReadableSettings } from "./machine-readable.js";

/**
 * `DependencyIssue` ids from `dependency-resolver.ts` this file's `collectDoctorConfigWarnings`
 * re-surfaces as plain warning strings on every `jstack doctor` run (not just `--fix`), instead
 * of re-running the same existsSync/absolutize checks a second time. Deliberately NOT every
 * dependency-resolver check: `gbrain-target-empty-url` only covers the *resolved session
 * target's* URL being empty, while this file's own (kept, not consolidated below) gbrain check
 * also warns when NEITHER team nor personal URL is set regardless of target -- a real coverage
 * difference, not just wording, so folding it in would silently drop that case. Likewise
 * `pe-configured-incomplete` (warns when `pe.configured` is true but its arrays are empty) is a
 * different condition from this file's own `pe.configured === false` check, not a duplicate of
 * it. Both are left as this file's own checks below, unconsolidated, until someone decides that
 * divergence is itself a bug worth fixing rather than two intentionally distinct diagnostics.
 */
const CONSOLIDATED_ISSUE_IDS = new Set([
  "kb-root-missing",
  "ks-team-checkout-missing",
  "ks-team-checkout-not-on-disk",
  "ks-personal-checkout-missing",
  "ks-personal-checkout-not-on-disk",
  "cross-plugins-gbrain-empty-skills",
]);

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
  for (const issue of resolveDependencies({ cfg, projectRoot })) {
    if (CONSOLIDATED_ISSUE_IDS.has(issue.id)) warnings.push(issue.message);
  }

  const kb = cfg.knowledge_base;
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

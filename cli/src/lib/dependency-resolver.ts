import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

/**
 * Pure dependency resolution for jstack config: given a parsed config object
 * and a project root path, return a list of structured DependencyIssue
 * describing missing or misaligned external dependencies, each with one or
 * more proposed RepairActions.
 *
 * This module is intentionally read-only on disk — it MUST NOT write files,
 * spawn shells, or make network calls. RepairActions describe the fixes a
 * caller could perform (or surface as suggestions); applying them is out of
 * scope here.
 */

export type RepairAction =
  | { kind: "mkdir"; path: string }
  | { kind: "write_file"; path: string; content: string; ifMissing: true }
  | { kind: "set_config"; path: string[]; value: unknown }
  | { kind: "shell_hint"; cmd: string; reason: string };

export type DependencyIssue = {
  /** Stable id for telemetry/grep, e.g. "kb-root-missing". */
  id: string;
  /** Dotted-path-as-array indicating the config field this issue relates to. */
  configPath: string[];
  severity: "error" | "warn";
  message: string;
  repairs: RepairAction[];
};

export type ResolverInput = {
  cfg: Record<string, unknown>;
  projectRoot: string;
  pluginRoot?: string;
};

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function absolutize(projectRoot: string, p: string): string {
  return isAbsolute(p) ? p : resolve(projectRoot, p);
}

function checkKnowledgeBaseRoots(input: ResolverInput, issues: DependencyIssue[]): void {
  const kb = asRecord(input.cfg.knowledge_base);
  const roots = kb?.roots;
  if (!Array.isArray(roots)) return;
  for (const r of roots) {
    const rel = asString(r);
    if (!rel) continue;
    const abs = absolutize(input.projectRoot, rel);
    if (!existsSync(abs)) {
      issues.push({
        id: "kb-root-missing",
        configPath: ["knowledge_base", "roots"],
        severity: "error",
        message: `knowledge_base root missing on disk: ${rel} (resolved: ${abs})`,
        repairs: [{ kind: "mkdir", path: abs }],
      });
    }
  }
}

function checkKnowledgeStorageSide(
  input: ResolverInput,
  side: "team" | "personal",
  issues: DependencyIssue[],
): void {
  const ks = asRecord(input.cfg.knowledge_storage);
  const node = asRecord(ks?.[side]);
  const remote = asString(node?.git_remote);
  const checkout = asString(node?.local_checkout);

  if (remote && !checkout) {
    issues.push({
      id: `ks-${side}-checkout-missing`,
      configPath: ["knowledge_storage", side, "local_checkout"],
      severity: "warn",
      message:
        `knowledge_storage.${side}.git_remote is set but local_checkout is empty — ` +
        `clone the repo and set local_checkout to its path.`,
      repairs: [
        {
          kind: "shell_hint",
          cmd: `git clone ${remote} <choose-path>`,
          reason: `${side} KB checkout`,
        },
      ],
    });
  }

  if (checkout) {
    const abs = absolutize(input.projectRoot, checkout);
    if (!existsSync(abs)) {
      const repairs: RepairAction[] = [{ kind: "mkdir", path: abs }];
      if (remote) {
        repairs.push({
          kind: "shell_hint",
          cmd: `git clone ${remote} ${abs}`,
          reason: "if you want to clone here",
        });
      }
      issues.push({
        id: `ks-${side}-checkout-not-on-disk`,
        configPath: ["knowledge_storage", side, "local_checkout"],
        severity: "error",
        message:
          `knowledge_storage.${side}.local_checkout missing on disk: ${checkout} (resolved: ${abs})`,
        repairs,
      });
    }
  }
}

function checkGbrainTargetUrl(input: ResolverInput, issues: DependencyIssue[]): void {
  const kb = asRecord(input.cfg.knowledge_base);
  const include = asRecord(kb?.gbrain)?.include === true;
  if (!include) return;

  const session = asRecord(input.cfg.session);
  const targetRaw = asString(session?.default_gbrain_target).toLowerCase();
  const target: "team" | "personal" | null =
    targetRaw === "team" ? "team" : targetRaw === "personal" ? "personal" : null;
  if (target === null) return;

  const gb = asRecord(input.cfg.gbrain);
  const url = asString(asRecord(gb?.[target])?.url);
  if (url) return;

  issues.push({
    id: "gbrain-target-empty-url",
    configPath: ["gbrain", target, "url"],
    severity: "warn",
    message:
      `knowledge_base.gbrain.include is true and session.default_gbrain_target is "${target}", ` +
      `but gbrain.${target}.url is empty.`,
    repairs: [
      { kind: "set_config", path: ["knowledge_base", "gbrain", "include"], value: false },
      {
        kind: "shell_hint",
        cmd: `edit jstack.config.json: set gbrain.${target}.url`,
        reason: "or provide the URL",
      },
    ],
  });
}

function checkMockMcp(input: ResolverInput, issues: DependencyIssue[]): void {
  const dbg = asRecord(input.cfg.debug);
  if (dbg?.mock_mcp !== true) return;

  const mcpPath = join(input.projectRoot, ".mcp.json");
  let hasMockEntry = false;

  if (existsSync(mcpPath)) {
    try {
      const raw = JSON.parse(readFileSync(mcpPath, "utf8")) as {
        mcpServers?: Record<string, { args?: unknown; command?: unknown }>;
      };
      const servers = raw?.mcpServers ?? {};
      hasMockEntry = Object.entries(servers).some(([key, spec]) => {
        if (key.toLowerCase() === "jstack-mock") return true;
        const args = Array.isArray(spec?.args) ? (spec.args as unknown[]) : [];
        return args.some((a) => String(a).includes("mcp-mock/server"));
      });
    } catch {
      hasMockEntry = false;
    }
  }

  if (!hasMockEntry) {
    issues.push({
      id: "mcp-mock-missing",
      configPath: ["debug", "mock_mcp"],
      severity: "warn",
      message:
        existsSync(mcpPath)
          ? "debug.mock_mcp is true but .mcp.json has no jstack-mock server entry."
          : "debug.mock_mcp is true but .mcp.json is missing.",
      repairs: [
        {
          kind: "shell_hint",
          cmd: "jstack mcp add jstack-mock",
          reason: "register the mock MCP server",
        },
      ],
    });
  }
}

function checkRequiredIntegrations(input: ResolverInput, issues: DependencyIssue[]): void {
  const onboarding = asRecord(input.cfg.onboarding);
  const required = onboarding?.required_integrations;
  if (!Array.isArray(required) || required.length === 0) return;

  const integrations = asRecord(input.cfg.integrations);

  for (const idRaw of required) {
    const id = asString(idRaw);
    if (!id) continue;
    const block = asRecord(integrations?.[id]);
    let hasNonEmptyString = false;
    if (block) {
      for (const v of Object.values(block)) {
        if (typeof v === "string" && v.length > 0) {
          hasNonEmptyString = true;
          break;
        }
      }
    }
    if (!hasNonEmptyString) {
      issues.push({
        id: "required-integrations-empty",
        configPath: ["integrations", id],
        severity: "warn",
        message: `onboarding.required_integrations lists "${id}" but integrations.${id} has no configured string values.`,
        repairs: [
          {
            kind: "shell_hint",
            cmd: "jstack setup --reconfigure",
            reason: "configure missing integration",
          },
        ],
      });
    }
  }
}

function checkCrossPluginsGbrain(input: ResolverInput, issues: DependencyIssue[]): void {
  const cross = asRecord(input.cfg.cross_plugins);
  const gb = asRecord(cross?.gbrain);
  if (gb?.enabled !== true) return;
  const skills = gb?.skills;
  if (Array.isArray(skills) && skills.length > 0) return;
  issues.push({
    id: "cross-plugins-gbrain-empty-skills",
    configPath: ["cross_plugins", "gbrain", "skills"],
    severity: "warn",
    message:
      "cross_plugins.gbrain.enabled is true but skills[] is empty — list expected gbrain:* skill ids or disable.",
    repairs: [{ kind: "set_config", path: ["cross_plugins", "gbrain", "enabled"], value: false }],
  });
}

/**
 * Resolve dependency issues for a given config + project root. Pure & read-only:
 * does not write files, run shells, or perform network I/O. Returns 0..N issues
 * in stable check order; callers may use `id` for telemetry/grouping.
 */
export function resolveDependencies(input: ResolverInput): DependencyIssue[] {
  const issues: DependencyIssue[] = [];
  checkKnowledgeBaseRoots(input, issues);
  checkKnowledgeStorageSide(input, "team", issues);
  checkKnowledgeStorageSide(input, "personal", issues);
  checkGbrainTargetUrl(input, issues);
  checkMockMcp(input, issues);
  checkRequiredIntegrations(input, issues);
  checkCrossPluginsGbrain(input, issues);
  return issues;
}

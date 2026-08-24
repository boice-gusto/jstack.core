import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import type { JstackConfig } from "../types/config.js";

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
  // `value?` (not `value:`) because it matches what repair-serializer.ts's Zod schema
  // actually enforces: z.unknown() validates successfully even when the key is entirely
  // absent, so a `set_config` repair with no `value` key already passes schema validation
  // today (verified). The hand-written type previously claimed `value` was required, which
  // was never true of the real validated behavior on the --apply-repairs untrusted-JSON path.
  | { kind: "set_config"; path: string[]; value?: unknown }
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
  cfg: JstackConfig;
  projectRoot: string;
  pluginRoot?: string;
};

/**
 * Narrow a possibly-untrusted value to a plain object record, or undefined.
 *
 * `cfg` is typed as `JstackConfig`, but callers may not have actually run it
 * through `JstackConfigSchema.parse()` before handing it here (see the casts
 * in doctor.ts / setup-schema.ts) — so a handful of checks that touch shapes
 * the schema doesn't fully pin down (arbitrary `mcp_servers[name]` payloads,
 * free-form `team.members` entries) still defend against genuinely malformed
 * data at runtime.
 */
function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;
}

/** Coerce a possibly-untrusted value to a trimmed string, defaulting to "". */
function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function absolutize(projectRoot: string, p: string): string {
  return isAbsolute(p) ? p : resolve(projectRoot, p);
}

function checkKnowledgeBaseRoots(
  input: ResolverInput,
  issues: DependencyIssue[],
): void {
  const roots = input.cfg.knowledge_base?.roots;
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
  const node = input.cfg.knowledge_storage?.[side];
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
        message: `knowledge_storage.${side}.local_checkout missing on disk: ${checkout} (resolved: ${abs})`,
        repairs,
      });
    }
  }
}

function checkGbrainTargetUrl(
  input: ResolverInput,
  issues: DependencyIssue[],
): void {
  if (input.cfg.knowledge_base?.gbrain?.include !== true) return;

  const targetRaw = asString(
    input.cfg.session?.default_gbrain_target,
  ).toLowerCase();
  const target: "team" | "personal" | null =
    targetRaw === "team"
      ? "team"
      : targetRaw === "personal"
        ? "personal"
        : null;
  if (target === null) return;

  const url = asString(input.cfg.gbrain?.[target]?.url);
  if (url) return;

  issues.push({
    id: "gbrain-target-empty-url",
    configPath: ["gbrain", target, "url"],
    severity: "warn",
    message:
      `knowledge_base.gbrain.include is true and session.default_gbrain_target is "${target}", ` +
      `but gbrain.${target}.url is empty.`,
    repairs: [
      {
        kind: "set_config",
        path: ["knowledge_base", "gbrain", "include"],
        value: false,
      },
      {
        kind: "shell_hint",
        cmd: `edit jstack.config.json: set gbrain.${target}.url`,
        reason: "or provide the URL",
      },
    ],
  });
}

/**
 * Reads `.mcp.json`'s `mcpServers` map, or `null` if the file is missing OR malformed --
 * checkMockMcp and checkMcpServerWiring below used to each independently read+parse this same
 * file, with two different (undocumented, apparently accidental rather than intentional)
 * fallback behaviors for malformed JSON: one still surfaced a warning, the other silently
 * skipped its entire check. Treating "missing" and "malformed" the same way for both callers
 * is the more correct, consistent behavior -- a real misconfiguration (a corrupt file that
 * also has genuinely unwired mcp_servers) is now caught instead of silently passing.
 */
function readMcpServersFile(
  projectRoot: string,
): Record<string, unknown> | null {
  const mcpPath = join(projectRoot, ".mcp.json");
  if (!existsSync(mcpPath)) return null;
  try {
    const raw = JSON.parse(readFileSync(mcpPath, "utf8")) as Record<
      string,
      unknown
    >;
    return asRecord(raw?.mcpServers) ?? {};
  } catch {
    return null;
  }
}

function checkMockMcp(input: ResolverInput, issues: DependencyIssue[]): void {
  if (input.cfg.debug?.mock_mcp !== true) return;

  const mcpPath = join(input.projectRoot, ".mcp.json");
  const servers = readMcpServersFile(input.projectRoot);
  let hasMockEntry = false;

  if (servers) {
    hasMockEntry = Object.entries(servers).some(([key, specRaw]) => {
      if (key.toLowerCase() === "jstack-mock") return true;
      const spec = asRecord(specRaw);
      const args = Array.isArray(spec?.args) ? (spec.args as unknown[]) : [];
      return args.some((a) => String(a).includes("mcp-mock/server"));
    });
  }

  if (!hasMockEntry) {
    issues.push({
      id: "mcp-mock-missing",
      configPath: ["debug", "mock_mcp"],
      severity: "warn",
      message:
        servers !== null
          ? "debug.mock_mcp is true but .mcp.json has no jstack-mock server entry."
          : existsSync(mcpPath)
            ? "debug.mock_mcp is true but .mcp.json is present but not valid JSON."
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

function checkRequiredIntegrations(
  input: ResolverInput,
  issues: DependencyIssue[],
): void {
  const required = input.cfg.onboarding?.required_integrations;
  if (!Array.isArray(required) || required.length === 0) return;

  // `integrations` only names the specific integrations the schema knows about (jira, slack,
  // ...); onboarding.required_integrations can list arbitrary ids beyond those, so this has to
  // be indexed as a loose record rather than through the typed IntegrationsSchema shape.
  const integrations = input.cfg.integrations as unknown as
    | Record<string, unknown>
    | undefined;

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

function checkNotionTemplateSet(
  input: ResolverInput,
  issues: DependencyIssue[],
): void {
  if (!input.pluginRoot) return;
  if (input.cfg.notion_defaults?.template_set !== "custom") return;
  const catalogPath = join(
    input.pluginRoot,
    "templates/notion/catalog/custom.json",
  );
  if (!existsSync(catalogPath)) {
    issues.push({
      id: "notion-template-set-custom-missing",
      configPath: ["notion_defaults", "template_set"],
      severity: "warn",
      message: `notion_defaults.template_set is "custom" but ${catalogPath} does not exist.`,
      repairs: [
        {
          kind: "write_file",
          path: catalogPath,
          content: '{"templates":[]}',
          ifMissing: true,
        },
      ],
    });
  }
}

function checkNotionParentPages(
  input: ResolverInput,
  issues: DependencyIssue[],
): void {
  const nd = input.cfg.notion_defaults;
  if (!nd) return;
  if (
    nd.team_notion?.setup_complete !== true &&
    nd.private_vault?.setup_complete !== true
  )
    return;
  const parentPages = nd.parent_pages;
  for (const key of ["team_hub", "private_root", "one_on_ones"] as const) {
    if (!asString(parentPages?.[key])) {
      issues.push({
        id: "notion-parent-pages-incomplete",
        configPath: ["notion_defaults", "parent_pages", key],
        severity: "warn",
        message: `notion_defaults.parent_pages.${key} is empty but Notion setup is marked complete.`,
        repairs: [
          {
            kind: "shell_hint",
            cmd: "jstack setup --schema --section notion",
            reason: "set parent page id",
          },
        ],
      });
    }
  }
}

function checkMcpServerWiring(
  input: ResolverInput,
  issues: DependencyIssue[],
): void {
  const mcpServers = input.cfg.mcp_servers;
  if (!mcpServers || Object.keys(mcpServers).length === 0) return;
  const registeredServers = readMcpServersFile(input.projectRoot);
  if (registeredServers === null) return;
  for (const [name, serverRaw] of Object.entries(mcpServers)) {
    // mcp_servers[name] is typed as a full McpServer, but this cfg may not have gone through
    // JstackConfigSchema.parse() at the call site — keep the defensive narrowing.
    const server = asRecord(serverRaw);
    const serverId = asString(server?.server_id);
    if (!serverId) continue;
    if (!(serverId in registeredServers)) {
      issues.push({
        id: "mcp-server-not-wired",
        configPath: ["mcp_servers", name, "server_id"],
        severity: "warn",
        message: `mcp_servers["${name}"] has server_id "${serverId}" but it is not registered in .mcp.json.`,
        repairs: [
          {
            kind: "shell_hint",
            cmd: `jstack mcp add ${serverId}`,
            reason: "register in .mcp.json",
          },
        ],
      });
    }
  }
}

function checkApprovalChainMembers(
  input: ResolverInput,
  issues: DependencyIssue[],
): void {
  const chains = input.cfg.approval_chains?.chains;
  if (!chains || Object.keys(chains).length === 0) return;
  const membersRaw = input.cfg.team?.members;
  if (!Array.isArray(membersRaw) || membersRaw.length === 0) return;
  const memberIds = new Set<string>();
  for (const m of membersRaw) {
    const id = asString(asRecord(m)?.id);
    if (id) memberIds.add(id);
  }
  if (memberIds.size === 0) return;
  for (const [chainName, chainRaw] of Object.entries(chains)) {
    // approval_chains.chains values are typed as string[], but this cfg may not have gone
    // through JstackConfigSchema.parse() at the call site — keep the defensive narrowing.
    if (!Array.isArray(chainRaw)) continue;
    for (const memberIdRaw of chainRaw) {
      const memberId = asString(memberIdRaw);
      if (!memberId || memberId === "author") continue;
      if (!memberIds.has(memberId)) {
        issues.push({
          id: "approval-chain-member-unknown",
          configPath: ["approval_chains", "chains", chainName],
          severity: "warn",
          message: `approval_chains.chains.${chainName} references unknown member id "${memberId}".`,
          repairs: [
            {
              kind: "shell_hint",
              cmd: "jstack setup --schema --section team",
              reason: "add member or fix chain",
            },
          ],
        });
      }
    }
  }
}

function checkPeConfigured(
  input: ResolverInput,
  issues: DependencyIssue[],
): void {
  const pe = input.cfg.pe;
  if (!pe || pe.configured !== true) return;
  for (const field of ["jira_project_keys", "notion_parent_keys"] as const) {
    const val = pe[field];
    if (!Array.isArray(val) || val.length === 0) {
      issues.push({
        id: "pe-configured-incomplete",
        configPath: ["pe", field],
        severity: "warn",
        message: `pe.configured is true but pe.${field} is empty.`,
        repairs: [
          {
            kind: "shell_hint",
            cmd: "jstack setup --pe",
            reason: "populate field",
          },
        ],
      });
    }
  }
}

function checkCrossPluginsGbrain(
  input: ResolverInput,
  issues: DependencyIssue[],
): void {
  const gb = input.cfg.cross_plugins?.gbrain;
  if (!gb || gb.enabled !== true) return;
  const skills = gb.skills;
  if (Array.isArray(skills) && skills.length > 0) return;
  issues.push({
    id: "cross-plugins-gbrain-empty-skills",
    configPath: ["cross_plugins", "gbrain", "skills"],
    severity: "warn",
    message:
      "cross_plugins.gbrain.enabled is true but skills[] is empty — list expected gbrain:* skill ids or disable.",
    repairs: [
      {
        kind: "set_config",
        path: ["cross_plugins", "gbrain", "enabled"],
        value: false,
      },
    ],
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
  checkNotionTemplateSet(input, issues);
  checkNotionParentPages(input, issues);
  checkMcpServerWiring(input, issues);
  checkApprovalChainMembers(input, issues);
  checkPeConfigured(input, issues);
  return issues;
}

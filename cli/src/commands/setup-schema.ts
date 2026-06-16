import * as p from "@clack/prompts";
import chalk from "chalk";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ENCODING_UTF8 } from "@jstack/constants/paths";
import { acquireSetupLock } from "../lib/setup-lock.js";
import {
  configPath,
  findPluginRoot,
  findProjectRoot,
  loadDefaults,
  mergeDeep,
  pruneSkipped,
  readConfigOptional,
  writeConfig,
} from "../lib/config.js";
import {
  type McpMergeCollision,
  discoverFromMcpJson,
  mergeMcpRegistry,
} from "../lib/mcp-discovery.js";
import { extractSetupSlices } from "../lib/setup-defaults-slices.js";
import {
  PROMPT_CANCELLED,
  type WizardOutcome,
  runSchemaWizard,
} from "../lib/schema-prompt.js";
import { QUESTION_CATALOG } from "../lib/schema-questions.js";
import { JstackConfigSchema } from "../types/config.js";
import { resolveDependencies } from "../lib/dependency-resolver.js";

export type SetupSchemaOpts = {
  reconfigure?: boolean;
  section?: string;
  nonInteractive?: boolean;
};

function writeRecoveryFile(
  projectRoot: string,
  payload: { decisions: Record<string, unknown>; patch: Record<string, unknown>; error: string },
): string {
  const dir = join(projectRoot, ".jstack");
  mkdirSync(dir, { recursive: true });
  const f = join(dir, "setup-recovery.json");
  writeFileSync(
    f,
    JSON.stringify({ written_at: new Date().toISOString(), ...payload }, null, 2) + "\n",
    ENCODING_UTF8,
  );
  return f;
}

function safeStringifyPatch(patch: Record<string, unknown>): Record<string, unknown> {
  // Strip SKIP_SENTINEL symbols so the recovery file is plain JSON.
  return JSON.parse(JSON.stringify(patch, (_k, v) => (typeof v === "symbol" ? "__SKIP__" : v))) as Record<string, unknown>;
}

/**
 * Schema-driven setup wizard. Iterates over QUESTION_CATALOG and presents
 * Default/Custom/Skip/Example/Discuss for each question. Skip writes the
 * SKIP_SENTINEL so pruneSkipped + mergeDeep omit the key from the saved
 * config (rather than persisting an empty string).
 *
 * Layering order: defaults -> existing config -> wizard patch. Re-running the
 * wizard never silently loses existing customizations (B3 fix).
 *
 * Cancellation at any prompt: writes nothing, exits 130, prints a clean note
 * (B4 fix). Validation failure: writes raw decisions to .jstack/setup-recovery.json.
 */
export async function runSetupSchema(opts: SetupSchemaOpts): Promise<void> {
  p.intro(chalk.bold("jstack setup --schema — schema-driven wizard"));
  p.log.info(
    chalk.dim(
      "~60 seconds on Defaults · Ctrl+C anytime cancels with no writes · pick Discuss on any question for tradeoff text.",
    ),
  );

  const projectRootEarly = findProjectRoot();
  const lock = acquireSetupLock(projectRootEarly, "jstack setup --schema");
  if (!lock.ok) {
    p.cancel(
      `Another setup is already running (pid ${lock.existing.pid}, started ${lock.existing.started_at}). ` +
        `If that process is gone, delete .jstack/setup.lock and re-run.`,
    );
    process.exitCode = 1;
    return;
  }
  if (lock.stoleStale) {
    p.log.warn(
      `Stole a stale lockfile (pid ${lock.stoleStale.pid}, started ${lock.stoleStale.started_at}). Continuing.`,
    );
  }
  try {
    await runSetupSchemaInner(opts);
  } finally {
    lock.release();
  }
}

async function runSetupSchemaInner(opts: SetupSchemaOpts): Promise<void> {

  const projectRoot = findProjectRoot();
  const pluginRoot = findPluginRoot();
  const cfgPath = configPath(projectRoot);

  const existing = (readConfigOptional(projectRoot) as unknown as Record<string, unknown> | null) ?? {};
  if (existsSync(cfgPath) && !opts.reconfigure && !opts.nonInteractive) {
    const go = await p.confirm({
      message: `Config exists at ${cfgPath}. Re-run the wizard? (existing values become defaults; nothing is lost unless you pick Skip or Custom)`,
      initialValue: false,
    });
    if (p.isCancel(go) || !go) {
      p.outro("No changes.");
      return;
    }
  }

  const defaults = loadDefaults(pluginRoot);

  const result = await runSchemaWizard(QUESTION_CATALOG, {
    defaults,
    existing,
    sectionFilter: opts.section,
    nonInteractive: opts.nonInteractive,
  });

  if (result === PROMPT_CANCELLED) {
    p.cancel("Cancelled. No config changes.");
    process.exitCode = 130;
    return;
  }

  const outcome: WizardOutcome = result;

  // Layered draft: defaults -> existing -> wizard patch.
  // mergeDeep handles SKIP_SENTINEL by deleting the key.
  let draft: Record<string, unknown> = mergeDeep(defaults as Record<string, unknown>, existing);
  draft = mergeDeep(draft, outcome.patch);

  // MCP discovery + merge (B1 fix: collisions reported, user-curated entries preserved).
  const discovered = discoverFromMcpJson(projectRoot);
  const slices = extractSetupSlices(defaults);
  const collisions: McpMergeCollision[] = [];
  const merged = mergeMcpRegistry(slices.mcpExisting, discovered, { collisions });
  draft.mcp_servers = merged;
  for (const c of collisions) {
    p.log.warn(`MCP merge ${c.serverId}: ${c.resolution} — ${c.reason}`);
  }

  // Strip any surviving sentinels before validation/write.
  const cleaned = pruneSkipped(draft) as Record<string, unknown>;

  // Show diff summary before writing.
  const decisionCounts = countDecisions(outcome.decisions);
  p.log.step(
    `Answers: ${decisionCounts.default} default, ${decisionCounts.custom} custom, ${decisionCounts.skip} skipped (out of ${Object.keys(outcome.decisions).length})`,
  );

  if (!opts.nonInteractive) {
    const ok = await p.confirm({
      message: `Write ${cfgPath}?`,
      initialValue: true,
    });
    if (p.isCancel(ok) || !ok) {
      p.cancel("Cancelled before write. No config changes.");
      process.exitCode = 130;
      return;
    }
  }

  let parsed;
  try {
    parsed = JstackConfigSchema.parse(cleaned);
  } catch (err) {
    const recovery = writeRecoveryFile(projectRoot, {
      decisions: outcome.decisions,
      patch: safeStringifyPatch(outcome.patch),
      error: err instanceof Error ? err.message : String(err),
    });
    p.cancel(
      `Validation failed — saved your answers to ${recovery}. Re-run the wizard or edit jstack.config.json by hand.`,
    );
    process.exitCode = 1;
    return;
  }

  mkdirSync(dirname(cfgPath), { recursive: true });
  writeConfig(projectRoot, parsed);

  // Recovery file lifecycle: a successful write supersedes any prior recovery file.
  const recoveryPath = join(projectRoot, ".jstack", "setup-recovery.json");
  if (existsSync(recoveryPath)) {
    try {
      unlinkSync(recoveryPath);
    } catch {
      // Best-effort; not critical if this fails.
    }
  }

  // Run the dependency resolver and surface issues so the user knows what's
  // still missing on disk / in their environment.
  const issues = resolveDependencies({ cfg: parsed as Record<string, unknown>, projectRoot, pluginRoot });
  if (issues.length === 0) {
    p.outro(chalk.green(`Wrote ${cfgPath} — no dependency issues. Next: 'jstack doctor' anytime to re-check.`));
    return;
  }
  p.log.step(
    chalk.yellow(
      `${issues.length} dependency issue(s) detected. Next step: \`jstack doctor --fix\` (dry-run) then \`jstack doctor --fix --apply\`.`,
    ),
  );
  for (const i of issues.slice(0, 5)) {
    p.log.warn(`${i.severity === "error" ? "✗" : "⚠"} ${i.id}: ${i.message}`);
  }
  if (issues.length > 5) {
    p.log.info(chalk.dim(`(${issues.length - 5} more — see jstack doctor --fix)`));
  }
  p.outro(chalk.green(`Wrote ${cfgPath}`));
}

function countDecisions(d: Record<string, "default" | "custom" | "skip">): {
  default: number;
  custom: number;
  skip: number;
} {
  const out = { default: 0, custom: 0, skip: 0 };
  for (const v of Object.values(d)) out[v]++;
  return out;
}

import chalk from "chalk";
import * as p from "@clack/prompts";
import {
  findPluginRoot,
  findProjectRoot,
  readConfig,
  writeConfig,
} from "../lib/config.js";
import {
  exitCancelled,
  handleCancel,
  isInteractive,
  nonInteractiveHint,
} from "../lib/cliUi.js";
import { runClaude } from "../lib/crew/slack.js";
import {
  appendRunHistory,
  buildRoutineRunPrompt,
  computeNextFire,
  cronFromPreset,
  describeCron,
  isValidRoutineId,
  listRoutinesFromConfig,
  loadSkillSlugs,
  loadWellKnownRoutine,
  patchRoutine,
  readRunHistory,
  splitChainInput,
  validateChain,
  wellKnownRoutineIds,
  type CronPresetKey,
  type RoutineRow,
  type ScheduleRunRecord,
} from "../lib/scheduler.js";

/** `claude -p` is not expected to finish a multi-skill chain instantly; generous but bounded. */
const RUN_TIMEOUT_MS = 15 * 60 * 1000;

async function pickRoutineId(
  rows: RoutineRow[],
  message: string,
): Promise<string | null> {
  if (rows.length === 0) {
    console.error(
      chalk.yellow("No routines configured yet. ") +
        chalk.dim("Add one with: jstack schedule setup <id>"),
    );
    return null;
  }
  const picked = await p.select<string>({
    message,
    options: rows.map((r) => ({
      value: r.id,
      label: r.id,
      hint: `${r.enabled ? "on" : "off"} · ${r.cron || "no cron"} · ${r.chain.join(", ") || "-"}`,
    })),
  });
  if (handleCancel(picked)) exitCancelled();
  return String(picked);
}

export function runScheduleList(): void {
  const cfg = readConfig(findProjectRoot());
  const rows = listRoutinesFromConfig(cfg);
  console.log(chalk.bold("Routines"));
  for (const r of rows) {
    console.log(
      `  ${r.enabled ? "●" : "○"} ${r.id.padEnd(16)} ${r.cron || "-"}  → ${r.chain.join(", ")}`,
    );
  }
}

async function setRoutineEnabled(
  idMaybe: string | undefined,
  enabled: boolean,
  labels: { verb: string; picker: string; past: string },
): Promise<void> {
  const root = findProjectRoot();
  const cfg = readConfig(root);
  const rows = listRoutinesFromConfig(cfg);
  let id = idMaybe?.trim() ?? "";

  if (!id.length) {
    if (!isInteractive()) {
      console.error(
        chalk.red(`Usage: jstack schedule ${labels.verb} <id>. `) +
          chalk.dim(nonInteractiveHint("`jstack schedule list`")),
      );
      process.exitCode = 1;
      return;
    }
    const picked = await pickRoutineId(rows, labels.picker);
    if (picked === null) {
      process.exitCode = 1;
      return;
    }
    id = picked;
  }

  if (!listRoutinesFromConfig(cfg).some((r) => r.id === id)) {
    console.error(`Unknown routine: ${id}`);
    process.exitCode = 1;
    return;
  }
  writeConfig(root, patchRoutine(cfg, id, { enabled }));
  console.log(chalk.green(`${labels.past} ${id}`));
}

export async function runScheduleEnable(idMaybe?: string): Promise<void> {
  return setRoutineEnabled(idMaybe, true, {
    verb: "enable",
    picker: "Routine to enable",
    past: "Enabled",
  });
}

export async function runScheduleDisable(idMaybe?: string): Promise<void> {
  return setRoutineEnabled(idMaybe, false, {
    verb: "disable",
    picker: "Routine to disable",
    past: "Disabled",
  });
}

/**
 * `start`/`stop` are the new primary, clearer-named verbs for the exact same operation
 * `enable`/`disable` perform (see `setRoutineEnabled` above, which both pairs call) --
 * `enable`/`disable` are kept registered in `cli/src/index.ts` for backward compatibility.
 */
export async function runScheduleStart(idMaybe?: string): Promise<void> {
  return setRoutineEnabled(idMaybe, true, {
    verb: "start",
    picker: "Routine to start",
    past: "Started",
  });
}

export async function runScheduleStop(idMaybe?: string): Promise<void> {
  return setRoutineEnabled(idMaybe, false, {
    verb: "stop",
    picker: "Routine to stop",
    past: "Stopped",
  });
}

/* ---------------------------------------------------------------- shared prompt helpers ---- */

/**
 * Ask for a cron schedule via the preset-or-custom flow shared by `setup` and `config`.
 * `allowKeep` adds a "keep current" option, meaningful only when editing an existing routine.
 */
async function promptCronChoice(
  currentCron: string,
  allowKeep: boolean,
): Promise<string> {
  const options: Array<{ value: string; label: string; hint?: string }> = [
    {
      value: "weekday_9am",
      label: "Every weekday morning (9am)",
      hint: "0 9 * * 1-5",
    },
    {
      value: "friday_4pm",
      label: "Every Friday afternoon (4pm)",
      hint: "0 16 * * 5",
    },
    { value: "every_n_hours", label: "Every N hours" },
    { value: "custom", label: "Custom cron expression" },
  ];
  if (allowKeep) {
    options.unshift({
      value: "keep",
      label: `Keep current (${describeCron(currentCron)})`,
    });
  }

  for (;;) {
    const choice = await p.select<string>({ message: "Cadence", options });
    if (handleCancel(choice)) exitCancelled();
    if (choice === "keep") return currentCron;

    if (choice === "every_n_hours") {
      const hours = await p.text({
        message: "Every how many hours? (1-23)",
        initialValue: "4",
      });
      if (handleCancel(hours)) exitCancelled();
      const r = cronFromPreset("every_n_hours", String(hours));
      if (!r.ok) {
        console.error(chalk.red(r.error));
        continue;
      }
      return r.cron;
    }

    if (choice === "custom") {
      const expr = await p.text({
        message:
          "Cron expression (5 fields: minute hour day-of-month month day-of-week)",
        initialValue: currentCron,
      });
      if (handleCancel(expr)) exitCancelled();
      const r = cronFromPreset("custom", String(expr));
      if (!r.ok) {
        console.error(chalk.red(r.error));
        continue;
      }
      return r.cron;
    }

    const r = cronFromPreset(choice as CronPresetKey);
    if (r.ok) return r.cron;
    console.error(chalk.red(r.error));
  }
}

/** Ask for a chain of skill slugs, re-prompting until every slug resolves in `skill-catalog.json`. */
async function promptChain(
  pluginRoot: string,
  current: string[],
): Promise<string[]> {
  const catalog = loadSkillSlugs(pluginRoot);
  for (;;) {
    const raw = await p.text({
      message: "Chain: skill slugs in order (comma or space separated)",
      initialValue: current.join(", "),
      validate: (v) =>
        v.trim().length > 0 ? undefined : "at least one skill slug is required",
    });
    if (handleCancel(raw)) exitCancelled();
    const chain = splitChainInput(String(raw));
    const result = validateChain(chain, catalog);
    if (result.ok) return chain;
    console.error(
      chalk.red(
        `Unknown skill slug(s): ${result.invalid.join(", ")}. Check skill-catalog.json for real slugs.`,
      ),
    );
  }
}

/**
 * Resolve --enable/--disable/interactive-confirm into a final `enabled` value, shared by both
 * branches of `runScheduleSetup` (known routine and new custom routine) -- previously two
 * byte-identical 22-line copies of this exact resolution. Returns `null` after already printing
 * the error and setting `process.exitCode = 1`; the caller should `return` immediately in that case.
 */
async function resolveEnabledFlag(
  opts: { enable?: boolean; disable?: boolean },
  interactive: boolean,
): Promise<boolean | null> {
  if (opts.enable && opts.disable) {
    console.error(chalk.red("Pass only one of --enable / --disable."));
    process.exitCode = 1;
    return null;
  }
  if (opts.enable !== undefined || opts.disable !== undefined) {
    return !!opts.enable;
  }
  if (interactive) {
    const en = await p.confirm({ message: "Enable now?", initialValue: false });
    if (handleCancel(en)) exitCancelled();
    return Boolean(en);
  }
  console.error(
    chalk.red("Non-interactive: pass --enable or --disable. ") +
      chalk.dim(nonInteractiveHint("--enable/--disable")),
  );
  process.exitCode = 1;
  return null;
}

function printRoutineConfirmation(row: {
  id: string;
  cron: string;
  chain: string[];
  enabled: boolean;
}): void {
  console.log(chalk.bold(row.id));
  console.log(
    `  cron:    ${row.cron || "(none)"}  (${describeCron(row.cron)})`,
  );
  console.log(`  chain:   ${row.chain.join(", ") || "(none)"}`);
  console.log(`  enabled: ${row.enabled}`);
}

/* ---------------------------------------------------------------- setup ---- */

export interface ScheduleSetupOpts {
  cron?: string;
  chain?: string;
  enable?: boolean;
  disable?: boolean;
  yes?: boolean;
}

export async function runScheduleSetup(
  idMaybe: string | undefined,
  opts: ScheduleSetupOpts = {},
): Promise<void> {
  const root = findProjectRoot();
  const pluginRoot = findPluginRoot();
  const cfg = readConfig(root);
  const routines = {
    ...(cfg.routines as Record<string, Record<string, unknown>> | undefined),
  };

  const interactive = isInteractive();
  const requestedId = idMaybe?.trim() ?? "";
  const known = requestedId
    ? loadWellKnownRoutine(pluginRoot, requestedId)
    : null;

  let id: string;
  let cron: string;
  let chain: string[];
  let enabled: boolean;

  if (known) {
    id = known.id;
    console.log(
      chalk.bold(`${known.displayName ?? known.id}`) +
        (known.description ? chalk.dim(` — ${known.description}`) : ""),
    );
    console.log(
      `  default cron:  ${known.cron || "(none)"}  (${describeCron(known.cron)})`,
    );
    console.log(`  chain (fixed): ${known.chain.join(", ") || "(none)"}`);
    chain = known.chain;
    if (opts.chain) {
      console.log(
        chalk.dim(
          `Ignoring --chain: "${known.id}" is a well-known routine, and its chain is fixed by definition.`,
        ),
      );
    }

    if (opts.cron) {
      const r = cronFromPreset("custom", opts.cron);
      if (!r.ok) {
        console.error(chalk.red(r.error));
        process.exitCode = 1;
        return;
      }
      cron = r.cron;
    } else if (opts.yes) {
      cron = known.cron;
    } else if (interactive) {
      const acceptDefault = await p.confirm({
        message: `Accept the default cadence (${describeCron(known.cron)})?`,
        initialValue: true,
      });
      if (handleCancel(acceptDefault)) exitCancelled();
      cron = acceptDefault
        ? known.cron
        : await promptCronChoice(known.cron, false);
    } else {
      console.error(
        chalk.red(
          `Non-interactive: pass --yes to accept the default cadence, or --cron <expr>. `,
        ) + chalk.dim(nonInteractiveHint("--yes / --cron")),
      );
      process.exitCode = 1;
      return;
    }

    const resolvedEnabled = await resolveEnabledFlag(opts, interactive);
    if (resolvedEnabled === null) return;
    enabled = resolvedEnabled;
  } else {
    // New custom routine.
    if (requestedId) {
      if (!isValidRoutineId(requestedId)) {
        console.error(
          chalk.red(
            `"${requestedId}" is not a valid routine id (must match ^[a-z][a-z0-9_-]*$).`,
          ),
        );
        process.exitCode = 1;
        return;
      }
      if (routines[requestedId]) {
        console.error(
          chalk.red(
            `Routine "${requestedId}" already exists. Use: jstack schedule config ${requestedId}`,
          ),
        );
        process.exitCode = 1;
        return;
      }
      id = requestedId;
    } else if (interactive) {
      for (;;) {
        const raw = await p.text({
          message: "New routine id (kebab-case, e.g. my-new-routine)",
        });
        if (handleCancel(raw)) exitCancelled();
        const candidate = String(raw).trim();
        if (!isValidRoutineId(candidate)) {
          console.error(
            chalk.red(
              `"${candidate}" is not a valid routine id (must match ^[a-z][a-z0-9_-]*$).`,
            ),
          );
          continue;
        }
        if (routines[candidate]) {
          console.error(chalk.red(`Routine "${candidate}" already exists.`));
          continue;
        }
        id = candidate;
        break;
      }
    } else {
      console.error(
        chalk.red(
          "Usage: jstack schedule setup <id> (new custom routine id required). ",
        ) + chalk.dim(nonInteractiveHint("`jstack schedule setup <id>`")),
      );
      process.exitCode = 1;
      return;
    }

    if (opts.chain) {
      const proposed = splitChainInput(opts.chain);
      const result = validateChain(proposed, loadSkillSlugs(pluginRoot));
      if (!result.ok) {
        console.error(
          chalk.red(`Unknown skill slug(s): ${result.invalid.join(", ")}.`),
        );
        process.exitCode = 1;
        return;
      }
      chain = proposed;
    } else if (interactive) {
      chain = await promptChain(pluginRoot, []);
    } else {
      console.error(
        chalk.red("Non-interactive: pass --chain <slug1,slug2,...>. ") +
          chalk.dim(nonInteractiveHint("--chain")),
      );
      process.exitCode = 1;
      return;
    }

    if (opts.cron) {
      const r = cronFromPreset("custom", opts.cron);
      if (!r.ok) {
        console.error(chalk.red(r.error));
        process.exitCode = 1;
        return;
      }
      cron = r.cron;
    } else if (interactive) {
      cron = await promptCronChoice("", false);
    } else {
      console.error(
        chalk.red("Non-interactive: pass --cron <expr>. ") +
          chalk.dim(nonInteractiveHint("--cron")),
      );
      process.exitCode = 1;
      return;
    }

    const resolvedEnabled = await resolveEnabledFlag(opts, interactive);
    if (resolvedEnabled === null) return;
    enabled = resolvedEnabled;
  }

  writeConfig(
    root,
    patchRoutine(cfg, id, { enabled, cron, chain }, "overwrite"),
  );
  console.log(chalk.green(`Saved routine ${id}`));
  printRoutineConfirmation({ id, cron, chain, enabled });
}

/* ---------------------------------------------------------------- config ---- */

export interface ScheduleConfigOpts {
  setCron?: string;
  setChain?: string;
  json?: boolean;
}

function renderRoutineDetail(root: string, row: RoutineRow): string {
  const history = readRunHistory(root, row.id);
  const last = history[history.length - 1];
  const lastRun = last
    ? `${last.timestamp} — ${last.exitOk ? "completed without error" : "failed"} (${Math.round(last.durationMs / 1000)}s)`
    : "never run via `jstack schedule run`";
  return (
    `${row.enabled ? "●" : "○"} ${row.id}\n` +
    `    cron:    ${row.cron || "(none)"}  (${describeCron(row.cron)})\n` +
    `    chain:   ${row.chain.join(", ") || "(none)"}\n` +
    `    enabled: ${row.enabled}\n` +
    `    last run: ${lastRun}`
  );
}

export async function runScheduleConfig(
  idMaybe: string | undefined,
  opts: ScheduleConfigOpts = {},
): Promise<void> {
  const root = findProjectRoot();
  const pluginRoot = findPluginRoot();
  const cfg = readConfig(root);
  const rows = listRoutinesFromConfig(cfg);

  const id = idMaybe?.trim() ?? "";

  if (!id.length) {
    if (opts.json) {
      console.log(
        JSON.stringify(
          rows.map((r) => ({ ...r, history: readRunHistory(root, r.id) })),
          null,
          2,
        ),
      );
      return;
    }
    console.log(chalk.bold(`Routines (${rows.length})`));
    for (const r of rows) console.log(renderRoutineDetail(root, r));
    return;
  }

  const row = rows.find((r) => r.id === id);
  if (!row) {
    console.error(
      chalk.red(`Unknown routine: ${id}. `) +
        chalk.dim(`Create it with: jstack schedule setup ${id}`),
    );
    process.exitCode = 1;
    return;
  }

  if (opts.setCron !== undefined || opts.setChain !== undefined) {
    let nextCron = row.cron;
    let nextChain = row.chain;

    if (opts.setCron !== undefined) {
      const r = cronFromPreset("custom", opts.setCron);
      if (!r.ok) {
        console.error(chalk.red(r.error));
        process.exitCode = 1;
        return;
      }
      nextCron = r.cron;
    }
    if (opts.setChain !== undefined) {
      const proposed = splitChainInput(opts.setChain);
      const result = validateChain(proposed, loadSkillSlugs(pluginRoot));
      if (!result.ok) {
        console.error(
          chalk.red(`Unknown skill slug(s): ${result.invalid.join(", ")}.`),
        );
        process.exitCode = 1;
        return;
      }
      nextChain = proposed;
    }

    writeConfig(
      root,
      patchRoutine(cfg, id, { cron: nextCron, chain: nextChain }),
    );
    console.log(chalk.green(`Updated routine ${id}`));
    printRoutineConfirmation({
      id,
      cron: nextCron,
      chain: nextChain,
      enabled: row.enabled,
    });
    return;
  }

  if (opts.json) {
    console.log(
      JSON.stringify({ ...row, history: readRunHistory(root, id) }, null, 2),
    );
    return;
  }

  console.log(renderRoutineDetail(root, row));

  if (!isInteractive()) return;

  const wantEdit = await p.confirm({
    message: "Edit this routine's cron or chain now?",
    initialValue: false,
  });
  if (handleCancel(wantEdit)) exitCancelled();
  if (!wantEdit) return;

  const field = await p.select<string>({
    message: "What to edit?",
    options: [
      { value: "cron", label: "Cron schedule" },
      { value: "chain", label: "Chain" },
      { value: "both", label: "Both" },
    ],
  });
  if (handleCancel(field)) exitCancelled();

  let nextCron = row.cron;
  let nextChain = row.chain;
  if (field === "cron" || field === "both") {
    nextCron = await promptCronChoice(row.cron, true);
  }
  if (field === "chain" || field === "both") {
    nextChain = await promptChain(pluginRoot, row.chain);
  }

  writeConfig(
    root,
    patchRoutine(cfg, id, { cron: nextCron, chain: nextChain }),
  );
  console.log(chalk.green(`Updated routine ${id}`));
  printRoutineConfirmation({
    id,
    cron: nextCron,
    chain: nextChain,
    enabled: row.enabled,
  });
}

/* ---------------------------------------------------------------- run ---- */

export interface ScheduleRunOpts {
  dryRun?: boolean;
  json?: boolean;
}

export async function runScheduleRun(
  idMaybe: string | undefined,
  opts: ScheduleRunOpts = {},
): Promise<void> {
  const root = findProjectRoot();
  const cfg = readConfig(root);
  const rows = listRoutinesFromConfig(cfg);

  let id = idMaybe?.trim() ?? "";
  if (!id.length) {
    if (!isInteractive()) {
      console.error(
        chalk.red("Usage: jstack schedule run <id>. ") +
          chalk.dim(nonInteractiveHint("`jstack schedule list`")),
      );
      process.exitCode = 1;
      return;
    }
    const picked = await pickRoutineId(rows, "Routine to run");
    if (picked === null) {
      process.exitCode = 1;
      return;
    }
    id = picked;
  }

  const row = rows.find((r) => r.id === id);
  if (!row) {
    console.error(
      chalk.red(`Unknown routine: ${id}. `) +
        chalk.dim(`Create it with: jstack schedule setup ${id}`),
    );
    process.exitCode = 1;
    return;
  }
  if (row.chain.length === 0) {
    console.error(
      chalk.red(`Routine "${id}" has an empty chain -- nothing to run.`),
    );
    process.exitCode = 1;
    return;
  }

  const prompt = buildRoutineRunPrompt(id, row.chain);

  if (opts.dryRun) {
    if (opts.json) {
      console.log(
        JSON.stringify({ id, dryRun: true, chain: row.chain, prompt }, null, 2),
      );
      return;
    }
    console.log(
      chalk.bold(
        `Would run routine "${id}" via claude -p. No process was started.`,
      ),
    );
    console.log("");
    console.log(chalk.dim("--- prompt ---"));
    console.log(prompt);
    return;
  }

  const startedAtMs = Date.now();
  const result = await runClaude([], prompt, RUN_TIMEOUT_MS);
  const durationMs = Date.now() - startedAtMs;

  const rec: ScheduleRunRecord = {
    timestamp: new Date(startedAtMs).toISOString(),
    routineId: id,
    exitOk: result.ok,
    durationMs,
    detail: result.ok
      ? "the process completed without error"
      : `the process failed: ${result.text.slice(0, 300)}`,
  };
  appendRunHistory(root, id, rec);

  if (opts.json) {
    console.log(JSON.stringify(rec, null, 2));
  } else if (result.ok) {
    console.log(
      chalk.green(
        `jstack schedule run ${id}: ${rec.detail} (${Math.round(durationMs / 1000)}s).`,
      ),
    );
  } else {
    console.error(
      chalk.red(
        `jstack schedule run ${id}: ${rec.detail} (${Math.round(durationMs / 1000)}s).`,
      ),
    );
    process.exitCode = 1;
  }
}

/* ---------------------------------------------------------------- report ---- */

export interface ScheduleReportOpts {
  json?: boolean;
}

function fmtNextFire(cron: string): string {
  const nf = computeNextFire(cron, Date.now());
  if (nf.nextFireMs === null) return nf.reason;
  // `reason` is "matched" whenever nextFireMs is set -- an internal detail with no
  // information for the reader, so it's only surfaced in the null-result branch above,
  // where it actually explains *why* there's no next fire (no cron / unparseable).
  return new Date(nf.nextFireMs).toISOString();
}

export function runScheduleReport(
  idMaybe: string | undefined,
  opts: ScheduleReportOpts = {},
): void {
  const root = findProjectRoot();
  const cfg = readConfig(root);
  const rows = listRoutinesFromConfig(cfg);

  const id = idMaybe?.trim() ?? "";

  if (!id.length) {
    const withHistory = rows.map((r) => ({
      ...r,
      everRun: readRunHistory(root, r.id).length > 0,
      nextFire: computeNextFire(r.cron, Date.now()),
    }));
    if (opts.json) {
      console.log(JSON.stringify(withHistory, null, 2));
      return;
    }
    const enabledCount = rows.filter((r) => r.enabled).length;
    const everRunCount = withHistory.filter((r) => r.everRun).length;
    console.log(
      chalk.bold(
        `${rows.length} routine(s): ${enabledCount} enabled, ${everRunCount} ever run via ` +
          `\`jstack schedule run\`, ${rows.length - everRunCount} never run.`,
      ),
    );
    for (const r of withHistory) {
      console.log(
        `  ${r.enabled ? "●" : "○"} ${r.id.padEnd(16)} next fire: ${fmtNextFire(r.cron)}` +
          (r.everRun
            ? ""
            : chalk.dim("  [never run via `jstack schedule run`]")),
      );
    }
    return;
  }

  const row = rows.find((r) => r.id === id);
  if (!row) {
    console.error(chalk.red(`Unknown routine: ${id}.`));
    process.exitCode = 1;
    return;
  }

  const history = readRunHistory(root, id);
  const nextFire = computeNextFire(row.cron, Date.now());

  if (opts.json) {
    console.log(JSON.stringify({ ...row, nextFire, history }, null, 2));
    return;
  }

  console.log(chalk.bold(id));
  console.log(`  cron:      ${row.cron || "(none)"}`);
  console.log(`  enabled:   ${row.enabled}`);
  console.log(`  next fire: ${fmtNextFire(row.cron)}`);
  console.log("");

  if (history.length === 0) {
    console.log(
      chalk.yellow(
        "Never run via `jstack schedule run` -- if this is meant to run automatically, " +
          "point an external cron/launchd entry at that command.",
      ),
    );
    return;
  }

  const last = history[history.length - 1]!;
  console.log(
    chalk.bold("Last run: ") +
      `${last.timestamp} — ${last.exitOk ? chalk.green("completed without error") : chalk.red("failed")} ` +
      `(${Math.round(last.durationMs / 1000)}s)`,
  );
  console.log("");
  console.log(chalk.dim("Recent history:"));
  for (const rec of history.slice(-5).reverse()) {
    console.log(
      `  ${rec.timestamp}  ${rec.exitOk ? "ok" : "failed"}  ${Math.round(rec.durationMs / 1000)}s`,
    );
  }
}

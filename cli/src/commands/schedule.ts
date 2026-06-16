import chalk from "chalk";
import * as p from "@clack/prompts";
import { findProjectRoot, readConfig, writeConfig } from "../lib/config.js";
import { exitCancelled, handleCancel, isInteractive, nonInteractiveHint } from "../lib/cliUi.js";
import { listRoutinesFromConfig, type RoutineRow } from "../lib/scheduler.js";

async function pickRoutineId(rows: RoutineRow[], message: string): Promise<string | null> {
  if (rows.length === 0) {
    console.error(chalk.yellow("No routines in jstack.config.json."));
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
    console.log(`  ${r.enabled ? "●" : "○"} ${r.id.padEnd(16)} ${r.cron || "-"}  → ${r.chain.join(", ")}`);
  }
}

export async function runScheduleEnable(idMaybe?: string): Promise<void> {
  const root = findProjectRoot();
  const cfg = readConfig(root);
  const rows = listRoutinesFromConfig(cfg);
  let id = idMaybe?.trim() ?? "";

  if (!id.length) {
    if (!isInteractive()) {
      console.error(
        chalk.red("Usage: jstack schedule enable <id>. ") + chalk.dim(nonInteractiveHint("`jstack schedule list`")),
      );
      process.exitCode = 1;
      return;
    }
    const picked = await pickRoutineId(rows, "Routine to enable");
    if (picked === null) {
      process.exitCode = 1;
      return;
    }
    id = picked;
  }

  const routines = { ...(cfg.routines as Record<string, Record<string, unknown>>) };
  if (!routines[id]) {
    console.error(`Unknown routine: ${id}`);
    process.exitCode = 1;
    return;
  }
  routines[id] = { ...routines[id], enabled: true };
  writeConfig(root, { ...cfg, routines });
  console.log(chalk.green(`Enabled ${id}`));
}

export async function runScheduleDisable(idMaybe?: string): Promise<void> {
  const root = findProjectRoot();
  const cfg = readConfig(root);
  const rows = listRoutinesFromConfig(cfg);
  let id = idMaybe?.trim() ?? "";

  if (!id.length) {
    if (!isInteractive()) {
      console.error(
        chalk.red("Usage: jstack schedule disable <id>. ") +
          chalk.dim(nonInteractiveHint("`jstack schedule list`")),
      );
      process.exitCode = 1;
      return;
    }
    const picked = await pickRoutineId(rows, "Routine to disable");
    if (picked === null) {
      process.exitCode = 1;
      return;
    }
    id = picked;
  }

  const routines = { ...(cfg.routines as Record<string, Record<string, unknown>>) };
  if (!routines[id]) {
    console.error(`Unknown routine: ${id}`);
    process.exitCode = 1;
    return;
  }
  routines[id] = { ...routines[id], enabled: false };
  writeConfig(root, { ...cfg, routines });
  console.log(chalk.green(`Disabled ${id}`));
}

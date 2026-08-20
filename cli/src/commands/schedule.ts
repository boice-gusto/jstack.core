import chalk from "chalk";
import * as p from "@clack/prompts";
import { findProjectRoot, readConfig, writeConfig } from "../lib/config.js";
import {
  exitCancelled,
  handleCancel,
  isInteractive,
  nonInteractiveHint,
} from "../lib/cliUi.js";
import { listRoutinesFromConfig, type RoutineRow } from "../lib/scheduler.js";

async function pickRoutineId(
  rows: RoutineRow[],
  message: string,
): Promise<string | null> {
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

  const routines = {
    ...(cfg.routines as Record<string, Record<string, unknown>>),
  };
  if (!routines[id]) {
    console.error(`Unknown routine: ${id}`);
    process.exitCode = 1;
    return;
  }
  routines[id] = { ...routines[id], enabled };
  writeConfig(root, { ...cfg, routines });
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

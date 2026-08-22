import chalk from "chalk";
import { findProjectRoot } from "../lib/config.js";
import {
  MEMORY_KINDS,
  MEMORY_SOURCES,
  MemoryValidationError,
  appendMemoryEntry,
  type MemoryKind,
  searchMemoryEntries,
} from "../lib/memory-store.js";

export function runMemoryLog(json: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    console.error(chalk.red("jstack memory log: invalid JSON"));
    process.exitCode = 1;
    return;
  }
  try {
    const entry = appendMemoryEntry(findProjectRoot(), parsed);
    console.log(chalk.green(`Logged ${entry.kind}/${entry.key}`));
  } catch (err) {
    if (err instanceof MemoryValidationError) {
      console.error(chalk.red(`jstack memory log: ${err.message}`));
      process.exitCode = 1;
      return;
    }
    throw err;
  }
}

export interface MemorySearchFlags {
  kind?: string;
  key?: string;
  skill?: string;
  limit?: string;
  json?: boolean;
}

export function runMemorySearch(flags: MemorySearchFlags): void {
  let kind: MemoryKind | undefined;
  if (flags.kind !== undefined) {
    if (!MEMORY_KINDS.includes(flags.kind as MemoryKind)) {
      console.error(
        chalk.red(
          `jstack memory search: --kind must be one of ${MEMORY_KINDS.join(", ")}`,
        ),
      );
      process.exitCode = 1;
      return;
    }
    kind = flags.kind as MemoryKind;
  }

  const limit = flags.limit !== undefined ? Number(flags.limit) : undefined;
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
    console.error(
      chalk.red("jstack memory search: --limit must be a positive integer"),
    );
    process.exitCode = 1;
    return;
  }

  const results = searchMemoryEntries(findProjectRoot(), {
    kind,
    key: flags.key,
    skill: flags.skill,
    limit,
  });

  if (flags.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  if (results.length === 0) {
    console.log(chalk.dim("No memory entries match."));
    return;
  }
  for (const e of results) {
    const conf =
      e.confidence !== undefined ? ` (confidence ${e.confidence}/10)` : "";
    console.log(
      `${chalk.bold(`[${e.kind}]`)} ${e.key}${conf} — ${e.written_at}`,
    );
    console.log(`  ${e.insight}`);
    if (e.skill)
      console.log(chalk.dim(`  logged by ${e.skill}, source: ${e.source}`));
  }
}

export const MEMORY_HELP_KINDS = MEMORY_KINDS.join(", ");
export const MEMORY_HELP_SOURCES = MEMORY_SOURCES.join(", ");

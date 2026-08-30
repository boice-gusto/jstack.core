#!/usr/bin/env bun
/**
 * Removes everything the a2a harness dumped under `.tmp/a2a/` -- per-model reports and the
 * cross-model compare report. Scoped to that one subtree, not `.tmp/` as a whole: `.tmp/` is a
 * shared scratch convention (see `.tmp/crew-evals/`, `.tmp/ralph-design/`), and this command
 * must never touch another tool's files there.
 *
 * Warns and lists what will be deleted before doing it. Confirmation is required unless `--yes`
 * is passed (for scripted/CI use) -- deleting eval history silently is exactly the kind of
 * "helpful" default that costs someone a debugging session later.
 *
 * Usage:
 *   bun run eval:cleanup            # lists files, asks y/N
 *   bun run eval:cleanup -- --yes   # skips the prompt
 */
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = join(here, "..", "..");
const tmpRoot = join(pluginRoot, ".tmp", "a2a");

const argv = process.argv.slice(2);
const skipConfirm = argv.includes("--yes") || argv.includes("-y");

if (!existsSync(tmpRoot)) {
  console.log("Nothing to clean -- .tmp/a2a/ does not exist.");
  process.exit(0);
}

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(abs));
    else out.push(abs);
  }
  return out;
}

const files = listFiles(tmpRoot);
if (files.length === 0) {
  console.log(".tmp/a2a/ is already empty. Removing the empty directory.");
  rmSync(tmpRoot, { recursive: true, force: true });
  process.exit(0);
}

const totalBytes = files.reduce((sum, f) => sum + statSync(f).size, 0);
console.log(
  `About to permanently delete ${files.length} file(s) (${(totalBytes / 1024).toFixed(1)} KB) under .tmp/a2a/:\n`,
);
for (const f of files) console.log(`  ${relative(pluginRoot, f)}`);
console.log("");

async function confirm(): Promise<boolean> {
  if (skipConfirm) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer: string = await new Promise((resolve) =>
    rl.question("Delete these files? [y/N] ", resolve),
  );
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

const ok = await confirm();
if (!ok) {
  console.log("Cancelled -- nothing deleted.");
  process.exit(1);
}

rmSync(tmpRoot, { recursive: true, force: true });
console.log(`Deleted ${files.length} file(s) under .tmp/a2a/.`);

/**
 * Shared interactive CLI helpers (Clack-first).
 *
 * Use when a command has optional prompts:
 * - Call `isInteractive()` before `select` / `confirm` / `text`.
 * - When not interactive, prefer `--json` machine output or a one-line `nonInteractiveHint()` on stderr.
 * - On cancel (`Ctrl+C`), use `handleCancel()` then `exitCancelled()` so behavior matches `setup`.
 *
 * See `README.md` in this package for conventions.
 */
import * as p from "@clack/prompts";

/** True when stdin/stdout are TTY and CI is not set (safe for prompts). */
export function isInteractive(): boolean {
  const ci = process.env.CI;
  const ciOn = ci === "1" || ci === "true";
  return Boolean(process.stdin.isTTY && process.stdout.isTTY && !ciOn);
}

/** Short stderr message for scripting / pipes when prompts are skipped. */
export function nonInteractiveHint(flagHint = "`--json`"): string {
  return `Non-interactive environment. Use ${flagHint} or run in a terminal for prompts.`;
}

/** Whether the user cancelled the current prompt (Ctrl+C). */
export function handleCancel(value: unknown): boolean {
  return p.isCancel(value);
}

/** Exit cleanly after cancel (exit code 0), matching setup wizard behavior. */
export function exitCancelled(message = "Cancelled."): never {
  p.cancel(message);
  process.exit(0);
}

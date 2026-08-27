import { spawnSync } from "node:child_process";
import { ENCODING_UTF8 } from "../../constants/paths.js";

/** Runs `bun <args>` in `cwd` with `env` merged over the current process env, capturing
 * combined stdout+stderr. Shared by prove-e2e.ts and verify-integration.ts, which both
 * shell out to the CLI entrypoint repeatedly under different fixture projects. */
export function runBun(
  args: string[],
  cwd: string,
  env: Record<string, string | undefined>,
): {
  status: number;
  out: string;
} {
  const r = spawnSync("bun", args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: ENCODING_UTF8,
    maxBuffer: 32 * 1024 * 1024,
  });
  return { status: r.status ?? 1, out: (r.stdout ?? "") + (r.stderr ?? "") };
}

/** Narrows `unknown` (typically a `JSON.parse` result) to a plain object, excluding
 * arrays and null. */
export function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/**
 * `runBun`, then log `.out`, then die with exit code 1 on a non-zero status -- the exact 3-step
 * idiom `prove-e2e.ts` and `verify-integration.ts` each repeat at every step that always dies the
 * same way on failure. Two sites intentionally stay manual rather than being forced through this
 * (prove-e2e's semantic-eval step forwards the run's own exit code instead of always using 1; the
 * CLI-matrix loop only logs on failure, with a different message shape) -- see their comments.
 */
export function runStepOrExit(
  args: string[],
  cwd: string,
  env: Record<string, string | undefined>,
): { status: number; out: string } {
  const r = runBun(args, cwd, env);
  console.log(r.out);
  if (r.status !== 0) process.exit(1);
  return r;
}

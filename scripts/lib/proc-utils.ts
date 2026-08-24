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

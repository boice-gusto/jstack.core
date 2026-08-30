/**
 * Lowest-level process-spawning primitive, shared by subjects.ts (candidate execution) and
 * backends.ts (model dispatch) with no dependency between those two -- both depend on this
 * instead of on each other, which is what keeps model dispatch a one-file add rather than a
 * circular-import puzzle.
 */
import { spawn } from "node:child_process";

export const MAX_BUFFER = 8 * 1024 * 1024;

/**
 * 120s is comfortable for a raw-API judge but marginal when the subject is exercised through a
 * nested CLI session (Claude Code or Codex), which carries startup and tool-loading overhead an
 * API call does not. A subject that times out reports as a hard assertion failure ("subject
 * could not be exercised"), which is indistinguishable at a glance from the subject actually
 * behaving wrongly -- so make the budget tunable rather than letting infrastructure latency
 * masquerade as a behavioral finding.
 */
export const DEFAULT_TIMEOUT_MS = Number(
  process.env.JSTACK_EVAL_TIMEOUT_MS ?? 120_000,
);

export interface SpawnAsyncResult {
  stdout: string;
  stderr: string;
  status: number | null;
  error?: Error;
}

/**
 * Async equivalent of `child_process.spawnSync`. Using `spawn` instead of `spawnSync` lets the
 * event loop run other cases' children concurrently instead of blocking on this one until it
 * exits -- with ~90+ cases and each agentic/judge call costing 20-90s of nested-session
 * overhead, a fully serial suite ran 30-60+ minutes end to end.
 */
export function spawnAsync(
  cmd: string,
  args: string[],
  opts: {
    cwd?: string;
    input?: string;
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number;
  },
): Promise<SpawnAsyncResult> {
  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(cmd, args, {
        cwd: opts.cwd,
        env: opts.env,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (e) {
      resolve({ stdout: "", stderr: "", status: null, error: e as Error });
      return;
    }

    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timer = setTimeout(() => {
      if (settled) return;
      child.kill("SIGTERM");
      settle({
        stdout,
        stderr,
        status: null,
        error: new Error(`ETIMEDOUT after ${timeoutMs}ms`),
      });
    }, timeoutMs);

    function settle(result: SpawnAsyncResult): void {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    }

    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      if (stdout.length < MAX_BUFFER) stdout += chunk;
    });
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      if (stderr.length < MAX_BUFFER) stderr += chunk;
    });
    child.on("error", (err) => {
      settle({ stdout, stderr, status: null, error: err });
    });
    child.on("close", (code) => {
      settle({ stdout, stderr, status: code });
    });

    if (opts.input !== undefined && child.stdin) {
      child.stdin.write(opts.input);
      child.stdin.end();
    } else {
      child.stdin?.end();
    }
  });
}

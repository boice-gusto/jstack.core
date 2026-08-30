import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

import {
  extractSessionId,
  mapStreamJsonLine,
  type StreamJsonEvent,
} from "./claude-stream-json.js";
import {
  extractCodexSessionId,
  mapCodexStreamJsonLine,
} from "./codex-stream-json.js";

export type AgentBackend = "claude" | "codex";

/**
 * A `claude`/`codex` session id previously returned via `onSessionId`, to resume. Validated
 * against the id shape both backends actually emit (alphanumeric/`_`/`-`, must start
 * alphanumeric) before it ever reaches argv -- it lands as a bare positional token (Codex's
 * `exec resume <id>`) or after a value-consuming flag (Claude's `--resume`), and a value starting
 * with `-`/`--` would let it be parsed as a CLI flag by the child's own argv parser instead of a
 * session id, regardless of `spawn` never touching a shell.
 */
const RESUME_SESSION_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export class InvalidResumeSessionIdError extends Error {}
export class MissingBackendModeError extends Error {}

export type AgentRunConfig = {
  backend: AgentBackend;
  /** Path to the `claude` or `codex` binary. */
  bin: string;
  prompt: string;
  cwd: string;
  env?: NodeJS.ProcessEnv;
  resumeSessionId?: string;
  /** Required when `backend === "claude"`. No default here on purpose -- see CLAUDE.md's
   * "no silent defaults" rule; callers must pick a permission mode deliberately rather than
   * inherit whatever this module happened to choose. */
  permissionMode?: string;
  /** Required when `backend === "codex"`. Same "no silent default" reasoning. */
  sandboxMode?: string;
  timeoutMs: number;
  maxBufferBytes: number;
};

export type AgentRunCallbacks = {
  onSessionId?: (id: string) => void;
  onEvent: (evt: StreamJsonEvent) => void;
  onStderr?: (chunk: string) => void;
  onExit: (result: { code: number | null; error?: string }) => void;
};

export type AgentRunHandle = {
  /** Kills the child process if it's still running. Safe to call after exit (no-op). */
  cancel: () => void;
};

function buildArgs(config: AgentRunConfig): string[] {
  const { backend, prompt, resumeSessionId } = config;
  if (
    resumeSessionId !== undefined &&
    !RESUME_SESSION_ID_RE.test(resumeSessionId)
  ) {
    throw new InvalidResumeSessionIdError(
      `resumeSessionId does not match the id shape ${backend} emits: ${resumeSessionId}`,
    );
  }
  if (backend === "codex") {
    if (resumeSessionId !== undefined) {
      return ["exec", "resume", resumeSessionId, prompt, "--json"];
    }
    if (config.sandboxMode === undefined) {
      throw new MissingBackendModeError(
        "sandboxMode is required for the codex backend",
      );
    }
    return ["exec", prompt, "--json", "--sandbox", config.sandboxMode];
  }
  if (config.permissionMode === undefined) {
    throw new MissingBackendModeError(
      "permissionMode is required for the claude backend",
    );
  }
  return [
    "-p",
    prompt,
    "--output-format",
    "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--permission-mode",
    config.permissionMode,
    ...(resumeSessionId !== undefined ? ["--resume", resumeSessionId] : []),
  ];
}

/**
 * Spawn a `claude`/`codex` CLI child process for one prompt turn and stream its parsed output via
 * callbacks. Transport-agnostic (no HTTP/SSE, no daemon/session-store knowledge) -- callers own
 * whatever they turn these callbacks into, whether that's `dashboard/src/app/api/agent/stream`'s
 * SSE response or a daemon's ACP-shaped socket notifications. Mirrors that route's
 * spawn/readline/timeout mechanics (the two currently run in parallel rather than sharing this
 * function -- see `docs/dashboard-redesign-design.md`'s AgentProvider proposal and the repo's own
 * `dashboard-telemetry.ts` precedent for why a file with runtime relative imports isn't crossed
 * into the dashboard via the `@jstack/*` alias: Turbopack fails to resolve it).
 */
export function runAgentProvider(
  config: AgentRunConfig,
  callbacks: AgentRunCallbacks,
): AgentRunHandle {
  const args = buildArgs(config);
  const extractBackendSessionId =
    config.backend === "codex" ? extractCodexSessionId : extractSessionId;
  const mapBackendStreamJsonLine =
    config.backend === "codex" ? mapCodexStreamJsonLine : mapStreamJsonLine;

  const child = spawn(config.bin, args, {
    cwd: config.cwd,
    env: config.env ?? process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let finished = false;
  let bytesOut = 0;
  let sentSessionId = false;

  const killTimer = setTimeout(() => {
    child.kill("SIGKILL");
  }, config.timeoutMs);

  const finish = (result: { code: number | null; error?: string }): void => {
    if (finished) return;
    finished = true;
    clearTimeout(killTimer);
    callbacks.onExit(result);
  };

  if (child.stderr !== null) {
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      callbacks.onStderr?.(chunk);
    });
  }

  if (child.stdout !== null) {
    const rl = createInterface({
      input: child.stdout,
      crlfDelay: Number.POSITIVE_INFINITY,
    });
    rl.on("line", (line: string) => {
      bytesOut += Buffer.byteLength(line, "utf8") + 1;
      if (bytesOut > config.maxBufferBytes) {
        child.kill("SIGKILL");
        finish({ code: null, error: "Stream exceeded max buffer" });
        return;
      }
      if (!sentSessionId) {
        const sid = extractBackendSessionId(line);
        if (sid !== null) {
          sentSessionId = true;
          callbacks.onSessionId?.(sid);
        }
      }
      for (const evt of mapBackendStreamJsonLine(line)) {
        callbacks.onEvent(evt);
      }
    });
  }

  // Node's docs don't guarantee 'close' follows a spawn failure's 'error' -- handled independently
  // rather than relying on one cleaning up after the other (both guarded by the `finished` flag,
  // so whichever fires first wins and the other is a no-op).
  child.on("error", (err: Error) => {
    finish({ code: null, error: err.message });
  });

  child.on("close", (code: number | null) => {
    finish({ code });
  });

  return {
    cancel: () => {
      if (finished) return;
      child.kill("SIGKILL");
    },
  };
}

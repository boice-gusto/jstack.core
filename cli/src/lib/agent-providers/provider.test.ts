import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  InvalidResumeSessionIdError,
  MissingBackendModeError,
  runAgentProvider,
  type AgentRunConfig,
} from "./provider.js";
import type { StreamJsonEvent } from "./claude-stream-json.js";

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "jstack-agent-provider-test-"));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

/** Writes an executable shell script that ignores its argv and prints fixed stdout lines. */
function writeFakeBin(
  lines: string[],
  opts: { exitCode?: number; sleepMs?: number } = {},
): string {
  const path = join(workDir, "fake-bin.sh");
  const body = [
    "#!/bin/sh",
    opts.sleepMs !== undefined
      ? `sleep ${(opts.sleepMs / 1000).toFixed(3)}`
      : "",
    ...lines.map((l) => `printf '%s\\n' ${JSON.stringify(l)}`),
    `exit ${opts.exitCode ?? 0}`,
  ]
    .filter((l) => l.length > 0)
    .join("\n");
  writeFileSync(path, `${body}\n`);
  chmodSync(path, 0o755);
  return path;
}

function baseConfig(
  bin: string,
  overrides: Partial<AgentRunConfig> = {},
): AgentRunConfig {
  return {
    backend: "claude",
    bin,
    prompt: "hello",
    cwd: workDir,
    permissionMode: "default",
    timeoutMs: 5000,
    maxBufferBytes: 1_000_000,
    ...overrides,
  };
}

describe("runAgentProvider", () => {
  it("streams parsed events and reports a clean exit", async () => {
    const bin = writeFakeBin([
      JSON.stringify({ type: "system", session_id: "sess-abc" }),
      JSON.stringify({
        type: "assistant",
        message: { content: [{ type: "text", text: "hi there" }] },
      }),
      JSON.stringify({
        type: "result",
        usage: { input_tokens: 3 },
        total_cost_usd: 0.01,
      }),
    ]);

    const events: StreamJsonEvent[] = [];
    const captured: { sessionId: string | null } = { sessionId: null };
    const exit = await new Promise<{ code: number | null; error?: string }>(
      (resolve) => {
        runAgentProvider(baseConfig(bin), {
          onSessionId: (id) => {
            captured.sessionId = id;
          },
          onEvent: (evt) => events.push(evt),
          onExit: resolve,
        });
      },
    );

    expect(captured.sessionId).toBe("sess-abc");
    expect(events).toContainEqual({ kind: "assistant_text", text: "hi there" });
    expect(events.some((e) => e.kind === "result")).toBe(true);
    expect(exit).toEqual({ code: 0 });
  });

  it("reports a spawn failure via onExit without throwing", async () => {
    const exit = await new Promise<{ code: number | null; error?: string }>(
      (resolve) => {
        runAgentProvider(baseConfig("/definitely/does/not/exist/agent-bin"), {
          onEvent: () => {},
          onExit: resolve,
        });
      },
    );
    expect(exit.code).toBeNull();
    expect(exit.error).toBeDefined();
  });

  it("cancel() kills a still-running child before it exits on its own", async () => {
    const bin = writeFakeBin(
      [JSON.stringify({ type: "result", usage: {}, total_cost_usd: 0 })],
      {
        sleepMs: 5000,
      },
    );
    const events: StreamJsonEvent[] = [];
    let resolveExit!: (r: { code: number | null; error?: string }) => void;
    const exitPromise = new Promise<{ code: number | null; error?: string }>(
      (resolve) => {
        resolveExit = resolve;
      },
    );
    const handle = runAgentProvider(baseConfig(bin, { timeoutMs: 30_000 }), {
      onEvent: (evt) => events.push(evt),
      onExit: resolveExit,
    });
    handle.cancel();
    const exit = await exitPromise;
    // SIGKILL: no exit code, only a signal -- either shape confirms the process didn't run to
    // completion (the sleep would otherwise delay exit by 5s past this test's own timeout).
    expect(exit.code === null || exit.code !== 0).toBe(true);
    expect(events).toHaveLength(0);
  });

  it("kills the child and reports an error once maxBufferBytes is exceeded", async () => {
    const bin = writeFakeBin([
      JSON.stringify({ type: "raw_placeholder", text: "x".repeat(200) }),
    ]);
    const exit = await new Promise<{ code: number | null; error?: string }>(
      (resolve) => {
        runAgentProvider(baseConfig(bin, { maxBufferBytes: 10 }), {
          onEvent: () => {},
          onExit: resolve,
        });
      },
    );
    expect(exit.error).toBe("Stream exceeded max buffer");
  });

  it("throws InvalidResumeSessionIdError for a resumeSessionId shaped like a CLI flag", () => {
    expect(() =>
      runAgentProvider(
        baseConfig("/bin/true", {
          resumeSessionId: "--dangerously-skip-checks",
        }),
        {
          onEvent: () => {},
          onExit: () => {},
        },
      ),
    ).toThrow(InvalidResumeSessionIdError);
  });

  it("throws MissingBackendModeError when permissionMode is missing for claude", () => {
    expect(() =>
      runAgentProvider(baseConfig("/bin/true", { permissionMode: undefined }), {
        onEvent: () => {},
        onExit: () => {},
      }),
    ).toThrow(MissingBackendModeError);
  });

  it("throws MissingBackendModeError when sandboxMode is missing for codex", () => {
    expect(() =>
      runAgentProvider(
        baseConfig("/bin/true", {
          backend: "codex",
          permissionMode: undefined,
          sandboxMode: undefined,
        }),
        { onEvent: () => {}, onExit: () => {} },
      ),
    ).toThrow(MissingBackendModeError);
  });
});

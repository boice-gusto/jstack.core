/**
 * Model backend dispatch -- the one place that knows how to run a prompt through a given model
 * CLI non-interactively and pull its final reply out of the result.
 *
 * Every caller that needs "hand this prompt to model X, get its text reply back" (subjects.ts's
 * runCandidate, run.ts's askJudge) goes through `invokeBackend` instead of hardcoding a binary
 * name and argv shape. That's what makes the single-model and multi-model regression commands
 * (`bun run single-eval-suite-regression-test` / `bun run multi-model-eval-suite-regression-test`)
 * the same code path with a different `--models` list, and what makes adding a third backend a
 * one-file change instead of a grep-and-edit across the harness.
 *
 * `claude -p ... --output-format text` already prints just the final reply on stdout, so no
 * temp file is needed there. `codex exec` in its default (non `--json`) mode prints a full
 * transcript (banner, `user`/`codex` turn markers, token count) interleaved with the reply, so
 * `--output-last-message <file>` is used to get the same clean "just the final text" contract --
 * confirmed against a live `codex exec "Reply with exactly: PONG" --output-last-message <f>` run,
 * which wrote exactly `PONG` to the file while stdout carried the full transcript around it.
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnAsync } from "./spawn.js";

export const MODEL_BACKENDS = ["claude", "codex"] as const;
export type ModelBackend = (typeof MODEL_BACKENDS)[number];

export function isModelBackend(value: string): value is ModelBackend {
  return (MODEL_BACKENDS as readonly string[]).includes(value);
}

export interface BackendInvokeResult {
  /** The model's final reply, trimmed. Empty string on failure. */
  text: string;
  exitCode: number | null;
  error?: string;
}

export interface BackendOptions {
  cwd: string;
  apiKey?: string;
  timeoutMs?: number;
  claudeBin?: string;
  codexBin?: string;
}

async function invokeClaude(
  prompt: string,
  opts: BackendOptions,
): Promise<BackendInvokeResult> {
  const bin = opts.claudeBin ?? process.env.JSTACK_CLAUDE_BIN ?? "claude";
  const r = await spawnAsync(bin, ["-p", prompt, "--output-format", "text"], {
    cwd: opts.cwd,
    env: {
      ...process.env,
      ANTHROPIC_API_KEY: opts.apiKey ?? process.env.ANTHROPIC_API_KEY ?? "",
    },
    timeoutMs: opts.timeoutMs,
  });
  const text = (r.stdout ?? "").trim();
  return {
    text,
    exitCode: r.status,
    error: r.error
      ? String(r.error.message ?? r.error)
      : text === ""
        ? "candidate produced no output"
        : undefined,
  };
}

async function invokeCodex(
  prompt: string,
  opts: BackendOptions,
): Promise<BackendInvokeResult> {
  const bin = opts.codexBin ?? process.env.JSTACK_CODEX_BIN ?? "codex";
  const dir = mkdtempSync(join(tmpdir(), "jstack-codex-out-"));
  const outFile = join(dir, "last-message.txt");
  try {
    const r = await spawnAsync(
      bin,
      [
        "exec",
        prompt,
        "--sandbox",
        "read-only",
        "--color",
        "never",
        "--output-last-message",
        outFile,
      ],
      { cwd: opts.cwd, env: { ...process.env }, timeoutMs: opts.timeoutMs },
    );
    let text = "";
    try {
      text = readFileSync(outFile, "utf8").trim();
    } catch {
      // Codex never wrote a final message (crash, timeout, refusal) -- fall through to stdout.
    }
    if (text === "") text = (r.stdout ?? "").trim();
    return {
      text,
      exitCode: r.status,
      error: r.error
        ? String(r.error.message ?? r.error)
        : text === ""
          ? "candidate produced no output"
          : undefined,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function invokeBackend(
  backend: ModelBackend,
  prompt: string,
  opts: BackendOptions,
): Promise<BackendInvokeResult> {
  switch (backend) {
    case "claude":
      return invokeClaude(prompt, opts);
    case "codex":
      return invokeCodex(prompt, opts);
  }
}

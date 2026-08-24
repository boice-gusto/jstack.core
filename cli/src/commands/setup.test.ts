import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mock } from "bun:test";

/**
 * Cancellation (Ctrl+C) at any of runSetup's ~40 prompts used to propagate as a plain
 * `throw new Error("cancelled")`, caught by a fragile `msg === "cancelled"` string check --
 * anything else that happened to throw that exact message would be silently swallowed as a
 * clean cancel. It now throws the same unforgeable PROMPT_CANCELLED symbol schema-prompt.ts
 * already uses, caught by reference instead of by string.
 *
 * A real cancel is simulated by mocking @clack/prompts' own `text`/`isCancel` to agree on a
 * sentinel value, rather than mocking runSetup's internals -- this exercises the real
 * throw-PROMPT_CANCELLED / catch-PROMPT_CANCELLED path end to end.
 */
const CANCEL_MARKER = Symbol("test-cancel-marker");

const realClack = await import("@clack/prompts");
mock.module("@clack/prompts", () => ({
  ...realClack,
  confirm: async () => true, // pass the "Re-run setup anyway?" gate
  text: async () => CANCEL_MARKER, // then cancel at the first real prompt (team name)
  isCancel: (v: unknown) => v === CANCEL_MARKER,
}));

const { runSetup } = await import("./setup.js");

describe("runSetup cancellation", () => {
  test("cancelling a prompt exits with code 130 and writes nothing", async () => {
    const cfgPath = join(import.meta.dir, "..", "..", "..", "jstack.config.json");
    const before = readFileSync(cfgPath, "utf8");
    const originalExitCode = process.exitCode;
    try {
      await runSetup({ reconfigure: true });
      expect(process.exitCode).toBe(130);
    } finally {
      process.exitCode = originalExitCode;
    }
    expect(readFileSync(cfgPath, "utf8")).toBe(before);
  });
});

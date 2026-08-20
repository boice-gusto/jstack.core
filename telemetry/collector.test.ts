/**
 * Covers:
 *  1. The pure in-memory buffer in collector.ts (record/snapshot/clear/size/max).
 *  2. The honesty fix in cli.ts: `status` and `flush` must explicitly say recording
 *     isn't wired up in this process, instead of printing a bare `buffer: 0` that looks
 *     like real (if empty) state. See onboarding task: telemetry/collector.ts's buffer
 *     has zero callers of recordEvent anywhere in the codebase, and cli.ts's
 *     status/flush actions each run in a fresh `bun` process (spawned via spawnSync from
 *     cli/src/commands/telemetry.ts), so the buffer is always empty for structural
 *     reasons, not because telemetry ran and captured nothing.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  bufferSize,
  clearBuffer,
  recordEvent,
  setMaxBuffer,
  snapshotBuffer,
} from "./collector.js";
import type { TelemetryEvent } from "./schema.js";

const CLI = join(import.meta.dir, "cli.ts");

function fakeEvent(
  overrides: Partial<TelemetryEvent> = {},
): Omit<TelemetryEvent, "event_id"> {
  return {
    timestamp: new Date().toISOString(),
    plugin_version: "0.0.0-test",
    skill_name: "jstack:test-skill",
    skill_category: "test",
    token_input: 10,
    token_output: 5,
    token_total: 15,
    latency_ms: 42,
    success: true,
    ...overrides,
  };
}

describe("collector.ts — in-memory buffer", () => {
  beforeEach(() => {
    clearBuffer();
    setMaxBuffer(1000);
  });

  test("starts empty", () => {
    expect(bufferSize()).toBe(0);
    expect(snapshotBuffer()).toEqual([]);
  });

  test("recordEvent appends and assigns an event_id when none is given", () => {
    recordEvent(fakeEvent());
    expect(bufferSize()).toBe(1);
    const [ev] = snapshotBuffer();
    expect(typeof ev.event_id).toBe("string");
    expect(ev.event_id.length).toBeGreaterThan(0);
  });

  test("recordEvent keeps a caller-supplied event_id", () => {
    recordEvent(fakeEvent({ event_id: "fixed-id" }));
    expect(snapshotBuffer()[0].event_id).toBe("fixed-id");
  });

  test("clearBuffer empties it", () => {
    recordEvent(fakeEvent());
    clearBuffer();
    expect(bufferSize()).toBe(0);
  });

  test("snapshotBuffer returns a copy, not a live reference", () => {
    recordEvent(fakeEvent());
    const snap = snapshotBuffer();
    snap.push(fakeEvent({ event_id: "extra" }) as TelemetryEvent);
    expect(bufferSize()).toBe(1);
  });

  test("setMaxBuffer trims oldest entries once exceeded", () => {
    setMaxBuffer(2);
    recordEvent(fakeEvent({ event_id: "a" }));
    recordEvent(fakeEvent({ event_id: "b" }));
    recordEvent(fakeEvent({ event_id: "c" }));
    expect(bufferSize()).toBe(2);
    expect(snapshotBuffer().map((e) => e.event_id)).toEqual(["b", "c"]);
  });
});

describe("cli.ts — status/flush are honest about the unwired buffer", () => {
  let dir: string;

  beforeEach(() => {
    // No jstack.config.json here, so findProjectRoot/loadTelemetryCfg fall back to
    // disabled/unconfigured — irrelevant to what we're asserting, which is the
    // recording_wired_up messaging, not the config-detection path.
    dir = mkdtempSync(join(tmpdir(), "jstack-telemetry-cli-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function run(action: string) {
    const r = spawnSync("bun", [CLI, action], {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1" },
    });
    return { code: r.status, out: r.stdout ?? "", err: r.stderr ?? "" };
  }

  test("status reports buffer: 0 alongside an explicit not-wired-up message", () => {
    const { code, out } = run("status");
    expect(code).toBe(0);
    const parsed = JSON.parse(out);
    expect(parsed.buffer).toBe(0);
    expect(parsed.recording_wired_up).toBe(false);
    expect(parsed.message).toMatch(/not currently wired up/i);
    expect(parsed.message).toMatch(/recordEvent/);
  });

  test("flush reports sent: 0 alongside the same not-wired-up message", () => {
    const { code, out } = run("flush");
    expect(code).toBe(0);
    const parsed = JSON.parse(out);
    expect(parsed.sent).toBe(0);
    expect(parsed.recording_wired_up).toBe(false);
    expect(parsed.message).toMatch(/not currently wired up/i);
  });

  test("status output stays valid JSON only (no stray prose on stdout)", () => {
    const { out } = run("status");
    // JSON.parse throws if anything besides the single JSON value is on stdout.
    expect(() => JSON.parse(out)).not.toThrow();
  });
});

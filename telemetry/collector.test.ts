/**
 * Covers:
 *  1. The pure in-memory buffer in collector.ts (record/snapshot/clear/size/max).
 *  2. The persisted (file-backed) buffer, which is what actually accumulates across process
 *     boundaries -- every `jstack` invocation is a fresh `bun` process, so the in-memory buffer
 *     above is empty by the time a later `jstack telemetry flush` runs; the persisted JSONL file
 *     is the real buffer those commands operate on. `JSTACK_TELEMETRY_BUFFER_PATH` isolates it
 *     from the real `~/.jstack/` path in tests.
 *  3. `jstack telemetry record` (cli.ts): the first real caller of recordEvent() in this
 *     codebase. Disabled by default (opt-in) -- must no-op, not queue for later, when
 *     `telemetry.enabled` is unset/false; must persist a real event when enabled.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendPersisted,
  bufferSize,
  clearBuffer,
  clearPersisted,
  readPersisted,
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

describe("collector.ts — persisted buffer", () => {
  let bufferFile: string;

  beforeEach(() => {
    bufferFile = join(
      mkdtempSync(join(tmpdir(), "jstack-telemetry-persist-")),
      "buffer.jsonl",
    );
    process.env.JSTACK_TELEMETRY_BUFFER_PATH = bufferFile;
  });

  afterEach(() => {
    delete process.env.JSTACK_TELEMETRY_BUFFER_PATH;
    rmSync(bufferFile, { force: true });
  });

  test("readPersisted returns empty when no file exists yet", () => {
    expect(readPersisted()).toEqual([]);
  });

  test("appendPersisted + readPersisted round-trips an event", () => {
    const event = fakeEvent({ event_id: "p1" }) as TelemetryEvent;
    appendPersisted(event);
    expect(readPersisted()).toEqual([event]);
  });

  test("recordEvent also persists, so it survives past this process (simulated by a fresh read)", () => {
    recordEvent(fakeEvent({ event_id: "p2" }));
    expect(readPersisted().map((e) => e.event_id)).toEqual(["p2"]);
  });

  test("clearPersisted empties the file without deleting it", () => {
    appendPersisted(fakeEvent({ event_id: "p3" }) as TelemetryEvent);
    clearPersisted();
    expect(readPersisted()).toEqual([]);
  });

  test("a malformed line is skipped, not fatal to the rest of the read", () => {
    appendPersisted(fakeEvent({ event_id: "good" }) as TelemetryEvent);
    writeFileSync(bufferFile, "not json\n", { flag: "a" });
    appendPersisted(fakeEvent({ event_id: "also-good" }) as TelemetryEvent);
    expect(readPersisted().map((e) => e.event_id)).toEqual([
      "good",
      "also-good",
    ]);
  });
});

describe("cli.ts — status/flush/record against an isolated persisted buffer", () => {
  let dir: string;
  let bufferFile: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "jstack-telemetry-cli-"));
    bufferFile = join(dir, "buffer.jsonl");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function run(action: string, args: string[] = [], enabled = false) {
    if (enabled) {
      writeFileSync(
        join(dir, "jstack.config.json"),
        JSON.stringify({ telemetry: { enabled: true } }),
      );
    }
    const r = spawnSync("bun", [CLI, action, ...args], {
      cwd: dir,
      encoding: "utf8",
      env: {
        ...process.env,
        NO_COLOR: "1",
        JSTACK_TELEMETRY_BUFFER_PATH: bufferFile,
        // findProjectRoot() walks up from import.meta.dir (telemetry/'s real location), not
        // this process's cwd -- JSTACK_PROJECT_ROOT is the sanctioned override to point it at
        // the temp dir's config instead of whatever the real repo root happens to have.
        JSTACK_PROJECT_ROOT: dir,
      },
    });
    return { code: r.status, out: r.stdout ?? "", err: r.stderr ?? "" };
  }

  test("status reports recording_wired_up: true and the real (empty) buffer count", () => {
    const { code, out } = run("status");
    expect(code).toBe(0);
    const parsed = JSON.parse(out);
    expect(parsed.buffer).toBe(0);
    expect(parsed.recording_wired_up).toBe(true);
  });

  test("record no-ops when telemetry.enabled is unset (opt-in, off by default)", () => {
    const { code, out } = run("record", ["--skill", "jstack-test"], false);
    expect(code).toBe(0);
    expect(JSON.parse(out)).toEqual({
      recorded: false,
      reason: "telemetry disabled",
    });
    expect(run("status").out).toContain('"buffer": 0');
  });

  test("record persists a real event when telemetry.enabled is true, and status/flush see it", () => {
    const rec = run(
      "record",
      [
        "--skill",
        "jstack-jira-create",
        "--category",
        "jira",
        "--success",
        "true",
      ],
      true,
    );
    expect(JSON.parse(rec.out)).toEqual({ recorded: true });

    const status = run("status");
    expect(JSON.parse(status.out).buffer).toBe(1);

    const flush = run("flush", [], true);
    const flushed = JSON.parse(flush.out);
    expect(flushed.sent).toBe(1);
    expect(flushed.recording_wired_up).toBe(true);
    // No endpoint configured, so sendBatch reports ok: false -- flush still clears the local
    // buffer either way (matches the pre-existing always-clear contract; a missing endpoint
    // is a config gap to fix, not a reason to grow the buffer unbounded).
    expect(flushed.ok).toBe(false);
    expect(JSON.parse(run("status").out).buffer).toBe(0);
  });

  test("status output stays valid JSON only (no stray prose on stdout)", () => {
    const { out } = run("status");
    expect(() => JSON.parse(out)).not.toThrow();
  });
});

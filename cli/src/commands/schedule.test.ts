/**
 * `runScheduleEnable`/`runScheduleDisable` were duplicated verbatim except for the
 * `enabled` boolean and a couple of label strings, then collapsed into a shared
 * `setRoutineEnabled` helper. These tests drive both verbs through the real CLI to
 * confirm the thin wrappers still produce identical user-facing text/exit codes and
 * still write the right `enabled` value to jstack.config.json.
 */
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const ENTRY = join(import.meta.dir, "..", "index.ts");
let dir: string;

function runSchedule(cwd: string, args: string[]) {
  const r = spawnSync("bun", ["run", ENTRY, "schedule", ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, JSTACK_INTROSPECT: "", NO_COLOR: "1" },
  });
  return { code: r.status, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

function writeConfigWithRoutine(cwd: string, enabled: boolean) {
  writeFileSync(
    join(cwd, "jstack.config.json"),
    JSON.stringify({
      version: "9.9.9",
      routines: {
        test_routine: { enabled, cron: "0 9 * * 1", chain: [] },
      },
    }),
  );
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "jstack-schedule-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("schedule enable/disable", () => {
  test("enable: unknown routine id errors and exits 1", () => {
    writeConfigWithRoutine(dir, false);
    const { code, out } = runSchedule(dir, ["enable", "nope"]);
    expect(code).toBe(1);
    expect(out).toContain("Unknown routine: nope");
  });

  test("enable: known routine prints 'Enabled <id>' and persists enabled: true", () => {
    writeConfigWithRoutine(dir, false);
    const { code, out } = runSchedule(dir, ["enable", "test_routine"]);
    expect(code).toBe(0);
    expect(out).toContain("Enabled test_routine");
    const written = JSON.parse(
      readFileSync(join(dir, "jstack.config.json"), "utf8"),
    );
    expect(written.routines.test_routine.enabled).toBe(true);
  });

  test("disable: known routine prints 'Disabled <id>' and persists enabled: false", () => {
    writeConfigWithRoutine(dir, true);
    const { code, out } = runSchedule(dir, ["disable", "test_routine"]);
    expect(code).toBe(0);
    expect(out).toContain("Disabled test_routine");
    const written = JSON.parse(
      readFileSync(join(dir, "jstack.config.json"), "utf8"),
    );
    expect(written.routines.test_routine.enabled).toBe(false);
  });

  test("disable: unknown routine id errors and exits 1", () => {
    writeConfigWithRoutine(dir, true);
    const { code, out } = runSchedule(dir, ["disable", "nope"]);
    expect(code).toBe(1);
    expect(out).toContain("Unknown routine: nope");
  });
});

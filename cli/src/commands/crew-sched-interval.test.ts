import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { schedInterval } from "./crew.js";
import { renderPlist, type InstallPaths } from "../lib/crew/launchd.js";

/**
 * runCrewDoctor's staleness math (`intervalM = schedInterval(p.plist) ?? 120, in minutes`)
 * silently assumed every plist has `StartInterval` -- true before resident mode existed, false
 * for every resident install now, which has no StartInterval at all. This pins schedInterval()
 * reading the right value from both plist shapes, in seconds either way.
 */
function writeTestPlist(resident: boolean, intervalSeconds: number): string {
  const dir = mkdtempSync(join(tmpdir(), "sched-interval-test-"));
  const path = join(dir, "test.plist");
  const p: InstallPaths = {
    plist: path,
    binary: "/x/crewd",
    stdout: "/x/out.log",
    stderr: "/x/err.log",
  };
  writeFileSync(path, renderPlist(p, "/proj", intervalSeconds, { resident }));
  return path;
}

describe("schedInterval", () => {
  test("reads StartInterval from an interval-mode plist", () => {
    expect(schedInterval(writeTestPlist(false, 300))).toBe(300);
  });

  test("reads JSTACK_CREW_TICK_INTERVAL_MS (converted to seconds) from a resident-mode plist", () => {
    expect(schedInterval(writeTestPlist(true, 300))).toBe(300);
  });

  test("returns null for a nonexistent plist", () => {
    expect(schedInterval("/does/not/exist.plist")).toBeNull();
  });
});

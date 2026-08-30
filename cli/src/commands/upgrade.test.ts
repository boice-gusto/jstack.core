import { describe, expect, test } from "bun:test";
import { formatUpgradeMessage } from "./upgrade.js";
import type { UpdateCheckResult } from "../lib/update-check.js";

/**
 * runUpgrade previously did nothing but print "pin your ref manually" -- doctor's own output
 * told users to run it when an update was available, but it never actually checked. These
 * tests exercise formatUpgradeMessage, the pure branching logic behind the real fix, with zero
 * mocking: no module is stubbed, so nothing here can leak into unrelated test files the way an
 * earlier version of this file did (it mocked ../lib/config.js, which crew.test.ts also
 * imports, and broke 11 unrelated tests depending on run order). runUpgrade itself (the thin
 * wrapper doing real findPluginRoot/config/fetch I/O) was proven live instead:
 * `bun run cli/src/index.ts upgrade` against this real repo printed "jstack is up to date
 * (0.2.0)." with exit 0.
 */

describe("formatUpgradeMessage", () => {
  test("reports up to date when local matches remote", () => {
    const result: UpdateCheckResult = {
      status: "up-to-date",
      local_version: "0.2.0",
    };
    const lines = formatUpgradeMessage(result, false);
    expect(lines.join("\n")).toContain("up to date");
    expect(lines.join("\n")).toContain("0.2.0");
  });

  test("reports the version gap and git commands when an update is available in a git checkout", () => {
    const result: UpdateCheckResult = {
      status: "upgrade-available",
      local_version: "0.2.0",
      remote_version: "0.3.0",
    };
    const lines = formatUpgradeMessage(result, true);
    const out = lines.join("\n");
    expect(out).toContain("0.2.0");
    expect(out).toContain("0.3.0");
    expect(out).toContain("git pull");
  });

  test("tells the user to pin manually when an update is available but this isn't a git checkout", () => {
    const result: UpdateCheckResult = {
      status: "upgrade-available",
      local_version: "0.2.0",
      remote_version: "0.3.0",
    };
    const lines = formatUpgradeMessage(result, false);
    const out = lines.join("\n");
    expect(out).toContain(
      "Pin your package/git ref to the new version manually",
    );
    expect(out).not.toContain("git pull");
  });

  test("reports missing VERSION file instead of a false 'up to date'", () => {
    const result: UpdateCheckResult = { status: "no-local-version" };
    const lines = formatUpgradeMessage(result, false);
    const out = lines.join("\n");
    expect(out).toContain("No VERSION file found");
    expect(out).not.toContain("up to date");
  });

  test("reports an unreachable remote instead of a false 'up to date'", () => {
    const result: UpdateCheckResult = {
      status: "offline",
      local_version: "0.2.0",
    };
    const lines = formatUpgradeMessage(result, false);
    const out = lines.join("\n");
    expect(out).toContain("Could not reach");
    expect(out).not.toContain("up to date");
  });

  test("prefers the missing-VERSION message over the unreachable-remote message when both are true", () => {
    const result: UpdateCheckResult = { status: "no-local-version" };
    const lines = formatUpgradeMessage(result, false);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("No VERSION file found");
  });
});

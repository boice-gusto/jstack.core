import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { STALE_AFTER_MS, acquireSetupLock } from "./setup-lock.js";

describe("acquireSetupLock", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "jstack-lock-"));
  });
  afterEach(() => {
    try {
      rmSync(root, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  test("acquires when no lockfile exists", () => {
    const r = acquireSetupLock(root, "jstack setup --schema");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(existsSync(join(root, ".jstack", "setup.lock"))).toBe(true);
      r.release();
      expect(existsSync(join(root, ".jstack", "setup.lock"))).toBe(false);
    }
  });

  test("refuses when a live process holds the lock", () => {
    const first = acquireSetupLock(root, "jstack setup --schema");
    expect(first.ok).toBe(true);
    const second = acquireSetupLock(root, "jstack setup --schema");
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.existing.pid).toBe(process.pid);
    }
    if (first.ok) first.release();
  });

  test("steals a lockfile whose pid is dead", () => {
    mkdirSync(join(root, ".jstack"), { recursive: true });
    writeFileSync(
      join(root, ".jstack", "setup.lock"),
      JSON.stringify({
        pid: 999999, // unlikely-to-be-alive pid
        started_at: new Date().toISOString(),
        command: "jstack setup --schema",
      }),
      "utf8",
    );
    const r = acquireSetupLock(root, "jstack setup --schema");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.stoleStale?.pid).toBe(999999);
      r.release();
    }
  });

  test("steals a lockfile older than STALE_AFTER_MS even if pid is alive", () => {
    mkdirSync(join(root, ".jstack"), { recursive: true });
    const ancient = new Date(Date.now() - STALE_AFTER_MS - 60_000).toISOString();
    writeFileSync(
      join(root, ".jstack", "setup.lock"),
      JSON.stringify({ pid: process.pid, started_at: ancient, command: "old run" }),
      "utf8",
    );
    const r = acquireSetupLock(root, "jstack setup --schema");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.stoleStale).toBeDefined();
      r.release();
    }
  });

  test("steals a corrupt lockfile", () => {
    mkdirSync(join(root, ".jstack"), { recursive: true });
    writeFileSync(join(root, ".jstack", "setup.lock"), "not json {{{", "utf8");
    const r = acquireSetupLock(root, "jstack setup --schema");
    expect(r.ok).toBe(true);
    if (r.ok) r.release();
  });

  test("release is idempotent (calling twice doesn't throw)", () => {
    const r = acquireSetupLock(root, "jstack setup --schema");
    expect(r.ok).toBe(true);
    if (r.ok) {
      r.release();
      expect(() => r.release()).not.toThrow();
    }
  });

  test("lockfile contains expected fields", () => {
    const r = acquireSetupLock(root, "jstack setup --schema --reconfigure");
    expect(r.ok).toBe(true);
    if (r.ok) {
      const lf = JSON.parse(readFileSync(join(root, ".jstack", "setup.lock"), "utf8"));
      expect(lf.pid).toBe(process.pid);
      expect(typeof lf.started_at).toBe("string");
      expect(lf.command).toContain("jstack setup");
      r.release();
    }
  });
});

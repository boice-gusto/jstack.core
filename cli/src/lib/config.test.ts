import { afterEach, describe, expect, it, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  SKIP_SENTINEL,
  findPluginRoot,
  findProjectRoot,
  isSkipSentinel,
  mergeDeep,
  pruneSkipped,
} from "./config.js";

describe("config", () => {
  describe("SKIP_SENTINEL", () => {
    it("is a registered symbol so cross-realm equality holds", () => {
      expect(isSkipSentinel(SKIP_SENTINEL)).toBe(true);
      expect(isSkipSentinel(Symbol.for("jstack:skip"))).toBe(true);
      expect(isSkipSentinel(Symbol("jstack:skip"))).toBe(false);
      expect(isSkipSentinel(undefined)).toBe(false);
      expect(isSkipSentinel("")).toBe(false);
    });
  });

  describe("mergeDeep", () => {
    it("regression: merges nested objects without sentinels", () => {
      const result = mergeDeep<Record<string, unknown>>(
        { a: 1, b: { c: 2 } },
        { b: { d: 3 } },
      );
      expect(result).toEqual({ a: 1, b: { c: 2, d: 3 } });
    });

    it("does not special-case SKIP_SENTINEL — it leaks through unpruned (pruneSkipped owns that semantic)", () => {
      const result = mergeDeep<Record<string, unknown>>(
        { a: "x", b: 1 },
        { a: SKIP_SENTINEL as unknown as string },
      );
      expect(result.a).toBe(SKIP_SENTINEL);
      expect(result.b).toBe(1);
    });

    it("does not mutate the base object", () => {
      const base = { a: "x", b: 1 } as Record<string, unknown>;
      mergeDeep(base, { a: "y" });
      expect(base).toEqual({ a: "x", b: 1 });
    });

    it("ignores undefined overrides (existing behavior)", () => {
      const result = mergeDeep<Record<string, unknown>>({ a: 1, b: 2 }, {
        a: undefined,
      } as unknown as Record<string, unknown>);
      expect(result).toEqual({ a: 1, b: 2 });
    });
  });

  describe("pruneSkipped", () => {
    it("removes sentinels at any depth", () => {
      const input = {
        a: 1,
        b: SKIP_SENTINEL,
        c: { d: SKIP_SENTINEL, e: "keep" },
        f: { g: { h: SKIP_SENTINEL, i: 7 } },
      };
      const result = pruneSkipped(input);
      expect(result).toEqual({
        a: 1,
        c: { e: "keep" },
        f: { g: { i: 7 } },
      } as unknown as typeof input);
    });

    it("preserves empty objects (no auto-collapse in v1)", () => {
      const input = { a: { b: SKIP_SENTINEL } };
      const result = pruneSkipped(input);
      expect(result).toEqual({ a: {} } as unknown as typeof input);
    });

    it("returns deep-equal copy and does not mutate input when no sentinels", () => {
      const input = { a: 1, b: { c: [1, 2, 3], d: "x" } };
      const snapshot = JSON.parse(JSON.stringify(input));
      const result = pruneSkipped(input);
      expect(result).toEqual(input);
      // Confirm input untouched
      expect(input).toEqual(snapshot);
      // Confirm it's a copy, not the same reference
      expect(result).not.toBe(input);
      expect((result as typeof input).b).not.toBe(input.b);
    });

    it("filters sentinel elements out of arrays", () => {
      const input = { xs: [1, SKIP_SENTINEL, 2, SKIP_SENTINEL, 3] };
      const result = pruneSkipped(input) as { xs: number[] };
      expect(result.xs).toEqual([1, 2, 3]);
    });

    it("returns undefined when given the top-level sentinel", () => {
      expect(pruneSkipped(SKIP_SENTINEL as unknown)).toBeUndefined();
    });

    it("passes primitives through unchanged", () => {
      expect(pruneSkipped(42)).toBe(42);
      expect(pruneSkipped("hello")).toBe("hello");
      expect(pruneSkipped(null)).toBe(null);
      expect(pruneSkipped(true)).toBe(true);
    });
  });
});

describe("findProjectRoot honours JSTACK_PROJECT_ROOT", () => {
  /**
   * The variable already drove `crewd` (launchd gives it no useful cwd) but the CLI ignored
   * it, so one name meant two different things across the system.
   */
  const saved = process.env.JSTACK_PROJECT_ROOT;
  afterEach(() => {
    if (saved === undefined) delete process.env.JSTACK_PROJECT_ROOT;
    else process.env.JSTACK_PROJECT_ROOT = saved;
  });

  test("a pinned root containing a config wins over the cwd walk", () => {
    const root = mkdtempSync(join(tmpdir(), "jstack-pinned-"));
    writeFileSync(join(root, "jstack.config.json"), "{}");
    process.env.JSTACK_PROJECT_ROOT = root;
    expect(findProjectRoot(tmpdir())).toBe(root);
  });

  test("a pinned root WITHOUT a config is ignored, so a bad env var cannot break the CLI", () => {
    const empty = mkdtempSync(join(tmpdir(), "jstack-empty-"));
    process.env.JSTACK_PROJECT_ROOT = empty;
    expect(findProjectRoot(empty)).toBe(empty); // falls through to the normal walk
  });

  test("unset behaves exactly as before", () => {
    delete process.env.JSTACK_PROJECT_ROOT;
    const d = mkdtempSync(join(tmpdir(), "jstack-nocfg-"));
    expect(findProjectRoot(d)).toBe(d);
  });
});

describe("findPluginRoot honours JSTACK_PROJECT_ROOT", () => {
  /**
   * Same launchd-gives-crewd-no-useful-cwd reason as findProjectRoot above, but this one is
   * what fed a real bug: `skills/index`'s resident-daemon RPC handler called findPluginRoot()
   * with no override, walked up from `/` (launchd's default cwd, no `WorkingDirectory` in the
   * plist), never found `config/defaults.json` + `skills/`, and silently fell back to `/` --
   * so the desktop app's Settings dialog showed "0 skills" instead of an error, which made the
   * wrong-root bug look like "no skills installed."
   */
  const saved = process.env.JSTACK_PROJECT_ROOT;
  afterEach(() => {
    if (saved === undefined) delete process.env.JSTACK_PROJECT_ROOT;
    else process.env.JSTACK_PROJECT_ROOT = saved;
  });

  test("a pinned root containing config/defaults.json + skills/ wins over the cwd walk", () => {
    const root = mkdtempSync(join(tmpdir(), "jstack-plugin-pinned-"));
    mkdirSync(join(root, "config"), { recursive: true });
    writeFileSync(join(root, "config", "defaults.json"), "{}");
    mkdirSync(join(root, "skills"), { recursive: true });
    process.env.JSTACK_PROJECT_ROOT = root;
    expect(findPluginRoot(tmpdir())).toBe(root);
  });

  test("a pinned root missing skills/ or config/defaults.json is ignored, so a bad env var cannot break skills/index", () => {
    const empty = mkdtempSync(join(tmpdir(), "jstack-plugin-empty-"));
    process.env.JSTACK_PROJECT_ROOT = empty;
    expect(findPluginRoot(empty)).toBe(empty); // falls through to the normal walk
  });

  test("unset behaves exactly as before", () => {
    delete process.env.JSTACK_PROJECT_ROOT;
    const d = mkdtempSync(join(tmpdir(), "jstack-plugin-nocfg-"));
    expect(findPluginRoot(d)).toBe(d);
  });
});

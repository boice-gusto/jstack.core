import { describe, expect, it } from "bun:test";
import { SKIP_SENTINEL, isSkipSentinel, mergeDeep, pruneSkipped } from "./config.js";

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

    it("deletes a top-level key when override is SKIP_SENTINEL", () => {
      const result = mergeDeep<Record<string, unknown>>(
        { a: "x", b: 1 },
        { a: SKIP_SENTINEL as unknown as string },
      );
      expect(result).toEqual({ b: 1 });
      expect("a" in result).toBe(false);
    });

    it("deletes a nested key when override is SKIP_SENTINEL", () => {
      const result = mergeDeep<Record<string, unknown>>(
        { team: { name: "x", tz: "UTC" } },
        { team: { name: SKIP_SENTINEL as unknown as string } },
      );
      expect(result).toEqual({ team: { tz: "UTC" } });
      expect("name" in (result.team as Record<string, unknown>)).toBe(false);
    });

    it("does not mutate the base object", () => {
      const base = { a: "x", b: 1 } as Record<string, unknown>;
      mergeDeep(base, { a: SKIP_SENTINEL as unknown as string });
      expect(base).toEqual({ a: "x", b: 1 });
    });

    it("ignores undefined overrides (existing behavior)", () => {
      const result = mergeDeep<Record<string, unknown>>(
        { a: 1, b: 2 },
        { a: undefined } as unknown as Record<string, unknown>,
      );
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

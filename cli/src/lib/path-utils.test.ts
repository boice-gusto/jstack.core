import { describe, expect, it } from "bun:test";
import { resolveWithinRoots, setAt } from "./path-utils.js";

describe("setAt", () => {
  it("is a no-op for empty path", () => {
    const obj: Record<string, unknown> = { a: 1 };
    setAt(obj, [], "v");
    expect(obj).toEqual({ a: 1 });
  });

  it("sets a single-segment key", () => {
    const obj: Record<string, unknown> = {};
    setAt(obj, ["x"], 42);
    expect(obj).toEqual({ x: 42 });
  });

  it("sets a nested path, creating missing intermediate objects", () => {
    const obj: Record<string, unknown> = {};
    setAt(obj, ["a", "b", "c"], "hello");
    expect(obj).toEqual({ a: { b: { c: "hello" } } });
  });

  it("reuses an existing intermediate plain object", () => {
    const inner: Record<string, unknown> = { existing: true };
    const obj: Record<string, unknown> = { a: inner };
    setAt(obj, ["a", "x"], 99);
    expect(obj.a).toBe(inner);
    expect((obj.a as Record<string, unknown>).x).toBe(99);
    expect((obj.a as Record<string, unknown>).existing).toBe(true);
  });

  it("overwrites an existing leaf value", () => {
    const obj: Record<string, unknown> = { a: { b: "old" } };
    setAt(obj, ["a", "b"], "new");
    expect(obj).toEqual({ a: { b: "new" } });
  });

  it("replaces an array at an intermediate segment with a plain object", () => {
    const obj: Record<string, unknown> = { a: [1, 2, 3] };
    setAt(obj, ["a", "b"], "replaced");
    expect(obj).toEqual({ a: { b: "replaced" } });
  });

  it("replaces a primitive at an intermediate segment with a plain object", () => {
    const obj: Record<string, unknown> = { a: 42 };
    setAt(obj, ["a", "b"], "replaced");
    expect(obj).toEqual({ a: { b: "replaced" } });
  });

  it("replaces null at an intermediate segment with a plain object", () => {
    const obj: Record<string, unknown> = { a: null };
    setAt(obj, ["a", "b"], "replaced");
    expect(obj).toEqual({ a: { b: "replaced" } });
  });

  // Repair paths deserialized from a user-supplied `--apply-repairs <file>` JSON are
  // an arbitrary string[] — nothing stops `__proto__`/`constructor`/`prototype` from
  // appearing. Without a guard, `setAt(draft, ["__proto__", "x"], v)` walks onto
  // Object.prototype itself (`cur["__proto__"]` returns the real prototype object,
  // which passes the "is a plain object" check) and pollutes it process-wide.
  describe("prototype pollution guard", () => {
    it("throws instead of traversing __proto__", () => {
      const obj: Record<string, unknown> = {};
      expect(() => setAt(obj, ["__proto__", "polluted"], "PWNED")).toThrow(/dangerous key/);
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
      expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
    });

    it("throws instead of traversing constructor.prototype", () => {
      const obj: Record<string, unknown> = {};
      expect(() => setAt(obj, ["constructor", "prototype", "polluted"], "PWNED")).toThrow(/dangerous key/);
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it("throws when the dangerous key is the final segment, not just an intermediate one", () => {
      const obj: Record<string, unknown> = {};
      expect(() => setAt(obj, ["a", "__proto__"], { polluted: "PWNED" })).toThrow(/dangerous key/);
    });

    it("still allows an ordinary key that merely contains the word proto", () => {
      const obj: Record<string, unknown> = {};
      setAt(obj, ["protocol"], "https");
      expect(obj).toEqual({ protocol: "https" });
    });
  });
});

describe("resolveWithinRoots", () => {
  it("allows a path nested under a root", () => {
    const resolved = resolveWithinRoots("/proj/docs/notes", ["/proj"]);
    expect(resolved).toBe("/proj/docs/notes");
  });

  it("allows a root itself", () => {
    const resolved = resolveWithinRoots("/proj", ["/proj"]);
    expect(resolved).toBe("/proj");
  });

  it("rejects a `..` traversal that escapes the only root", () => {
    const resolved = resolveWithinRoots("/proj/../../etc/evil", ["/proj"]);
    expect(resolved).toBeNull();
  });

  it("rejects an absolute path outside every root", () => {
    const resolved = resolveWithinRoots("/etc/passwd", ["/proj"]);
    expect(resolved).toBeNull();
  });

  it("rejects a sibling directory whose name merely starts with the root's name", () => {
    // `/proj-evil` is not under `/proj` even though the string starts with it —
    // a naive `startsWith` check would wrongly allow this.
    const resolved = resolveWithinRoots("/proj-evil/x", ["/proj"]);
    expect(resolved).toBeNull();
  });

  it("allows a path under any one of several roots", () => {
    expect(resolveWithinRoots("/plugin/templates/x.json", ["/proj", "/plugin"])).toBe(
      "/plugin/templates/x.json",
    );
  });

  it("resolves a relative target against cwd before checking containment", () => {
    const resolved = resolveWithinRoots("some/relative/path", [process.cwd()]);
    expect(resolved).toBe(`${process.cwd()}/some/relative/path`);
  });
});

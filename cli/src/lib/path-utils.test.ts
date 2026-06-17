import { describe, expect, it } from "bun:test";
import { setAt } from "./path-utils.js";

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
});

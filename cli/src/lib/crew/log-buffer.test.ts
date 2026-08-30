import { describe, expect, test } from "bun:test";
import { LogBuffer } from "./log-buffer.js";

describe("LogBuffer", () => {
  test("returns pushed lines in order", () => {
    const buf = new LogBuffer();
    buf.push("a");
    buf.push("b");
    expect(buf.recent()).toEqual(["a", "b"]);
  });

  test("drops the oldest lines once past capacity", () => {
    const buf = new LogBuffer(3);
    buf.push("a");
    buf.push("b");
    buf.push("c");
    buf.push("d");
    expect(buf.recent()).toEqual(["b", "c", "d"]);
  });

  test("recent(limit) returns only the last `limit` lines", () => {
    const buf = new LogBuffer();
    for (const l of ["a", "b", "c", "d"]) buf.push(l);
    expect(buf.recent(2)).toEqual(["c", "d"]);
  });

  test("recent() on an empty buffer is []", () => {
    expect(new LogBuffer().recent()).toEqual([]);
  });
});

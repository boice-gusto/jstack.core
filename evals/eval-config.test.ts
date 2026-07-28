import { describe, expect, test } from "bun:test";
import { numberFromEnv, sanitizePassThreshold } from "./eval-config.js";

describe("numberFromEnv", () => {
  test("unset falls back to the default", () => {
    expect(numberFromEnv(undefined, 100)).toBe(100);
  });

  // Number("") === 0 in JS. Without normalization, an accidentally-empty env var
  // (e.g. a blank CI template variable: `JSTACK_EVAL_COVERAGE_MIN=`) would silently
  // become "0" — fully disabling a coverage/threshold gate — instead of falling back
  // to the strict default.
  test("empty string falls back to the default, not 0", () => {
    expect(numberFromEnv("", 100)).toBe(100);
  });

  test("whitespace-only string falls back to the default, not 0", () => {
    expect(numberFromEnv("   ", 100)).toBe(100);
  });

  test("a non-numeric string falls back to the default rather than becoming NaN", () => {
    expect(numberFromEnv("abc", 100)).toBe(100);
  });

  test("the literal string 'NaN' falls back to the default", () => {
    expect(numberFromEnv("NaN", 100)).toBe(100);
  });

  test("an explicit numeric override is honored, including 0", () => {
    expect(numberFromEnv("0", 100)).toBe(0);
  });

  test("an explicit negative override is honored (caller's documented escape hatch)", () => {
    expect(numberFromEnv("-5", 100)).toBe(-5);
  });

  test("a normal numeric override is honored", () => {
    expect(numberFromEnv("42", 100)).toBe(42);
  });

  test("surrounding whitespace around a real number is trimmed", () => {
    expect(numberFromEnv("  90  ", 100)).toBe(90);
  });
});

describe("sanitizePassThreshold — a skill's own eval-config.yaml cannot make itself un-failable", () => {
  test("0 falls back to the default (pass_rate >= 0 is always true otherwise)", () => {
    expect(sanitizePassThreshold(0, 80)).toBe(80);
  });

  test("a negative threshold falls back to the default", () => {
    expect(sanitizePassThreshold(-10, 80)).toBe(80);
  });

  test("undefined falls back to the default", () => {
    expect(sanitizePassThreshold(undefined, 80)).toBe(80);
  });

  test("NaN falls back to the default", () => {
    expect(sanitizePassThreshold(Number.NaN, 80)).toBe(80);
  });

  test("a normal positive threshold is honored", () => {
    expect(sanitizePassThreshold(90, 80)).toBe(90);
  });

  test("a low but positive threshold is honored (author's call, not un-failable)", () => {
    expect(sanitizePassThreshold(1, 80)).toBe(1);
  });
});

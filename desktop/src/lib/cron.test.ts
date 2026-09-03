import { describe, expect, test } from "vitest";
import { describeCron, validateCron } from "./cron";

describe("validateCron", () => {
  test("accepts a plain 5-field expression", () => {
    expect(validateCron("0 9 * * *")).toBeNull();
  });

  test("accepts ranges, lists, and steps", () => {
    expect(validateCron("*/15 9-17 * * 1-5")).toBeNull();
    expect(validateCron("0,30 9 * * 1,3,5")).toBeNull();
  });

  test("rejects the wrong field count", () => {
    expect(validateCron("0 9 * *")).toMatch(/5 fields/);
    expect(validateCron("0 9 * * * *")).toMatch(/5 fields/);
  });

  test("rejects garbage in a field", () => {
    expect(validateCron("banana 9 * * *")).toMatch(/minute/);
  });
});

describe("describeCron", () => {
  test("describes a daily time", () => {
    expect(describeCron("0 9 * * *")).toBe("Every day at 9:00 AM");
    expect(describeCron("30 13 * * *")).toBe("Every day at 1:30 PM");
  });

  test("describes weekday and weekend shorthand", () => {
    expect(describeCron("0 9 * * 1-5")).toBe("Every weekday at 9:00 AM");
    expect(describeCron("0 9 * * 0,6")).toBe("Every weekend day at 9:00 AM");
  });

  test("describes a single named day", () => {
    expect(describeCron("0 9 * * 1")).toBe("Every Monday at 9:00 AM");
  });

  test("describes an interval-minute schedule", () => {
    expect(describeCron("*/15 * * * *")).toBe("Every 15 minutes");
  });

  test("returns null for invalid or exotic expressions instead of guessing", () => {
    expect(describeCron("0 9 * *")).toBeNull();
    expect(describeCron("0 9 15 * *")).toBeNull();
    expect(describeCron("0 9 * * 2,4")).toBeNull();
  });
});

import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { SemanticSummary } from "./report.js";
import { runTargetsAndReport } from "./run-evals.js";

const reportsDir = join(import.meta.dirname, ".reports");

function fakeSummary(skillName: string): SemanticSummary {
  return {
    skill_name: skillName,
    timestamp: "2026-01-01T00:00:00.000Z",
    total_cases: 1,
    total_passed: 1,
    total_criteria: 1,
    pass_rate: 1,
    total_time: 0,
    total_tokens: 0,
    total_cost_usd: 0,
    results: [],
  };
}

describe("runTargetsAndReport", () => {
  it("returns 0 and skips the multi-report when there's a single passing target", () => {
    const before = existsSync(join(reportsDir, "REPORT_LATEST.md"))
      ? readFileSync(join(reportsDir, "REPORT_LATEST.md"), "utf8")
      : null;
    const code = runTargetsAndReport(["a"], 0.8, (rel) => ({
      summary: fakeSummary(rel),
      passed: true,
    }));
    expect(code).toBe(0);
    const after = existsSync(join(reportsDir, "REPORT_LATEST.md"))
      ? readFileSync(join(reportsDir, "REPORT_LATEST.md"), "utf8")
      : null;
    expect(after).toBe(before);
  });

  it("returns 1 when any target fails, and returns 1 when runOne throws", () => {
    const failCode = runTargetsAndReport(["a"], 0.8, () => ({
      summary: fakeSummary("a"),
      passed: false,
    }));
    expect(failCode).toBe(1);

    const errSpy: unknown[] = [];
    const origError = console.error;
    console.error = (...a: unknown[]) => errSpy.push(a);
    try {
      const throwCode = runTargetsAndReport(["a"], 0.8, () => {
        throw new Error("boom");
      });
      expect(throwCode).toBe(1);
      // one console.error for the thrown error, plus one for the resulting empty-parts gate
      expect(errSpy.length).toBe(2);
    } finally {
      console.error = origError;
    }
  });

  it("skips a target when runOne returns null, without affecting pass/fail", () => {
    const code = runTargetsAndReport(["skip-me", "b"], 0.8, (rel) =>
      rel === "skip-me" ? null : { summary: fakeSummary(rel), passed: true },
    );
    expect(code).toBe(0);
  });

  it("errors with exit 1 when there are zero targets to run (uniform empty-target gate)", () => {
    const origError = console.error;
    const errSpy: unknown[] = [];
    console.error = (...a: unknown[]) => errSpy.push(a);
    try {
      const code = runTargetsAndReport([], 0.8, () => ({
        summary: fakeSummary("unused"),
        passed: true,
      }));
      expect(code).toBe(1);
      expect(
        errSpy.some((a) => String(a[0]).includes("No matching skills to run")),
      ).toBe(true);
    } finally {
      console.error = origError;
    }
  });

  it("errors with exit 1 when every target is skipped via null (all skips -> zero parts)", () => {
    const code = runTargetsAndReport(["a", "b"], 0.8, () => null);
    expect(code).toBe(1);
  });

  it("writes a multi-skill report and REPORT_LATEST.md when more than one target ran", () => {
    const code = runTargetsAndReport(["m1", "m2"], 0.8, (rel) => ({
      summary: fakeSummary(rel),
      passed: true,
    }));
    expect(code).toBe(0);
    expect(existsSync(join(reportsDir, "REPORT_LATEST.md"))).toBe(true);
    const latest = readFileSync(join(reportsDir, "REPORT_LATEST.md"), "utf8");
    expect(latest).toContain("m1");
    expect(latest).toContain("m2");
    rmSync(join(reportsDir, "REPORT_LATEST.md"), { force: true });
  });
});

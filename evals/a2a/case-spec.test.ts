import { describe, expect, test } from "bun:test";
import { validateCaseSpec } from "./case-spec.js";

/**
 * `validateCaseSpec` exists to prevent one malformed case from crashing the entire a2a suite:
 * `run.ts`'s old blind `c as CaseSpec` cast let a case with a missing/malformed `subject` reach
 * `exerciseSubject`'s `switch (spec.kind)` with `spec` as `undefined`, throwing synchronously
 * inside a worker with no per-case try/catch. These tests pin the exact shapes that used to
 * reach that crash.
 */
describe("validateCaseSpec", () => {
  test("accepts a well-formed case", () => {
    const r = validateCaseSpec(
      {
        id: "ok",
        surface: "cli",
        description: "d",
        subject: { kind: "cli", command: ["status"] },
      },
      "ok.yaml",
    );
    expect(r.ok).toBe(true);
  });

  test("rejects a case with no subject at all (the exact shape that used to crash exerciseSubject)", () => {
    const r = validateCaseSpec(
      { id: "bad", surface: "cli", description: "d" },
      "bad.yaml",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.message).toContain("missing 'subject'");
      expect(r.error.sourceFile).toBe("bad.yaml");
    }
  });

  test("rejects a case whose subject has no kind", () => {
    const r = validateCaseSpec(
      {
        id: "bad",
        surface: "cli",
        description: "d",
        subject: { command: ["status"] },
      },
      "bad.yaml",
    );
    expect(r.ok).toBe(false);
  });

  test("rejects a case whose subject.kind is not one of the known kinds", () => {
    const r = validateCaseSpec(
      {
        id: "bad",
        surface: "cli",
        description: "d",
        subject: { kind: "not-a-real-kind" },
      },
      "bad.yaml",
    );
    expect(r.ok).toBe(false);
  });

  test("rejects a case missing id or surface", () => {
    expect(
      validateCaseSpec({ surface: "cli", subject: { kind: "cli" } }, "x.yaml")
        .ok,
    ).toBe(false);
    expect(
      validateCaseSpec({ id: "a", subject: { kind: "cli" } }, "x.yaml").ok,
    ).toBe(false);
  });

  test("rejects a non-object case (e.g. a bare string or null in a YAML list)", () => {
    expect(validateCaseSpec("just a string", "x.yaml").ok).toBe(false);
    expect(validateCaseSpec(null, "x.yaml").ok).toBe(false);
  });
});

import { describe, expect, test } from "bun:test";
import { WorkflowStepSchema } from "./workflow.js";

/**
 * WorkflowStepSchema used to be a flat object with every field optional, so a `goto` with no
 * `url` or a `fill` with no `value` parsed successfully -- semantically incomplete steps that
 * would silently no-op or under-describe at run/show time. It's now a discriminated union
 * requiring the field(s) each kind actually needs. This was manually verified during that fix
 * (via safeParse against the pre-fix schema) but never captured as a regression test.
 */
describe("WorkflowStepSchema", () => {
  test("rejects a goto step with no url", () => {
    const result = WorkflowStepSchema.safeParse({ id: "s1", kind: "goto" });
    expect(result.success).toBe(false);
  });

  test("rejects a fill step with no value", () => {
    const result = WorkflowStepSchema.safeParse({
      id: "s1",
      kind: "fill",
      selector: "#x",
    });
    expect(result.success).toBe(false);
  });

  test("rejects a fill step with no selector", () => {
    const result = WorkflowStepSchema.safeParse({
      id: "s1",
      kind: "fill",
      value: "hello",
    });
    expect(result.success).toBe(false);
  });

  test("rejects a click step with no selector", () => {
    const result = WorkflowStepSchema.safeParse({ id: "s1", kind: "click" });
    expect(result.success).toBe(false);
  });

  test("rejects a wait step with no selector", () => {
    const result = WorkflowStepSchema.safeParse({ id: "s1", kind: "wait" });
    expect(result.success).toBe(false);
  });

  test("accepts every kind with exactly its required fields", () => {
    const validSteps = [
      { id: "s1", kind: "goto", url: "https://example.com" },
      { id: "s2", kind: "click", selector: "#btn" },
      { id: "s3", kind: "fill", selector: "#field", value: "hello" },
      { id: "s4", kind: "wait", selector: "#done" },
      { id: "s5", kind: "screenshot" },
      { id: "s6", kind: "ai", notes: "figure it out" },
    ];
    for (const step of validSteps) {
      const result = WorkflowStepSchema.safeParse(step);
      expect(result.success).toBe(true);
    }
  });

  test("screenshot and ai steps need no field beyond notes", () => {
    expect(
      WorkflowStepSchema.safeParse({ id: "s1", kind: "screenshot" }).success,
    ).toBe(true);
    expect(WorkflowStepSchema.safeParse({ id: "s1", kind: "ai" }).success).toBe(
      true,
    );
  });
});

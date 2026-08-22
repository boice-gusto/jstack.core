import { describe, expect, test } from "bun:test";
import { CrewConfigSchema } from "./types.js";

/** Smallest input `CrewConfigSchema.parse` accepts -- mirrors the fixture in guards.test.ts. */
function minimalConfig(extra: Record<string, unknown> = {}) {
  return {
    slack: { self_user_id: "U0TESTUSER1" },
    agents: {
      ralph: { name: "Ralph", sigils: ["!ralph"], workspace: "/tmp/ws" },
    },
    policy: {
      ingress: { channels: ["D0TESTDM001"], authors: ["U0TESTUSER1"] },
      egress: { channels: ["D0TESTDM001"] },
    },
    ...extra,
  };
}

/**
 * `budget` and `slack.reactions` used to declare their wrapper `.default({...})` as a hand-typed
 * literal duplicating each field's own `.default(...)` -- two independent sources of the same
 * numbers, kept in sync only by convention. Zod's `.default({})` on a wrapper does NOT re-invoke
 * the inner per-field defaults, so a key OMITTED entirely (falls through to the wrapper default)
 * and a key PRESENT but empty (falls through to each field's own default) could silently diverge
 * if the wrapper literal were ever edited without updating the field defaults, or vice versa.
 * These tests pin the invariant that both paths produce the identical result.
 */
describe("CrewConfigSchema — budget/reactions defaults agree whether the key is omitted or present-empty", () => {
  test("budget: omitted vs. present-but-empty parse identically", () => {
    const omitted = CrewConfigSchema.parse(minimalConfig());
    const presentEmpty = CrewConfigSchema.parse(minimalConfig({ budget: {} }));
    expect(presentEmpty.budget).toEqual(omitted.budget);
    expect(omitted.budget).toEqual({ daily_usd: 20, per_task_usd: 1 });
  });

  test("slack.reactions: omitted vs. present-but-empty parse identically", () => {
    const omitted = CrewConfigSchema.parse(minimalConfig());
    const presentEmpty = CrewConfigSchema.parse(
      minimalConfig({
        slack: { self_user_id: "U0TESTUSER1", reactions: {} },
      }),
    );
    expect(presentEmpty.slack.reactions).toEqual(omitted.slack.reactions);
    expect(omitted.slack.reactions).toEqual({
      seen: "eyes",
      done: "white_check_mark",
      failed: "warning",
      enabled: true,
    });
  });
});

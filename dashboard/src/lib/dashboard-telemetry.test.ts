import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { clearBuffer, snapshotBuffer } from "@jstack/telemetry/collector";

import { recordDashboardAgentRun } from "@/lib/dashboard-telemetry";

/**
 * Exercises against the REAL `telemetry/collector.ts` buffer rather than a mock -- it's a plain
 * in-memory array with no I/O, so there's nothing worth mocking, and asserting against the real
 * `snapshotBuffer()` is the same thing `telemetry/cli.ts`'s own `flush` action does. The repo's
 * `jstack.config.json` has `telemetry.enabled: false`, so the flush half of
 * `recordDashboardAgentRun` (which reads that config) is a safe no-op here -- no network call.
 */
describe("recordDashboardAgentRun", () => {
  beforeEach(() => {
    clearBuffer();
  });

  afterEach(() => {
    clearBuffer();
  });

  it("records token totals summed from usage, including cache fields", () => {
    recordDashboardAgentRun({
      surface: "agent",
      skillId: null,
      startedAt: Date.now() - 1500,
      success: true,
      usage: {
        input_tokens: 2,
        cache_creation_input_tokens: 100,
        cache_read_input_tokens: 10,
        output_tokens: 5,
      },
    });
    const events = snapshotBuffer();
    expect(events).toHaveLength(1);
    expect(events[0]?.token_input).toBe(112);
    expect(events[0]?.token_output).toBe(5);
    expect(events[0]?.token_total).toBe(117);
    expect(events[0]?.success).toBe(true);
    expect(events[0]?.skill_category).toBe("dashboard");
    expect(events[0]?.latency_ms).toBeGreaterThanOrEqual(1500);
  });

  it("falls back to a surface-derived skill_name when no skillId was used", () => {
    recordDashboardAgentRun({
      surface: "wizard",
      skillId: null,
      startedAt: Date.now(),
      success: true,
      usage: null,
    });
    const events = snapshotBuffer();
    expect(events[0]?.skill_name).toBe("dashboard-wizard");
    expect(events[0]?.token_input).toBe(0);
    expect(events[0]?.token_output).toBe(0);
  });

  it("uses the real skillId as skill_name when one was selected", () => {
    recordDashboardAgentRun({
      surface: "agent",
      skillId: "jstack:recon",
      startedAt: Date.now(),
      success: true,
      usage: null,
    });
    const events = snapshotBuffer();
    expect(events[0]?.skill_name).toBe("jstack:recon");
  });

  it("records failure with an error_type instead of throwing", () => {
    expect(() =>
      recordDashboardAgentRun({
        surface: "agent",
        skillId: null,
        startedAt: Date.now(),
        success: false,
        errorType: "exit_1",
        usage: null,
      }),
    ).not.toThrow();
    const events = snapshotBuffer();
    expect(events[0]?.success).toBe(false);
    expect(events[0]?.error_type).toBe("exit_1");
  });
});

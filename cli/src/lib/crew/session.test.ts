import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CrewStore } from "./store.js";
import { CrewConfigSchema, type CrewConfig } from "./types.js";
import {
  BudgetExceededError,
  cancelManualSession,
  createManualSession,
  DisabledAgentError,
  promptManualSession,
  UnknownAgentError,
  UnknownSessionError,
} from "./session.js";

function freshStore(): CrewStore {
  return new CrewStore(mkdtempSync(join(tmpdir(), "crew-session-test-")));
}

function baseConfig(overrides: Record<string, unknown> = {}): CrewConfig {
  return CrewConfigSchema.parse({
    enabled: true,
    mode: "dry_run",
    slack: { self_user_id: "U0TESTUSER1" },
    agents: {
      ralph: {
        name: "Ralph",
        sigils: ["!ralph"],
        workspace: "/tmp/ws",
      },
      disabled_agent: {
        enabled: false,
        name: "Disabled",
        sigils: ["!disabled"],
        workspace: "/tmp/ws",
      },
    },
    policy: {
      ingress: { channels: ["D0TESTDM001"], authors: ["U0TESTUSER1"] },
      egress: { channels: ["D0TESTDM001"] },
    },
    ...overrides,
  });
}

describe("createManualSession", () => {
  test("creates a resumable session handle and session id", () => {
    const store = freshStore();
    const cfg = baseConfig();
    const { id, sessionId } = createManualSession(store, cfg, "ralph");
    expect(id).toMatch(/^ral-[a-z0-9]{4}$/);
    expect(sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    store.close();
  });

  test("two sessions for the same agent get distinct handles and session ids", () => {
    const store = freshStore();
    const cfg = baseConfig();
    const a = createManualSession(store, cfg, "ralph");
    const b = createManualSession(store, cfg, "ralph");
    expect(a.id).not.toBe(b.id);
    expect(a.sessionId).not.toBe(b.sessionId);
    store.close();
  });

  test("throws UnknownAgentError for an agent not in config", () => {
    const store = freshStore();
    expect(() => createManualSession(store, baseConfig(), "nope")).toThrow(
      UnknownAgentError,
    );
    store.close();
  });

  test("throws DisabledAgentError for a disabled agent", () => {
    const store = freshStore();
    expect(() =>
      createManualSession(store, baseConfig(), "disabled_agent"),
    ).toThrow(DisabledAgentError);
    store.close();
  });
});

describe("promptManualSession guards", () => {
  test("throws UnknownSessionError for an id that was never created", () => {
    const store = freshStore();
    expect(
      promptManualSession(store, baseConfig(), "ral-zzzz", "hi"),
    ).rejects.toThrow(UnknownSessionError);
    store.close();
  });

  test("throws UnknownAgentError if the session's agent no longer exists in config", () => {
    const store = freshStore();
    const { id } = createManualSession(store, baseConfig(), "ralph");
    const cfgWithoutRalph = baseConfig({
      agents: { disabled_agent: baseConfig().agents.disabled_agent },
    });
    expect(
      promptManualSession(store, cfgWithoutRalph, id, "hi"),
    ).rejects.toThrow(UnknownAgentError);
    store.close();
  });

  test("throws BudgetExceededError once the daily cap is exhausted", () => {
    const store = freshStore();
    const cfg = baseConfig({ budget: { daily_usd: 1, per_task_usd: 2 } });
    const { id } = createManualSession(store, cfg, "ralph");
    // per_task_usd (2) alone exceeds daily_usd (1), so the very first reserve() call fails.
    expect(promptManualSession(store, cfg, id, "hi")).rejects.toThrow(
      BudgetExceededError,
    );
    store.close();
  });
});

describe("cancelManualSession", () => {
  test("marks the session cancelled", () => {
    const store = freshStore();
    const { id } = createManualSession(store, baseConfig(), "ralph");
    cancelManualSession(store, id);
    const row = store.recentTasks(50).find((r) => r.id === id);
    expect(row?.state).toBe("cancelled");
    store.close();
  });

  test("throws UnknownSessionError for an id that was never created", () => {
    const store = freshStore();
    expect(() => cancelManualSession(store, "ral-zzzz")).toThrow(
      UnknownSessionError,
    );
    store.close();
  });
});

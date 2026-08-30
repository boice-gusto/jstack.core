import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CrewStore } from "./store.js";
import { CrewConfigSchema, type CrewConfig } from "./types.js";
import {
  BudgetExceededError,
  cancelManualSession,
  createManualSession,
  DisabledAgentError,
  listManualSessions,
  promptManualSession,
  rememberInSession,
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

/** Fake `claude` that dumps its own argv (which ends in the prompt, per runClaude's `-- prompt`
 * convention) to a file, so a test can inspect what was actually sent instead of only what the
 * fake chose to answer. */
function installArgvCapturingFakeClaude(): {
  restorePath: string;
  argvFile: string;
} {
  const dir = mkdtempSync(join(tmpdir(), "fake-claude-argv-capture-"));
  const argvFile = join(dir, "argv.txt");
  writeFileSync(
    join(dir, "claude"),
    [
      "#!/bin/sh",
      `printf '%s\\n' "$@" > ${argvFile}`,
      'echo \'{"is_error":false,"result":"ok","total_cost_usd":0.001}\'',
    ].join("\n"),
  );
  chmodSync(join(dir, "claude"), 0o755);
  const restorePath = process.env.PATH ?? "";
  process.env.PATH = `${dir}:${restorePath}`;
  return { restorePath, argvFile };
}

describe("promptManualSession memory recall", () => {
  let restorePath: string | undefined;

  afterEach(() => {
    if (restorePath !== undefined) process.env.PATH = restorePath;
  });

  test("a fact remembered for an agent is injected into a later prompt for that same agent", async () => {
    const store = freshStore();
    const cfg = baseConfig();
    const fake = installArgvCapturingFakeClaude();
    restorePath = fake.restorePath;

    const { id } = createManualSession(store, cfg, "ralph");
    rememberInSession(store, cfg, id, {
      kind: "fact",
      source: "user-stated",
      content: "The user's Q3 deadline is October 15.",
    });

    await promptManualSession(store, cfg, id, "When is the deadline?");

    const sentArgv = readFileSync(fake.argvFile, "utf8");
    expect(sentArgv).toContain("Relevant memory:");
    expect(sentArgv).toContain("October 15");
    store.close();
  });

  test("a fact remembered for one agent is not injected into a different agent's session", async () => {
    const store = freshStore();
    const cfg = baseConfig({
      agents: {
        ...baseConfig().agents,
        scout: { name: "Scout", sigils: ["!scout"], workspace: "/tmp/ws" },
      },
    });
    const fake = installArgvCapturingFakeClaude();
    restorePath = fake.restorePath;

    const ralphSession = createManualSession(store, cfg, "ralph");
    rememberInSession(store, cfg, ralphSession.id, {
      kind: "fact",
      source: "user-stated",
      content: "Ralph-only fact about zephyr-42.",
    });

    const scoutSession = createManualSession(store, cfg, "scout");
    // Deliberately doesn't repeat "zephyr-42" here -- asserting on it below would be confounded
    // by it appearing in this very question, not by a real recall leak.
    await promptManualSession(
      store,
      cfg,
      scoutSession.id,
      "anything interesting to report?",
    );

    const sentArgv = readFileSync(fake.argvFile, "utf8");
    expect(sentArgv).not.toContain("Relevant memory:");
    expect(sentArgv).not.toContain("zephyr-42");
    store.close();
  });

  test("no memory yet: the prompt is sent unchanged, with no 'Relevant memory' block", async () => {
    const store = freshStore();
    const cfg = baseConfig();
    const fake = installArgvCapturingFakeClaude();
    restorePath = fake.restorePath;

    const { id } = createManualSession(store, cfg, "ralph");
    await promptManualSession(store, cfg, id, "hello");

    const sentArgv = readFileSync(fake.argvFile, "utf8");
    expect(sentArgv).not.toContain("Relevant memory:");
    store.close();
  });
});

describe("listManualSessions", () => {
  test("lists sessions newest first with derived state and turn count", () => {
    const store = freshStore();
    const cfg = baseConfig();
    const a = createManualSession(store, cfg, "ralph");
    const b = createManualSession(store, cfg, "ralph");

    const sessions = listManualSessions(store, cfg);
    expect(sessions.map((s) => s.id)).toEqual([b.id, a.id]);
    expect(sessions[0]?.agentId).toBe("ralph");
    expect(sessions[0]?.turns).toBe(1);
    store.close();
  });

  test("does not include Slack-originated tasks", () => {
    const store = freshStore();
    const cfg = baseConfig();
    createManualSession(store, cfg, "ralph");
    // A Slack task uses a real channel id, never MANUAL_CHANNEL_ID.
    store.createTask(
      "slk-1234",
      "D0TESTDM001",
      "1.1",
      "1.1",
      "some-session",
      "ralph",
    );

    const sessions = listManualSessions(store, cfg);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.id).not.toBe("slk-1234");
    store.close();
  });

  test("respects the limit parameter", () => {
    const store = freshStore();
    const cfg = baseConfig();
    for (let i = 0; i < 5; i++) createManualSession(store, cfg, "ralph");
    expect(listManualSessions(store, cfg, 2)).toHaveLength(2);
    store.close();
  });
});

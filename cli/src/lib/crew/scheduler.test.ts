import { afterEach, describe, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runDueScheduledPrompts } from "./scheduler.js";
import { CrewStore } from "./store.js";
import { CrewConfigSchema, type CrewConfig } from "./types.js";

function freshStore(): CrewStore {
  return new CrewStore(mkdtempSync(join(tmpdir(), "crew-scheduler-test-")));
}

function baseConfig(): CrewConfig {
  return CrewConfigSchema.parse({
    enabled: true,
    mode: "dry_run",
    state_dir: mkdtempSync(join(tmpdir(), "crew-scheduler-cfg-")),
    slack: { self_user_id: "U0TESTUSER1" },
    agents: {
      ralph: { name: "Ralph", sigils: ["!ralph"], workspace: "/tmp/ws" },
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
  });
}

/** Same fake-claude technique as session.test.ts/rpc-server.test.ts. */
function installFakeClaude(): { restorePath: string } {
  const dir = mkdtempSync(join(tmpdir(), "fake-claude-bin-scheduler-"));
  writeFileSync(
    join(dir, "claude"),
    '#!/bin/sh\necho \'{"type":"result","is_error":false,"result":"scheduled reply","total_cost_usd":0.001}\'\n',
  );
  chmodSync(join(dir, "claude"), 0o755);
  const restorePath = process.env.PATH ?? "";
  process.env.PATH = `${dir}:${restorePath}`;
  return { restorePath };
}

/** Same fake, but also answers a Slack-send call -- distinguished from a manual-session prompt
 * turn by argv shape: runWorkerStreaming's `--output-format stream-json` vs slack.ts's
 * runClaude's blocking `--output-format json` (used for the Slack MCP tool call integrations.ts
 * makes). Records every Slack-send call's prompt text to a file so a test can assert on it. */
function installFakeClaudeWithSlackSend(): {
  restorePath: string;
  slackSendLogFile: string;
} {
  const dir = mkdtempSync(join(tmpdir(), "fake-claude-bin-scheduler-slack-"));
  const slackSendLogFile = join(dir, "slack-send.log");
  writeFileSync(
    join(dir, "claude"),
    [
      "#!/bin/sh",
      'for arg in "$@"; do',
      '  if [ "$arg" = "stream-json" ]; then',
      '    echo \'{"type":"result","is_error":false,"result":"scheduled reply","total_cost_usd":0.001}\'',
      "    exit 0",
      "  fi",
      "done",
      `printf '%s\\n' "$@" >> ${slackSendLogFile}`,
      'echo \'{"is_error":false,"result":"{\\"message_ts\\": \\"1700000000.123456\\"}","total_cost_usd":0.0005}\'',
    ].join("\n"),
  );
  chmodSync(join(dir, "claude"), 0o755);
  const restorePath = process.env.PATH ?? "";
  process.env.PATH = `${dir}:${restorePath}`;
  return { restorePath, slackSendLogFile };
}

// A cron that matches every minute, so "is this due right now" never depends on the wall clock.
const EVERY_MINUTE = "* * * * *";

describe("runDueScheduledPrompts", () => {
  let restorePath: string | undefined;

  afterEach(() => {
    if (restorePath !== undefined) process.env.PATH = restorePath;
  });

  test("a never-evaluated schedule matching the current minute runs, creating its own session on first run", async () => {
    restorePath = installFakeClaude().restorePath;
    const store = freshStore();
    const cfg = baseConfig();
    store.createScheduledPrompt({
      id: "sch-a1",
      agentId: "ralph",
      prompt: "What's new?",
      cron: EVERY_MINUTE,
    });

    const results = await runDueScheduledPrompts(store, cfg, Date.now());
    expect(results).toEqual([{ id: "sch-a1", ran: true, ok: true }]);

    const row = store.listScheduledPrompts()[0]!;
    expect(row.sessionId).toMatch(/^ral-[a-z0-9]{4}$/);
    expect(row.lastRunOk).toBe(true);
    expect(row.lastEvaluatedMs).not.toBeNull();
  });

  test("a second evaluation in the same minute does not re-run (already evaluated through now)", async () => {
    restorePath = installFakeClaude().restorePath;
    const store = freshStore();
    const cfg = baseConfig();
    store.createScheduledPrompt({
      id: "sch-a1",
      agentId: "ralph",
      prompt: "hi",
      cron: EVERY_MINUTE,
    });

    const now = Date.now();
    await runDueScheduledPrompts(store, cfg, now);
    const second = await runDueScheduledPrompts(store, cfg, now + 1);
    expect(second).toEqual([
      { id: "sch-a1", ran: false, reason: "already evaluated through now" },
    ]);
  });

  test("resumes the same session on a later due run instead of creating a new one", async () => {
    restorePath = installFakeClaude().restorePath;
    const store = freshStore();
    const cfg = baseConfig();
    store.createScheduledPrompt({
      id: "sch-a1",
      agentId: "ralph",
      prompt: "hi",
      cron: EVERY_MINUTE,
    });

    const now = Date.now();
    await runDueScheduledPrompts(store, cfg, now);
    const sessionAfterFirst = store.listScheduledPrompts()[0]!.sessionId;

    await runDueScheduledPrompts(store, cfg, now + 60_000);
    const sessionAfterSecond = store.listScheduledPrompts()[0]!.sessionId;
    expect(sessionAfterSecond).toBe(sessionAfterFirst);
  });

  test("a schedule with notifyChannel pushes the result to Slack via the jstack notification template", async () => {
    const fake = installFakeClaudeWithSlackSend();
    restorePath = fake.restorePath;
    const store = freshStore();
    const cfg = baseConfig();
    store.createScheduledPrompt({
      id: "sch-a1",
      agentId: "ralph",
      prompt: "hi",
      cron: EVERY_MINUTE,
      notifyChannel: "D0MYDM001",
    });

    const results = await runDueScheduledPrompts(store, cfg, Date.now());
    expect(results).toEqual([{ id: "sch-a1", ran: true, ok: true }]);

    const slackSendArgv = readFileSync(fake.slackSendLogFile, "utf8");
    expect(slackSendArgv).toContain("D0MYDM001");
    expect(slackSendArgv).toContain(
      ":robot_face: - scheduled reply - sent by jstack",
    );
  });

  test("a schedule with no notifyChannel never calls Slack at all", async () => {
    const fake = installFakeClaudeWithSlackSend();
    restorePath = fake.restorePath;
    const store = freshStore();
    const cfg = baseConfig();
    store.createScheduledPrompt({
      id: "sch-a1",
      agentId: "ralph",
      prompt: "hi",
      cron: EVERY_MINUTE,
    });

    await runDueScheduledPrompts(store, cfg, Date.now());
    expect(existsSync(fake.slackSendLogFile)).toBe(false);
  });

  test("a disabled schedule is skipped even when due", async () => {
    const store = freshStore();
    const cfg = baseConfig();
    store.createScheduledPrompt({
      id: "sch-a1",
      agentId: "ralph",
      prompt: "hi",
      cron: EVERY_MINUTE,
    });
    store.setScheduledPromptEnabled("sch-a1", false);

    const results = await runDueScheduledPrompts(store, cfg, Date.now());
    expect(results).toEqual([{ id: "sch-a1", ran: false, reason: "disabled" }]);
  });

  test("a schedule pointed at a disabled agent records a failed run instead of throwing or blocking other schedules", async () => {
    restorePath = installFakeClaude().restorePath;
    const store = freshStore();
    const cfg = baseConfig();
    store.createScheduledPrompt({
      id: "sch-bad",
      agentId: "disabled_agent",
      prompt: "hi",
      cron: EVERY_MINUTE,
    });
    store.createScheduledPrompt({
      id: "sch-good",
      agentId: "ralph",
      prompt: "hi",
      cron: EVERY_MINUTE,
    });

    const results = await runDueScheduledPrompts(store, cfg, Date.now());
    const bad = results.find((r) => r.id === "sch-bad")!;
    const good = results.find((r) => r.id === "sch-good")!;
    expect(bad.ran).toBe(true);
    expect(bad.ok).toBe(false);
    expect(good).toEqual({ id: "sch-good", ran: true, ok: true });
  });

  test("a cron that never matches never runs", async () => {
    const store = freshStore();
    const cfg = baseConfig();
    // Feb 30th never exists.
    store.createScheduledPrompt({
      id: "sch-a1",
      agentId: "ralph",
      prompt: "hi",
      cron: "0 0 30 2 *",
    });

    const results = await runDueScheduledPrompts(store, cfg, Date.now());
    expect(results[0]!.ran).toBe(false);
  });
});

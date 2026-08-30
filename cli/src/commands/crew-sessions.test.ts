import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runSessionCancel, runSessionNew, runSessionPrompt } from "./crew.js";
import { CrewStore } from "../lib/crew/store.js";

/**
 * `runWorker` (via `slack.ts`'s `runClaude`) spawns the literal binary name `"claude"`,
 * resolved through `PATH` -- not overridable via env or config. Prepending a temp dir holding
 * a fake `claude` script to `PATH` is the only way to exercise `runSessionPrompt`'s full path
 * (including `runWorker`'s flag-building) without a real `claude` CLI/API key, mirroring how
 * `provider.test.ts` fakes `claude`/`codex` binaries directly rather than mocking spawn.
 */
function installFakeClaude(): { dir: string; restorePath: string } {
  const dir = mkdtempSync(join(tmpdir(), "fake-claude-bin-"));
  const script = [
    "#!/bin/sh",
    'echo \'{"is_error":false,"result":"fake reply","total_cost_usd":0.001,"session_id":"11111111-1111-1111-1111-111111111111"}\'',
  ].join("\n");
  writeFileSync(join(dir, "claude"), `${script}\n`);
  chmodSync(join(dir, "claude"), 0o755);
  const restorePath = process.env.PATH ?? "";
  process.env.PATH = `${dir}:${restorePath}`;
  return { dir, restorePath };
}

function mkFixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "jstack-crew-sessions-"));
  writeFileSync(
    join(root, "jstack.config.json"),
    JSON.stringify({
      crew: {
        enabled: true,
        mode: "dry_run",
        state_dir: join(root, "crew-state"),
        slack: { self_user_id: "U0TESTUSER1" },
        agents: {
          ralph: { name: "Ralph", sigils: ["!ralph"], workspace: root },
        },
        policy: {
          ingress: { channels: ["D0TESTDM001"], authors: ["U0TESTUSER1"] },
          egress: { channels: ["D0TESTDM001"] },
        },
      },
    }),
  );
  mkdirSync(join(root, "crew-state"), { recursive: true });
  return root;
}

describe("crew sessions CLI: new -> prompt -> cancel", () => {
  const savedRoot = process.env.JSTACK_PROJECT_ROOT;
  let root: string;
  let fakeClaude: { dir: string; restorePath: string };
  let logs: string[];
  let errors: string[];
  const originalLog = console.log;
  const originalError = console.error;

  beforeEach(() => {
    root = mkFixtureRoot();
    process.env.JSTACK_PROJECT_ROOT = root;
    fakeClaude = installFakeClaude();
    process.exitCode = 0;
    logs = [];
    errors = [];
    console.log = (msg?: unknown) => {
      logs.push(String(msg));
    };
    console.error = (msg?: unknown) => {
      errors.push(String(msg));
    };
  });

  afterEach(() => {
    console.log = originalLog;
    console.error = originalError;
    if (savedRoot === undefined) delete process.env.JSTACK_PROJECT_ROOT;
    else process.env.JSTACK_PROJECT_ROOT = savedRoot;
    process.env.PATH = fakeClaude.restorePath;
    process.exitCode = 0;
  });

  test("creates a session, prompts it, and cancels it end to end", async () => {
    runSessionNew("ralph", true);
    const created = JSON.parse(logs.at(-1) ?? "{}") as {
      id: string;
      sessionId: string;
    };
    expect(created.id).toMatch(/^ral-[a-z0-9]{4}$/);

    logs = [];
    await runSessionPrompt(created.id, "hello there", true);
    const promptResult = JSON.parse(logs.at(-1) ?? "{}") as {
      ok: boolean;
      text: string;
      costUsd: number;
    };
    expect(promptResult.ok).toBe(true);
    expect(promptResult.text).toBe("fake reply");
    expect(promptResult.costUsd).toBeCloseTo(0.001, 5);
    expect(errors).toHaveLength(0);

    // A second turn should resume rather than fail (the fake binary ignores argv either way,
    // but a real claude with --session-id on a used id, or --resume on an unused one, errors --
    // this at least proves the second call doesn't throw and the store's turn count advances).
    logs = [];
    await runSessionPrompt(created.id, "follow up", true);
    expect(errors).toHaveLength(0);

    const store = new CrewStore(join(root, "crew-state"));
    const row = store.recentTasks(50).find((r) => r.id === created.id);
    expect(row?.turns).toBe(2);
    store.close();

    logs = [];
    runSessionCancel(created.id, true);
    const cancelResult = JSON.parse(logs.at(-1) ?? "{}") as { ok: boolean };
    expect(cancelResult.ok).toBe(true);
  });

  test("prompting an unknown session id fails cleanly", async () => {
    await expect(runSessionPrompt("ral-zzzz", "hi", true)).rejects.toThrow();
  });
});

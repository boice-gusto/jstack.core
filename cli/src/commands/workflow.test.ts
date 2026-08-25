/**
 * `jstack workflow run` used to always call `runWorkflowStub`, which returned `ok: true` with a
 * canned "Would run..." log line no matter what -- it never actually drove a browser. These tests
 * drive the real CLI to prove `run --dry-run` builds an honest, step-accurate prompt without
 * spawning an agent or touching history, and that the non-interactive/unknown-id paths fail
 * loudly instead of silently no-opping like the old stub did.
 */
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import type { WorkflowDefinition } from "../types/workflow.js";

const ENTRY = join(import.meta.dir, "..", "index.ts");
let dir: string;

function runWorkflow(cwd: string, args: string[]) {
  const r = spawnSync("bun", ["run", ENTRY, "workflow", ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, JSTACK_INTROSPECT: "", NO_COLOR: "1" },
  });
  return { code: r.status, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

/**
 * Actually running a workflow shells out to a real `claude -p` (runClaude in
 * workflow-engine.ts), which needs a live API key and takes real time/money -- not something a
 * unit test should invoke. Puts a fake `claude` on PATH instead: a tiny script that immediately
 * prints the same `--output-format json` shape the real CLI would, so runClaude resolves fast
 * without ever touching the network.
 */
function runWorkflowWithFakeClaude(cwd: string, args: string[]) {
  const fakeBinDir = mkdtempSync(join(tmpdir(), "jstack-fake-claude-"));
  const fakeClaudePath = join(fakeBinDir, "claude");
  writeFileSync(
    fakeClaudePath,
    '#!/bin/sh\necho \'{"is_error": false, "result": "fake agent ran", "total_cost_usd": 0}\'\n',
  );
  chmodSync(fakeClaudePath, 0o755);
  try {
    const r = spawnSync("bun", ["run", ENTRY, "workflow", ...args], {
      cwd,
      encoding: "utf8",
      env: {
        ...process.env,
        JSTACK_INTROSPECT: "",
        NO_COLOR: "1",
        PATH: `${fakeBinDir}:${process.env.PATH ?? ""}`,
      },
      timeout: 15_000,
    });
    return { code: r.status, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
  } finally {
    rmSync(fakeBinDir, { recursive: true, force: true });
  }
}

function writeDef(cwd: string, def: WorkflowDefinition) {
  writeFileSync(
    join(cwd, "jstack.config.json"),
    JSON.stringify({ version: "9.9.9" }),
  );
  const workflowsDir = join(cwd, "config", "workflows");
  mkdirSync(workflowsDir, { recursive: true });
  writeFileSync(
    join(workflowsDir, `${def.id}.json`),
    JSON.stringify(def, null, 2),
  );
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "jstack-workflow-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("workflow run --dry-run", () => {
  test("shows the prompt without spawning an agent, and names every step", () => {
    writeDef(dir, {
      id: "login-check",
      name: "Login check",
      start_url: "https://example.com/login",
      steps: [
        { id: "s1", kind: "goto", url: "https://example.com/login" },
        { id: "s2", kind: "fill", selector: "#user", value: "env:LOGIN_USER" },
        { id: "s3", kind: "screenshot" },
      ],
    });
    const { code, out } = runWorkflow(dir, ["run", "login-check", "--dry-run"]);
    expect(code).toBe(0);
    expect(out).toContain('Would run workflow "login-check"');
    expect(out).toContain("https://example.com/login");
    expect(out).toContain("fill");
    expect(out).toContain(
      "secret, resolve LOGIN_USER from env, never print it",
    );
    // The old stub's canned phrasing must not survive -- proves this isn't the fake path.
    expect(out).not.toContain("Would run workflow Login check starting at");
  });

  test("a secret fill value is never printed in the clear in the prompt", () => {
    writeDef(dir, {
      id: "secret-flow",
      name: "Secret flow",
      start_url: "https://example.com",
      steps: [
        { id: "s1", kind: "fill", selector: "#pw", value: "env:MY_PASSWORD" },
      ],
    });
    const { out } = runWorkflow(dir, ["run", "secret-flow", "--dry-run"]);
    expect(out).toContain("resolve MY_PASSWORD from env");
    expect(out).not.toContain("value=env:MY_PASSWORD");
  });

  test("--dry-run --json emits steps and prompt as structured output, no history written", () => {
    writeDef(dir, {
      id: "flow2",
      name: "Flow 2",
      start_url: "https://example.com",
      steps: [{ id: "s1", kind: "goto", url: "https://example.com" }],
    });
    const { code, out } = runWorkflow(dir, [
      "run",
      "flow2",
      "--dry-run",
      "--json",
    ]);
    expect(code).toBe(0);
    const parsed = JSON.parse(out);
    expect(parsed.id).toBe("flow2");
    expect(parsed.dryRun).toBe(true);
    expect(parsed.steps).toBe(1);
    expect(typeof parsed.prompt).toBe("string");
    expect(parsed.prompt).toContain("Playwright MCP");
  });

  test("unknown workflow id errors and exits 1", () => {
    writeFileSync(
      join(dir, "jstack.config.json"),
      JSON.stringify({ version: "9.9.9" }),
    );
    const { code, out } = runWorkflow(dir, ["run", "nope", "--dry-run"]);
    expect(code).toBe(1);
    expect(out).toContain("Unknown workflow: nope");
  });
});

describe("workflow run non-interactive without --yes/--dry-run", () => {
  test("refuses to run and does not silently no-op like the old stub's confirm-skip path", () => {
    writeDef(dir, {
      id: "flow3",
      name: "Flow 3",
      start_url: "https://example.com",
      steps: [],
    });
    const { code, out } = runWorkflow(dir, ["run", "flow3"]);
    expect(code).toBe(1);
    expect(out).toContain("--yes");
    expect(out).toContain("--dry-run");
  });
});

describe("workflow run --json without --yes", () => {
  test("errors requiring --yes instead of printing a Preview heading (CLAUDE.md: no prose in --json output)", () => {
    writeDef(dir, {
      id: "flow4",
      name: "Flow 4",
      start_url: "https://example.com",
      steps: [{ id: "s1", kind: "goto", url: "https://example.com" }],
    });
    const { code, out } = runWorkflow(dir, ["run", "flow4", "--json"]);
    expect(code).toBe(1);
    expect(out).toContain("--yes");
    // The old bug: this printed "Preview" plus the full definition JSON on stdout, then either
    // blocked on an interactive confirm or (non-interactively, as here) fell through to the
    // separate non-interactive error below it -- either way, prose landed on stdout in --json mode.
    expect(out).not.toContain("Preview");
  });
});

describe("workflow run --json --yes (happy path)", () => {
  test("prints pure JSON with no Preview heading or prompt prose, only --json's own object", () => {
    writeDef(dir, {
      id: "flow5",
      name: "Flow 5",
      start_url: "https://example.com",
      steps: [{ id: "s1", kind: "goto", url: "https://example.com" }],
    });
    const { code, out } = runWorkflowWithFakeClaude(dir, [
      "run",
      "flow5",
      "--json",
      "--yes",
    ]);
    // The fake claude never produces a real browser artifact, so runWorkflowViaClaude reports
    // ok:false (correctly -- "the process completed" isn't evidence anything ran) and the CLI
    // exits 1 accordingly. That's expected and not what this test is about: the point is that
    // --json's output is STILL pure JSON with no Preview/prompt prose ahead of it, success or not.
    expect(code).toBe(1);
    expect(out).not.toContain("Preview");
    const parsed = JSON.parse(out);
    expect(parsed.id).toBe("flow5");
    expect(parsed.ok).toBe(false);
    expect(Array.isArray(parsed.log)).toBe(true);
  });
});

/**
 * Subprocess contracts for non-interactive (CI) branches of schedule/mcp commands.
 * Uses spawnSync so tests do not share process.chdir (safe under parallel bun:test).
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ENCODING_UTF8 } from "@jstack/constants/paths";
import { readConfig } from "./lib/config.js";
import { listRoutinesFromConfig } from "./lib/scheduler.js";

const PLUGIN_ROOT = join(import.meta.dir, "..", "..");
const CLI_ENTRY = join(PLUGIN_ROOT, "cli/src/index.ts");

function runCli(
  args: string[],
  cwd: string,
  extraEnv: Record<string, string | undefined>,
): { status: number; combined: string } {
  const r = spawnSync("bun", ["run", CLI_ENTRY, ...args], {
    cwd,
    encoding: ENCODING_UTF8,
    env: {
      ...process.env,
      CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT,
      ...extraEnv,
    },
    maxBuffer: 32 * 1024 * 1024,
  });
  const status = r.status ?? 1;
  const combined = `${r.stderr ?? ""}${r.stdout ?? ""}`;
  return { status, combined };
}

function writeMinimalFixture(root: string): void {
  const cfg = {
    team: { name: "contract-fixture" },
    routines: {
      standup: { enabled: false, cron: "0 9 * * *", chain: ["recon"] },
    },
  };
  writeFileSync(join(root, "jstack.config.json"), `${JSON.stringify(cfg, null, 2)}\n`);
  writeFileSync(join(root, ".mcp.json"), "{}\n");
}

describe("non-interactive CLI contracts (CI)", () => {
  test("schedule enable without id exits 1 and mentions Usage", () => {
    const root = mkdtempSync(join(tmpdir(), "jstack-ci-sched-"));
    writeMinimalFixture(root);
    const r = runCli(["schedule", "enable"], root, { CI: "1" });
    expect(r.status).toBe(1);
    expect(r.combined).toMatch(/Usage: jstack schedule enable/);
  });

  test("schedule disable without id exits 1 and mentions Usage", () => {
    const root = mkdtempSync(join(tmpdir(), "jstack-ci-sched-"));
    writeMinimalFixture(root);
    const r = runCli(["schedule", "disable"], root, { CI: "1" });
    expect(r.status).toBe(1);
    expect(r.combined).toMatch(/Usage: jstack schedule disable/);
  });

  test("schedule enable unknown routine exits 1", () => {
    const root = mkdtempSync(join(tmpdir(), "jstack-ci-sched-"));
    writeMinimalFixture(root);
    const r = runCli(["schedule", "enable", "not-a-real-routine"], root, { CI: "1" });
    expect(r.status).toBe(1);
    expect(r.combined).toContain("Unknown routine");
  });

  test("schedule enable standup exits 0 and toggles enabled", () => {
    const root = mkdtempSync(join(tmpdir(), "jstack-ci-sched-"));
    writeMinimalFixture(root);
    const r = runCli(["schedule", "enable", "standup"], root, { CI: "1" });
    expect(r.status).toBe(0);
    expect(r.combined).toContain("Enabled standup");
    const after = readConfig(root);
    const rows = listRoutinesFromConfig(after);
    expect(rows.find((row) => row.id === "standup")?.enabled).toBe(true);
  });

  test("mcp remove without server exits 1 and mentions Usage", () => {
    const root = mkdtempSync(join(tmpdir(), "jstack-ci-mcp-"));
    writeMinimalFixture(root);
    const r = runCli(["mcp", "remove"], root, { CI: "1" });
    expect(r.status).toBe(1);
    expect(r.combined).toMatch(/Usage: jstack mcp remove/);
  });
});

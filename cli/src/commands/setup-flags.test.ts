/**
 * `jstack setup` has 3 disjoint modes (--schema / --ci / legacy interactive) dispatched from
 * one flat 8-flag commander namespace in cli/src/index.ts. A flag meant for one mode used to be
 * silently accepted and then never read under another (e.g. `--non-interactive` without
 * `--schema` ran the full interactive prompt flow anyway). These tests drive the real CLI to
 * confirm each cross-mode combination is now rejected loudly, before any mode's wizard starts --
 * no existing test file covered `jstack setup`'s dispatch at all.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const ENTRY = join(import.meta.dir, "..", "index.ts");

function runSetup(cwd: string, args: string[]) {
  const r = spawnSync("bun", ["run", ENTRY, "setup", ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
    timeout: 10_000,
  });
  return { code: r.status, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

describe("jstack setup — cross-mode flag validation", () => {
  let dir: string;

  test("--non-interactive without --schema is rejected", () => {
    dir = mkdtempSync(join(tmpdir(), "jstack-setup-flags-"));
    try {
      const { code, out } = runSetup(dir, ["--non-interactive"]);
      expect(code).toBe(1);
      expect(out).toContain(
        "--section/--non-interactive only apply with --schema",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("--section without --schema is rejected", () => {
    dir = mkdtempSync(join(tmpdir(), "jstack-setup-flags-"));
    try {
      const { code, out } = runSetup(dir, ["--section", "team"]);
      expect(code).toBe(1);
      expect(out).toContain(
        "--section/--non-interactive only apply with --schema",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("--pe with --ci is rejected", () => {
    dir = mkdtempSync(join(tmpdir(), "jstack-setup-flags-"));
    try {
      const { code, out } = runSetup(dir, ["--ci", "--pe"]);
      expect(code).toBe(1);
      expect(out).toContain(
        "--pe/--with-gbrain-kb only apply to the interactive",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("--with-gbrain-kb with --schema is rejected", () => {
    dir = mkdtempSync(join(tmpdir(), "jstack-setup-flags-"));
    try {
      const { code, out } = runSetup(dir, [
        "--schema",
        "--with-gbrain-kb",
        "--non-interactive",
      ]);
      expect(code).toBe(1);
      expect(out).toContain(
        "--pe/--with-gbrain-kb only apply to the interactive",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("--schema alone (a valid, applicable combination) is not rejected by the new checks", () => {
    dir = mkdtempSync(join(tmpdir(), "jstack-setup-flags-"));
    try {
      const { out } = runSetup(dir, ["--schema", "--non-interactive"]);
      expect(out).not.toContain("only apply with --schema");
      expect(out).not.toContain("only apply to the interactive");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

/**
 * `runSetupCi` calls `discoverFromMcpJson` (reading the project's real `.mcp.json`) and then
 * used to unconditionally overwrite that same file with `"{}\n"` a few lines later -- silently
 * destroying any real MCP server registrations. Reproduced live against this exact code before
 * the fix: a `.mcp.json` with a real `mcpServers` entry came back as `{}` after `setup --ci`.
 */
describe("jstack setup --ci never destroys an existing .mcp.json", () => {
  test("a real .mcp.json survives setup --ci untouched", () => {
    const dir = mkdtempSync(join(tmpdir(), "jstack-setup-ci-mcp-"));
    try {
      const mcpPath = join(dir, ".mcp.json");
      const realMcpJson = JSON.stringify({
        mcpServers: {
          "real-playwright": { command: "npx", args: ["@playwright/mcp"] },
        },
      });
      writeFileSync(mcpPath, realMcpJson, "utf8");

      const { code } = runSetup(dir, ["--ci"]);
      expect(code).toBe(0);
      expect(readFileSync(mcpPath, "utf8")).toBe(realMcpJson);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a missing .mcp.json is still created fresh (the original intent of the write)", () => {
    const dir = mkdtempSync(join(tmpdir(), "jstack-setup-ci-mcp-"));
    try {
      const mcpPath = join(dir, ".mcp.json");
      const { code } = runSetup(dir, ["--ci"]);
      expect(code).toBe(0);
      expect(JSON.parse(readFileSync(mcpPath, "utf8"))).toEqual({});
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

/**
 * The setup lock used to be acquired only inside `runSetupSchema` -- `runSetup`/`runSetupCi`
 * (the other 2 of 3 dispatched modes) never checked it at all, so a `jstack setup --ci` could
 * race a concurrent `jstack setup`/`--schema` run and silently drop one run's answers. The lock
 * is now acquired once at the dispatch point in index.ts, before any mode is chosen.
 */
describe("jstack setup — the lock applies to every dispatched mode, not just --schema", () => {
  test("--ci refuses to run while another setup already holds the lock", () => {
    const dir = mkdtempSync(join(tmpdir(), "jstack-setup-lock-"));
    try {
      mkdirSync(join(dir, ".jstack"), { recursive: true });
      writeFileSync(
        join(dir, ".jstack", "setup.lock"),
        JSON.stringify({
          pid: process.pid, // this test process is alive, so the lock is not stale
          started_at: new Date().toISOString(),
          command: "jstack setup (test holder)",
        }),
      );
      const { code, out } = runSetup(dir, ["--ci"]);
      expect(code).toBe(1);
      expect(out).toContain("Another setup is already running");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

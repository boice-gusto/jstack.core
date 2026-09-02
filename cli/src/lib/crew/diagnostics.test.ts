import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runDiagnostics } from "./diagnostics.js";
import { CrewConfigSchema, type CrewConfig } from "./types.js";

function baseConfig(overrides: Record<string, unknown> = {}): CrewConfig {
  return CrewConfigSchema.parse({
    enabled: true,
    mode: "dry_run",
    slack: { self_user_id: "U0TESTUSER1" },
    agents: {
      ralph: {
        name: "Ralph",
        sigils: ["!ralph"],
        workspace: "/tmp/definitely-does-not-exist-xyz",
      },
    },
    policy: {
      ingress: { channels: ["D0TESTDM001"], authors: ["U0TESTUSER1"] },
      egress: { channels: ["D0TESTDM001"] },
    },
    ...overrides,
  });
}

/** Fake `claude` on PATH -- `--version` and `mcp list` both succeed, echoing something
 * recognizable so a test can assert the real command actually ran. */
function installFakeClaude(mcpListExitCode = 0): { restorePath: string } {
  const dir = mkdtempSync(join(tmpdir(), "fake-claude-diag-"));
  writeFileSync(
    join(dir, "claude"),
    [
      "#!/bin/sh",
      'if [ "$1" = "--version" ]; then echo "2.1.0 (Claude Code)"; exit 0; fi',
      `if [ "$1" = "mcp" ]; then echo "configured-server: some-command"; exit ${mcpListExitCode}; fi`,
      "exit 1",
    ].join("\n"),
  );
  chmodSync(join(dir, "claude"), 0o755);
  const restorePath = process.env.PATH ?? "";
  process.env.PATH = `${dir}:${restorePath}`;
  return { restorePath };
}

function withPluginRoot(hasSkills: boolean): {
  root: string;
  restore: () => void;
} {
  const root = mkdtempSync(join(tmpdir(), "jstack-diag-plugin-"));
  if (hasSkills) {
    const skillDir = join(root, "skills", "example-skill");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, "SKILL.md"),
      "---\nname: jstack-example-skill\ndescription: an example\ncategory: test\n---\nBody.\n",
    );
  }
  const saved = process.env.CLAUDE_PLUGIN_ROOT;
  process.env.CLAUDE_PLUGIN_ROOT = root;
  return {
    root,
    restore: () => {
      if (saved === undefined) delete process.env.CLAUDE_PLUGIN_ROOT;
      else process.env.CLAUDE_PLUGIN_ROOT = saved;
    },
  };
}

describe("runDiagnostics", () => {
  let restorePath: string | undefined;
  let restorePluginRoot: (() => void) | undefined;

  afterEach(() => {
    if (restorePath !== undefined) process.env.PATH = restorePath;
    restorePluginRoot?.();
    restorePluginRoot = undefined;
  });

  test("reports claude as not found when it isn't on PATH", () => {
    const savedPath = process.env.PATH;
    process.env.PATH = "/definitely/not/a/real/path";
    const plugin = withPluginRoot(false);
    restorePluginRoot = plugin.restore;

    const report = runDiagnostics(baseConfig());
    expect(report.claudeCli.found).toBe(false);
    expect(report.claudeCli.version).toBeUndefined();

    process.env.PATH = savedPath;
  });

  test("reports claude's version when it is found on PATH", () => {
    restorePath = installFakeClaude().restorePath;
    const plugin = withPluginRoot(false);
    restorePluginRoot = plugin.restore;

    const report = runDiagnostics(baseConfig());
    expect(report.claudeCli.found).toBe(true);
    expect(report.claudeCli.version).toBe("2.1.0 (Claude Code)");
  });

  test("resolves pluginRoot from CLAUDE_PLUGIN_ROOT and counts skills found there", () => {
    const plugin = withPluginRoot(true);
    restorePluginRoot = plugin.restore;

    const report = runDiagnostics(baseConfig());
    expect(report.pluginRoot.path).toBe(plugin.root);
    expect(report.pluginRoot.hasSkillsDir).toBe(true);
    expect(report.skills.count).toBe(1);
  });

  test("an agent's workspace is reported as missing when the directory doesn't exist", () => {
    const plugin = withPluginRoot(false);
    restorePluginRoot = plugin.restore;

    const report = runDiagnostics(baseConfig());
    expect(report.agents).toEqual([
      expect.objectContaining({
        id: "ralph",
        workspace: "/tmp/definitely-does-not-exist-xyz",
        workspaceExists: false,
      }),
    ]);
  });

  test("an agent's workspace is reported as present when the directory exists", () => {
    const plugin = withPluginRoot(false);
    restorePluginRoot = plugin.restore;
    const workspace = mkdtempSync(join(tmpdir(), "jstack-diag-ws-"));

    const report = runDiagnostics(
      baseConfig({
        agents: { ralph: { name: "Ralph", sigils: ["!ralph"], workspace } },
      }),
    );
    expect(report.agents[0]!.workspaceExists).toBe(true);
  });

  test("mcp.anyAgentInherits is false and claude mcp list is never invoked when no agent inherits", () => {
    restorePath = installFakeClaude().restorePath;
    const plugin = withPluginRoot(false);
    restorePluginRoot = plugin.restore;

    const report = runDiagnostics(baseConfig());
    expect(report.mcp.anyAgentInherits).toBe(false);
    expect(report.mcp.claudeMcpListOk).toBeUndefined();
  });

  test("mcp.anyAgentInherits is true and claude mcp list actually runs when an agent inherits", () => {
    restorePath = installFakeClaude().restorePath;
    const plugin = withPluginRoot(false);
    restorePluginRoot = plugin.restore;

    const report = runDiagnostics(
      baseConfig({
        agents: {
          ralph: {
            name: "Ralph",
            sigils: ["!ralph"],
            workspace: "/tmp/x",
            mcp: "inherit",
          },
        },
      }),
    );
    expect(report.mcp.anyAgentInherits).toBe(true);
    expect(report.mcp.claudeMcpListOk).toBe(true);
    expect(report.mcp.claudeMcpListDetail).toContain("configured-server");
  });

  test("a failing claude mcp list is reported as not ok, with claude's stderr as detail", () => {
    restorePath = installFakeClaude(1).restorePath;
    const plugin = withPluginRoot(false);
    restorePluginRoot = plugin.restore;

    const report = runDiagnostics(
      baseConfig({
        agents: {
          ralph: {
            name: "Ralph",
            sigils: ["!ralph"],
            workspace: "/tmp/x",
            mcp: "inherit",
          },
        },
      }),
    );
    expect(report.mcp.claudeMcpListOk).toBe(false);
  });
});

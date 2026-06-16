import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  resolveDependencies,
  type DependencyIssue,
  type RepairAction,
} from "./dependency-resolver.js";

function baseCfg(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    team: { name: "t" },
    knowledge_base: { roots: ["docs"], gbrain: { include: false } },
    knowledge_storage: {
      disk_fallback_root: "/tmp/knowledgebase",
      team: { git_remote: "", local_checkout: "" },
      personal: { git_remote: "", local_checkout: "" },
    },
    gbrain: {
      team: { url: "https://example.com/team", trust_policy: "read_write" },
      personal: { url: "https://example.com/me", trust_policy: "read_write" },
    },
    session: { default_gbrain_target: "team", current_session_id: "" },
    ...over,
  };
}

function ids(issues: DependencyIssue[]): string[] {
  return issues.map((i) => i.id);
}

function findIssue(issues: DependencyIssue[], id: string): DependencyIssue | undefined {
  return issues.find((i) => i.id === id);
}

function mkTmpRoot(prefix = "jstack-depres-"): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

describe("resolveDependencies", () => {
  test("happy path returns []", () => {
    const root = mkTmpRoot();
    mkdirSync(join(root, "docs"), { recursive: true });
    const issues = resolveDependencies({ cfg: baseCfg(), projectRoot: root });
    expect(issues).toEqual([]);
  });

  test("kb-root-missing detected when path doesn't exist", () => {
    const root = mkTmpRoot();
    const cfg = baseCfg({
      knowledge_base: { roots: ["this-folder-does-not-exist-xyz"], gbrain: { include: false } },
    });
    const issues = resolveDependencies({ cfg, projectRoot: root });
    const issue = findIssue(issues, "kb-root-missing");
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("error");
    expect(issue?.configPath).toEqual(["knowledge_base", "roots"]);
    expect(issue?.repairs[0]?.kind).toBe("mkdir");
    const mkdir = issue?.repairs[0] as Extract<RepairAction, { kind: "mkdir" }>;
    expect(mkdir.path).toBe(resolve(root, "this-folder-does-not-exist-xyz"));
  });

  test("kb-root absolute path that exists is ok", () => {
    const root = mkTmpRoot();
    const absDoc = join(root, "abs-docs");
    mkdirSync(absDoc, { recursive: true });
    const cfg = baseCfg({
      knowledge_base: { roots: [absDoc], gbrain: { include: false } },
    });
    const issues = resolveDependencies({ cfg, projectRoot: root });
    expect(ids(issues)).not.toContain("kb-root-missing");
  });

  test("ks-team-checkout-missing when remote set but checkout empty", () => {
    const root = mkTmpRoot();
    mkdirSync(join(root, "docs"), { recursive: true });
    const cfg = baseCfg({
      knowledge_storage: {
        disk_fallback_root: "/tmp/knowledgebase",
        team: { git_remote: "https://github.com/org/team-kb.git", local_checkout: "" },
        personal: { git_remote: "", local_checkout: "" },
      },
    });
    const issues = resolveDependencies({ cfg, projectRoot: root });
    const issue = findIssue(issues, "ks-team-checkout-missing");
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("warn");
    const repair = issue?.repairs[0] as Extract<RepairAction, { kind: "shell_hint" }>;
    expect(repair.kind).toBe("shell_hint");
    expect(repair.cmd).toContain("git clone https://github.com/org/team-kb.git");
  });

  test("ks-personal-checkout-not-on-disk when path is missing", () => {
    const root = mkTmpRoot();
    mkdirSync(join(root, "docs"), { recursive: true });
    const cfg = baseCfg({
      knowledge_storage: {
        disk_fallback_root: "/tmp/knowledgebase",
        team: { git_remote: "", local_checkout: "" },
        personal: {
          git_remote: "https://github.com/me/personal-kb.git",
          local_checkout: "missing-personal-kb",
        },
      },
    });
    const issues = resolveDependencies({ cfg, projectRoot: root });
    const issue = findIssue(issues, "ks-personal-checkout-not-on-disk");
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("error");
    // Two repairs: mkdir + clone hint
    expect(issue?.repairs.length).toBe(2);
    expect(issue?.repairs[0]?.kind).toBe("mkdir");
    expect(issue?.repairs[1]?.kind).toBe("shell_hint");
  });

  test("ks-team-checkout-not-on-disk without remote yields only mkdir repair", () => {
    const root = mkTmpRoot();
    mkdirSync(join(root, "docs"), { recursive: true });
    const cfg = baseCfg({
      knowledge_storage: {
        disk_fallback_root: "/tmp/knowledgebase",
        team: { git_remote: "", local_checkout: "missing-team-kb" },
        personal: { git_remote: "", local_checkout: "" },
      },
    });
    const issues = resolveDependencies({ cfg, projectRoot: root });
    const issue = findIssue(issues, "ks-team-checkout-not-on-disk");
    expect(issue).toBeDefined();
    expect(issue?.repairs.length).toBe(1);
    expect(issue?.repairs[0]?.kind).toBe("mkdir");
  });

  test("gbrain-target-empty-url detected for team target", () => {
    const root = mkTmpRoot();
    mkdirSync(join(root, "docs"), { recursive: true });
    const cfg = baseCfg({
      knowledge_base: { roots: ["docs"], gbrain: { include: true } },
      gbrain: {
        team: { url: "", trust_policy: "read_write" },
        personal: { url: "https://example.com/me", trust_policy: "read_write" },
      },
      session: { default_gbrain_target: "team" },
    });
    const issues = resolveDependencies({ cfg, projectRoot: root });
    const issue = findIssue(issues, "gbrain-target-empty-url");
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("warn");
    expect(issue?.configPath).toEqual(["gbrain", "team", "url"]);
    // First repair turns off the include
    const setCfg = issue?.repairs[0] as Extract<RepairAction, { kind: "set_config" }>;
    expect(setCfg.kind).toBe("set_config");
    expect(setCfg.path).toEqual(["knowledge_base", "gbrain", "include"]);
    expect(setCfg.value).toBe(false);
  });

  test("gbrain-target-empty-url detected for personal target", () => {
    const root = mkTmpRoot();
    mkdirSync(join(root, "docs"), { recursive: true });
    const cfg = baseCfg({
      knowledge_base: { roots: ["docs"], gbrain: { include: true } },
      gbrain: {
        team: { url: "https://example.com/team", trust_policy: "read_write" },
        personal: { url: "", trust_policy: "read_write" },
      },
      session: { default_gbrain_target: "personal" },
    });
    const issues = resolveDependencies({ cfg, projectRoot: root });
    const issue = findIssue(issues, "gbrain-target-empty-url");
    expect(issue).toBeDefined();
    expect(issue?.configPath).toEqual(["gbrain", "personal", "url"]);
  });

  test("gbrain-target-empty-url not raised when include is false", () => {
    const root = mkTmpRoot();
    mkdirSync(join(root, "docs"), { recursive: true });
    const cfg = baseCfg({
      knowledge_base: { roots: ["docs"], gbrain: { include: false } },
      gbrain: {
        team: { url: "" },
        personal: { url: "" },
      },
      session: { default_gbrain_target: "team" },
    });
    const issues = resolveDependencies({ cfg, projectRoot: root });
    expect(ids(issues)).not.toContain("gbrain-target-empty-url");
  });

  test("mcp-mock-missing when .mcp.json absent and debug.mock_mcp=true", () => {
    const root = mkTmpRoot();
    mkdirSync(join(root, "docs"), { recursive: true });
    const cfg = baseCfg({ debug: { mock_mcp: true } });
    const issues = resolveDependencies({ cfg, projectRoot: root });
    const issue = findIssue(issues, "mcp-mock-missing");
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("warn");
    expect(issue?.message).toContain(".mcp.json is missing");
    const repair = issue?.repairs[0] as Extract<RepairAction, { kind: "shell_hint" }>;
    expect(repair.cmd).toBe("jstack mcp add jstack-mock");
  });

  test("mcp-mock-missing when .mcp.json present but lacks jstack-mock entry", () => {
    const root = mkTmpRoot();
    mkdirSync(join(root, "docs"), { recursive: true });
    writeFileSync(
      join(root, ".mcp.json"),
      JSON.stringify({ mcpServers: { other: { command: "node", args: ["other.js"] } } }),
      "utf8",
    );
    const cfg = baseCfg({ debug: { mock_mcp: true } });
    const issues = resolveDependencies({ cfg, projectRoot: root });
    const issue = findIssue(issues, "mcp-mock-missing");
    expect(issue).toBeDefined();
    expect(issue?.message).toContain("no jstack-mock server entry");
  });

  test("mcp-mock-missing not raised when .mcp.json has jstack-mock entry", () => {
    const root = mkTmpRoot();
    mkdirSync(join(root, "docs"), { recursive: true });
    writeFileSync(
      join(root, ".mcp.json"),
      JSON.stringify({
        mcpServers: {
          "jstack-mock": { command: "bun", args: ["run", "/somewhere/mcp-mock/server.ts"] },
        },
      }),
      "utf8",
    );
    const cfg = baseCfg({ debug: { mock_mcp: true } });
    const issues = resolveDependencies({ cfg, projectRoot: root });
    expect(ids(issues)).not.toContain("mcp-mock-missing");
  });

  test("required-integrations-empty detected for ['jira'] with empty integrations.jira", () => {
    const root = mkTmpRoot();
    mkdirSync(join(root, "docs"), { recursive: true });
    const cfg = baseCfg({
      onboarding: { required_integrations: ["jira"] },
      integrations: { jira: { project_key: "" } },
    });
    const issues = resolveDependencies({ cfg, projectRoot: root });
    const issue = findIssue(issues, "required-integrations-empty");
    expect(issue).toBeDefined();
    expect(issue?.configPath).toEqual(["integrations", "jira"]);
    const repair = issue?.repairs[0] as Extract<RepairAction, { kind: "shell_hint" }>;
    expect(repair.cmd).toBe("jstack setup --reconfigure");
  });

  test("required-integrations-empty not raised when integration has a non-empty string", () => {
    const root = mkTmpRoot();
    mkdirSync(join(root, "docs"), { recursive: true });
    const cfg = baseCfg({
      onboarding: { required_integrations: ["jira"] },
      integrations: { jira: { project_key: "ENG" } },
    });
    const issues = resolveDependencies({ cfg, projectRoot: root });
    expect(ids(issues)).not.toContain("required-integrations-empty");
  });

  test("cross-plugins-gbrain enabled + empty skills detected", () => {
    const root = mkTmpRoot();
    mkdirSync(join(root, "docs"), { recursive: true });
    const cfg = baseCfg({
      cross_plugins: { gbrain: { enabled: true, skills: [] } },
    });
    const issues = resolveDependencies({ cfg, projectRoot: root });
    const issue = findIssue(issues, "cross-plugins-gbrain-empty-skills");
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("warn");
    const repair = issue?.repairs[0] as Extract<RepairAction, { kind: "set_config" }>;
    expect(repair.kind).toBe("set_config");
    expect(repair.path).toEqual(["cross_plugins", "gbrain", "enabled"]);
    expect(repair.value).toBe(false);
  });

  test("cross-plugins-gbrain not raised when skills are populated", () => {
    const root = mkTmpRoot();
    mkdirSync(join(root, "docs"), { recursive: true });
    const cfg = baseCfg({
      cross_plugins: { gbrain: { enabled: true, skills: ["gbrain:search"] } },
    });
    const issues = resolveDependencies({ cfg, projectRoot: root });
    expect(ids(issues)).not.toContain("cross-plugins-gbrain-empty-skills");
  });
});

import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectDoctorConfigWarnings, collectMockMcpDoctorWarnings } from "./doctor-warnings.js";

/** jstack.core package root (cli/src/lib → ../../../). */
const PLUGIN_ROOT = join(import.meta.dir, "..", "..", "..");

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

describe("collectDoctorConfigWarnings", () => {
  test("no warnings when roots exist and gbrain.include is false (GBrain URLs optional)", () => {
    const root = mkdtempSync(join(tmpdir(), "jstack-doc-"));
    mkdirSync(join(root, "docs"), { recursive: true });
    const w = collectDoctorConfigWarnings(
      root,
      baseCfg({
        gbrain: {
          team: { url: "", trust_policy: "read_write" },
          personal: { url: "", trust_policy: "read_write" },
        },
      }),
    );
    expect(w.length).toBe(0);
  });

  test("warns when a knowledge_base root is missing on disk", () => {
    const root = mkdtempSync(join(tmpdir(), "jstack-doc-"));
    const cfg = baseCfg({
      knowledge_base: { roots: ["this-folder-does-not-exist-xyz"], gbrain: { include: false } },
    });
    const w = collectDoctorConfigWarnings(root, cfg);
    expect(w.some((m) => m.includes("this-folder-does-not-exist-xyz"))).toBe(true);
  });

  test("warns when knowledge_base.gbrain.include is true but no GBrain URLs", () => {
    const root = mkdtempSync(join(tmpdir(), "jstack-doc-"));
    mkdirSync(join(root, "docs"), { recursive: true });
    const cfg = baseCfg({
      knowledge_base: { roots: ["docs"], gbrain: { include: true } },
      gbrain: {
        team: { url: "", trust_policy: "read_write" },
        personal: { url: "", trust_policy: "read_write" },
      },
    });
    const w = collectDoctorConfigWarnings(root, cfg);
    expect(w.some((m) => m.includes("gbrain.include is true"))).toBe(true);
  });

  test("warns when team git_remote set but local_checkout empty", () => {
    const root = mkdtempSync(join(tmpdir(), "jstack-doc-"));
    mkdirSync(join(root, "docs"), { recursive: true });
    const cfg = baseCfg({
      knowledge_storage: {
        disk_fallback_root: "/tmp/knowledgebase",
        team: { git_remote: "https://github.com/org/team-kb.git", local_checkout: "" },
        personal: { git_remote: "", local_checkout: "" },
      },
    });
    const w = collectDoctorConfigWarnings(root, cfg);
    expect(w.some((m) => m.includes("knowledge_storage.team.git_remote"))).toBe(true);
  });

  test("warns when knowledge_storage team local_checkout path missing", () => {
    const root = mkdtempSync(join(tmpdir(), "jstack-doc-"));
    mkdirSync(join(root, "docs"), { recursive: true });
    const cfg = baseCfg({
      knowledge_storage: {
        disk_fallback_root: "/tmp/knowledgebase",
        team: { git_remote: "", local_checkout: "missing-team-kb-dir" },
        personal: { git_remote: "", local_checkout: "" },
      },
    });
    const w = collectDoctorConfigWarnings(root, cfg);
    expect(w.some((m) => m.includes("knowledge_storage.team.local_checkout"))).toBe(true);
  });

  test("absolute root path is resolved without duplicating project root", () => {
    const root = mkdtempSync(join(tmpdir(), "jstack-doc-"));
    const absDoc = join(root, "abs-docs");
    mkdirSync(absDoc, { recursive: true });
    const cfg = baseCfg({
      knowledge_base: { roots: [absDoc], gbrain: { include: false } },
    });
    const w = collectDoctorConfigWarnings(root, cfg);
    expect(w.length).toBe(0);
  });

  test("warns when skills.machine_readable.enabled is false", () => {
    const root = mkdtempSync(join(tmpdir(), "jstack-doc-"));
    mkdirSync(join(root, "docs"), { recursive: true });
    const cfg = baseCfg({
      skills: { machine_readable: { enabled: false, require_schema_ref: false } },
    });
    const w = collectDoctorConfigWarnings(root, cfg);
    expect(w.some((m) => m.includes("skills.machine_readable.enabled is false"))).toBe(true);
    expect(w.some((m) => m.includes("require_schema_ref"))).toBe(false);
  });

  test("warns when skills.machine_readable.require_schema_ref is true", () => {
    const root = mkdtempSync(join(tmpdir(), "jstack-doc-"));
    mkdirSync(join(root, "docs"), { recursive: true });
    const cfg = baseCfg({
      skills: { machine_readable: { enabled: true, require_schema_ref: true } },
    });
    const w = collectDoctorConfigWarnings(root, cfg);
    expect(w.some((m) => m.includes("require_schema_ref is true"))).toBe(true);
  });

  test("effective enabled false from defaults when user omits skills", () => {
    const root = mkdtempSync(join(tmpdir(), "jstack-doc-"));
    mkdirSync(join(root, "docs"), { recursive: true });
    const w = collectDoctorConfigWarnings(root, baseCfg(), {
      skills: { machine_readable: { enabled: false, require_schema_ref: false } },
    });
    expect(w.some((m) => m.includes("skills.machine_readable.enabled is false"))).toBe(true);
  });
});

describe("collectMockMcpDoctorWarnings", () => {
  test("returns nothing when debug.mock_mcp is not true", () => {
    const root = mkdtempSync(join(tmpdir(), "jstack-mock-doc-"));
    const w = collectMockMcpDoctorWarnings(root, PLUGIN_ROOT, { debug: { mock_mcp: false } });
    expect(w).toEqual([]);
  });

  test("warns when mock_mcp is true but .mcp.json is missing", () => {
    const root = mkdtempSync(join(tmpdir(), "jstack-mock-doc-"));
    const w = collectMockMcpDoctorWarnings(root, PLUGIN_ROOT, {
      debug: { mock_mcp: true, mock_mcp_scenario: "default" },
    });
    expect(w.some((m) => m.includes(".mcp.json is missing"))).toBe(true);
  });

  test("no mock warnings when .mcp.json has jstack-mock and scenario exists", () => {
    const root = mkdtempSync(join(tmpdir(), "jstack-mock-doc-"));
    writeFileSync(
      join(root, ".mcp.json"),
      JSON.stringify({
        mcpServers: {
          "jstack-mock": {
            command: "bun",
            args: ["run", join(PLUGIN_ROOT, "mcp-mock/server.ts")],
          },
        },
      }),
      "utf8",
    );
    const w = collectMockMcpDoctorWarnings(root, PLUGIN_ROOT, {
      debug: { mock_mcp: true, mock_mcp_scenario: "default" },
    });
    expect(w).toEqual([]);
  });

  test("warns when scenario directory has no scenario.json", () => {
    const root = mkdtempSync(join(tmpdir(), "jstack-mock-doc-"));
    writeFileSync(
      join(root, ".mcp.json"),
      JSON.stringify({
        mcpServers: {
          "jstack-mock": {
            command: "bun",
            args: ["run", join(PLUGIN_ROOT, "mcp-mock/server.ts")],
          },
        },
      }),
      "utf8",
    );
    const w = collectMockMcpDoctorWarnings(root, PLUGIN_ROOT, {
      debug: { mock_mcp: true, mock_mcp_scenario: "definitely-missing-scenario-xyz" },
    });
    expect(w.some((m) => m.includes("scenario file is missing"))).toBe(true);
  });

  test("uses JSTACK_MCP_FIXTURE_ROOT from .mcp.json when pluginRoot is not the real bundle (isolated project dir)", () => {
    const root = mkdtempSync(join(tmpdir(), "jstack-mock-isolated-"));
    const wrongPluginRoot = root;
    const fixtureRoot = join(PLUGIN_ROOT, "mcp-mock");
    writeFileSync(
      join(root, ".mcp.json"),
      JSON.stringify({
        mcpServers: {
          "jstack-mock": {
            command: "bun",
            args: ["run", join(fixtureRoot, "server.ts")],
            env: { JSTACK_MCP_FIXTURE_ROOT: fixtureRoot },
          },
        },
      }),
      "utf8",
    );
    const w = collectMockMcpDoctorWarnings(root, wrongPluginRoot, {
      debug: { mock_mcp: true, mock_mcp_scenario: "default" },
    });
    expect(w.filter((m) => m.includes("scenario file is missing"))).toEqual([]);
  });
});

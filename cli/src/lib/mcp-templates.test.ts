import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { listPresetIds, resolvePreset } from "./mcp-templates.js";

describe("resolvePreset — ordinary presets", () => {
  test("memory resolves to its static spec (no env)", () => {
    const spec = resolvePreset("memory", "/some/project");
    expect(spec).toEqual({
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-memory"],
    });
  });

  test("fetch resolves to its static spec (no env)", () => {
    const spec = resolvePreset("fetch", "/some/project");
    expect(spec).toEqual({
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-fetch"],
    });
  });

  test("is case-insensitive on id", () => {
    const spec = resolvePreset("MEMORY", "/some/project");
    expect(spec).toEqual({
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-memory"],
    });
  });

  test("unknown preset id returns undefined", () => {
    expect(resolvePreset("does-not-exist", "/some/project")).toBeUndefined();
  });
});

describe("resolvePreset — env-placeholder stripping", () => {
  test("github strips the unresolved PAT placeholder", () => {
    const spec = resolvePreset("github", "/some/project");
    expect(spec).toEqual({
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
    });
    expect(spec?.env).toBeUndefined();
  });

  test("glean strips all unresolved placeholders and omits env entirely", () => {
    const spec = resolvePreset("glean", "/some/project");
    expect(spec).toEqual({
      command: "npx",
      args: ["-y", "@gleanwork/mcp-server"],
    });
    expect(spec?.env).toBeUndefined();
  });
});

describe("resolvePreset — filesystem", () => {
  test("appends the resolved project root to args", () => {
    const spec = resolvePreset("filesystem", "some/relative/project");
    expect(spec).toEqual({
      command: "npx",
      args: [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        resolve("some/relative/project"),
      ],
    });
  });

  test("has no env field", () => {
    const spec = resolvePreset("filesystem", "/some/project");
    expect(spec?.env).toBeUndefined();
  });
});

describe("resolvePreset — jstack-mock", () => {
  test("returns undefined without a pluginRoot", () => {
    expect(resolvePreset("jstack-mock", "/some/project")).toBeUndefined();
    expect(resolvePreset("jstack-mock", "/some/project", {})).toBeUndefined();
  });

  test("defaults scenario to 'default' when none given", () => {
    const spec = resolvePreset("jstack-mock", "/some/project", {
      pluginRoot: "/plugin-root",
    });
    expect(spec).toEqual({
      command: "bun",
      args: ["run", "/plugin-root/mcp-mock/server.ts"],
      env: {
        JSTACK_MCP_FIXTURE_ROOT: "/plugin-root/mcp-mock",
        JSTACK_MCP_SCENARIO: "default",
      },
    });
  });

  test("uses a provided, trimmed scenario name", () => {
    const spec = resolvePreset("jstack-mock", "/some/project", {
      pluginRoot: "/plugin-root",
      mockMcpScenario: "  custom-scenario  ",
    });
    expect(spec?.env?.JSTACK_MCP_SCENARIO).toBe("custom-scenario");
  });

  test("falls back to 'default' when scenario is blank/whitespace", () => {
    const spec = resolvePreset("jstack-mock", "/some/project", {
      pluginRoot: "/plugin-root",
      mockMcpScenario: "   ",
    });
    expect(spec?.env?.JSTACK_MCP_SCENARIO).toBe("default");
  });
});

describe("listPresetIds", () => {
  test("includes ordinary presets and the two special-cased ones, sorted", () => {
    const ids = listPresetIds();
    expect(ids).toEqual([...ids].sort());
    for (const id of [
      "github",
      "notion",
      "filesystem",
      "memory",
      "fetch",
      "glean",
      "gdrive",
      "jstack-mock",
    ]) {
      expect(ids).toContain(id);
    }
  });
});

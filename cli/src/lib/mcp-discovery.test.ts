import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  discoverFromMcpJson,
  mergeMcpRegistry,
  readMcpFile,
  type McpMergeCollision,
} from "./mcp-discovery.js";
import type { McpRegistry, McpServer } from "../types/mcp-registry.js";

function makeServer(over: Partial<McpServer> = {}): McpServer {
  return {
    label: "Server A",
    description: "stdio MCP (run-a)",
    status: "connected",
    server_id: "a",
    tools: [],
    used_by_skills: [],
    auto_discovered: true,
    ...over,
  };
}

describe("mergeMcpRegistry", () => {
  test("no collision when existing is undefined", () => {
    const discovered: McpRegistry = { a: makeServer() };
    const collisions: McpMergeCollision[] = [];
    const result = mergeMcpRegistry(undefined, discovered, { collisions });
    expect(result).toEqual({ a: makeServer() });
    expect(collisions).toHaveLength(0);
  });

  test("no collision when discovered is empty (existing only)", () => {
    const existing: McpRegistry = { a: makeServer() };
    const collisions: McpMergeCollision[] = [];
    const result = mergeMcpRegistry(existing, {}, { collisions });
    expect(result).toEqual({ a: makeServer() });
    expect(collisions).toHaveLength(0);
  });

  test("collision with auto_discovered:false keeps existing entry", () => {
    const existing: McpRegistry = {
      a: makeServer({
        label: "User Curated",
        description: "Hand-written description",
        auto_discovered: false,
        server_id: "old-id",
        tools: [{ name: "do_thing", description: "does a thing" }],
        used_by_skills: ["skill-x"],
      }),
    };
    const discovered: McpRegistry = {
      a: makeServer({
        label: "Auto Label",
        description: "stdio MCP (new-cmd)",
        server_id: "new-id",
      }),
    };
    const collisions: McpMergeCollision[] = [];
    const result = mergeMcpRegistry(existing, discovered, { collisions });

    expect(result.a).toEqual(existing.a!);
    expect(collisions).toHaveLength(1);
    expect(collisions[0]!.serverId).toBe("a");
    expect(collisions[0]!.resolution).toBe("kept_existing");
  });

  test("collision with auto_discovered:true and stale boilerplate description merges fields", () => {
    const existing: McpRegistry = {
      a: makeServer({
        label: "User Edited Label",
        description: "stdio MCP (old-cmd)", // boilerplate — should be replaced
        auto_discovered: true,
        server_id: "old-id",
        tools: [{ name: "tool1", description: "user added" }],
        used_by_skills: ["skill-y"],
        configured_at: "2025-01-01T00:00:00Z",
      }),
    };
    const discovered: McpRegistry = {
      a: makeServer({
        label: "Auto Label",
        description: "stdio MCP (new-cmd)",
        server_id: "new-id",
        tools: [],
        used_by_skills: [],
      }),
    };
    const collisions: McpMergeCollision[] = [];
    const result = mergeMcpRegistry(existing, discovered, { collisions });

    expect(result.a!.label).toBe("User Edited Label");
    expect(result.a!.tools).toEqual([
      { name: "tool1", description: "user added" },
    ]);
    expect(result.a!.used_by_skills).toEqual(["skill-y"]);
    expect(result.a!.server_id).toBe("new-id");
    expect(result.a!.description).toBe("stdio MCP (new-cmd)");
    expect(result.a!.configured_at).toBe("2025-01-01T00:00:00Z");
    expect(result.a!.auto_discovered).toBe(true);

    expect(collisions).toHaveLength(1);
    expect(collisions[0]!.serverId).toBe("a");
    expect(collisions[0]!.resolution).toBe("merged_fields");
  });

  test("collision with auto_discovered:true preserves a non-boilerplate description", () => {
    const existing: McpRegistry = {
      a: makeServer({
        label: "L",
        description: "Custom human description",
        auto_discovered: true,
        server_id: "old-id",
      }),
    };
    const discovered: McpRegistry = {
      a: makeServer({
        description: "stdio MCP (new-cmd)",
        server_id: "new-id",
      }),
    };
    const collisions: McpMergeCollision[] = [];
    const result = mergeMcpRegistry(existing, discovered, { collisions });

    expect(result.a!.description).toBe("Custom human description");
    expect(result.a!.server_id).toBe("new-id");
    expect(collisions[0]!.resolution).toBe("merged_fields");
  });

  test("calling without opts does not throw", () => {
    const existing: McpRegistry = {
      a: makeServer({ auto_discovered: false }),
    };
    const discovered: McpRegistry = { a: makeServer() };
    expect(() => mergeMcpRegistry(existing, discovered)).not.toThrow();
    const result = mergeMcpRegistry(existing, discovered);
    expect(result.a!.auto_discovered).toBe(false);
  });
});

/**
 * `readMcpFile` used to be duplicated verbatim between this module and commands/mcp.ts.
 * Previously untested on either side: a missing file and malformed JSON both fall back to `{}`
 * rather than throwing.
 */
describe("readMcpFile / discoverFromMcpJson — malformed input fails closed", () => {
  function mkProjectDir(): string {
    return mkdtempSync(join(tmpdir(), "jstack-mcp-discovery-"));
  }

  test("readMcpFile returns {} for a missing file", () => {
    const dir = mkProjectDir();
    try {
      expect(readMcpFile(join(dir, ".mcp.json"))).toEqual({});
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("readMcpFile returns {} for malformed JSON instead of throwing", () => {
    const dir = mkProjectDir();
    try {
      const p = join(dir, ".mcp.json");
      writeFileSync(p, "not valid json {{{", "utf8");
      expect(() => readMcpFile(p)).not.toThrow();
      expect(readMcpFile(p)).toEqual({});
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("discoverFromMcpJson returns an empty registry for malformed .mcp.json", () => {
    const dir = mkProjectDir();
    try {
      writeFileSync(join(dir, ".mcp.json"), "{ broken", "utf8");
      expect(discoverFromMcpJson(dir)).toEqual({});
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("discoverFromMcpJson parses a well-formed .mcp.json", () => {
    const dir = mkProjectDir();
    try {
      writeFileSync(
        join(dir, ".mcp.json"),
        JSON.stringify({
          mcpServers: { demo: { command: "node", args: ["server.js"] } },
        }),
        "utf8",
      );
      const registry = discoverFromMcpJson(dir);
      expect(registry.demo?.server_id).toBe("demo");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

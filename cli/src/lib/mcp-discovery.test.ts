import { describe, expect, test } from "bun:test";
import {
  mergeMcpRegistry,
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
        tools: [
          { name: "do_thing", description: "does a thing" },
        ],
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

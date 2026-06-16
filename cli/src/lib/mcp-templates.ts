import { join, resolve } from "node:path";

/**
 * Presets for `jstack mcp add <id>`. Commands follow common MCP stdio patterns;
 * teams may need env vars (API keys) in the host or in .mcp.json.
 */
export type McpServerSpec = {
  command: string;
  args?: string[];
  env?: Record<string, string>;
};

export type ResolvePresetOpts = {
  pluginRoot?: string;
  /** Maps to `JSTACK_MCP_SCENARIO` (directory under mcp-mock/scenarios); empty uses `default`. */
  mockMcpScenario?: string;
};

export const MCP_ADD_PRESETS: Record<string, McpServerSpec> = {
  github: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: "<set-in-host-or-env>" },
  },
  notion: {
    command: "npx",
    args: ["-y", "@notionhq/notion-mcp-server"],
    env: { NOTION_API_KEY: "<set-in-host-or-env>" },
  },
  filesystem: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem"],
  },
  memory: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory"],
  },
  fetch: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-fetch"],
  },
  glean: {
    command: "npx",
    args: ["-y", "@gleanwork/mcp-server"],
    env: {
      GLEAN_INSTANCE: "<set-in-host-or-env>",
      GLEAN_API_TOKEN: "<set-in-host-or-env>",
    },
  },
  gdrive: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-gdrive"],
  },
};

/** Resolve filesystem MCP root to project cwd when adding preset. */
export function resolvePreset(
  id: string,
  projectRoot: string,
  opts?: ResolvePresetOpts,
): McpServerSpec | undefined {
  const lower = id.toLowerCase();
  if (lower === "jstack-mock") {
    const pluginRoot = opts?.pluginRoot;
    if (!pluginRoot) return undefined;
    const scenarioRaw = opts?.mockMcpScenario?.trim() ?? "";
    const scenario = scenarioRaw.length > 0 ? scenarioRaw : "default";
    return {
      command: "bun",
      args: ["run", join(pluginRoot, "mcp-mock/server.ts")],
      env: {
        JSTACK_MCP_FIXTURE_ROOT: join(pluginRoot, "mcp-mock"),
        JSTACK_MCP_SCENARIO: scenario,
      },
    };
  }

  const base = MCP_ADD_PRESETS[lower];
  if (!base) return undefined;
  if (lower === "filesystem") {
    return {
      ...base,
      args: [...(base.args ?? []), resolve(projectRoot)],
    };
  }
  const { env, ...rest } = base;
  if (env) {
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(env)) {
      if (!v.startsWith("<")) cleaned[k] = v;
    }
    return Object.keys(cleaned).length ? { ...rest, env: cleaned } : { ...rest };
  }
  return { ...rest };
}

export function listPresetIds(): string[] {
  const ids = new Set<string>([...Object.keys(MCP_ADD_PRESETS), "jstack-mock"]);
  return [...ids].sort();
}

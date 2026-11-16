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

/**
 * A single preset entry. Ordinary presets are a static `McpServerSpec` plus an
 * optional `hint` shown in the interactive picker. Presets that need
 * per-invocation computation (e.g. resolving the project root, or requiring a
 * plugin root) provide `build` instead — `resolvePreset` calls it directly and
 * skips the generic env-placeholder-stripping applied to static entries.
 */
export type McpPresetEntry = { hint?: string } & (
  | (McpServerSpec & { build?: never })
  | {
      build: (
        projectRoot: string,
        opts?: ResolvePresetOpts,
      ) => McpServerSpec | undefined;
    }
);

export const MCP_ADD_PRESETS: Record<string, McpPresetEntry> = {
  github: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: "<set-in-host-or-env>" },
    hint: "GitHub PR/issues (needs PAT)",
  },
  notion: {
    command: "npx",
    args: ["-y", "@notionhq/notion-mcp-server"],
    env: { NOTION_API_KEY: "<set-in-host-or-env>" },
    hint: "Notion workspace",
  },
  filesystem: {
    hint: "Local dirs as MCP roots",
    // Appends the resolved project root as an arg; no env to clean.
    build: (projectRoot) => ({
      command: "npx",
      args: [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        resolve(projectRoot),
      ],
    }),
  },
  memory: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory"],
    hint: "Ephemeral memory MCP",
  },
  fetch: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-fetch"],
    hint: "HTTP fetch MCP",
  },
  glean: {
    command: "npx",
    args: ["-y", "@gleanwork/mcp-server"],
    env: {
      GLEAN_INSTANCE: "<set-in-host-or-env>",
      GLEAN_API_TOKEN: "<set-in-host-or-env>",
    },
    hint: "Glean search (instance + token)",
  },
  gdrive: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-gdrive"],
    hint: "Google Drive",
  },
  "jstack-mock": {
    hint: "Local jstack MCP mock (fixtures)",
    // Requires pluginRoot; env values are literal (not placeholders), so no
    // env-cleaning is needed or applied.
    build: (_projectRoot, opts) => {
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
    },
  },
};

/** Strip unresolved `<...>` env placeholders from a static preset entry. */
function applyDefaults(entry: McpServerSpec): McpServerSpec {
  const { command, args, env } = entry;
  const rest: McpServerSpec = args ? { command, args } : { command };
  if (env) {
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(env)) {
      if (!v.startsWith("<")) cleaned[k] = v;
    }
    return Object.keys(cleaned).length ? { ...rest, env: cleaned } : rest;
  }
  return rest;
}

/** Resolve filesystem MCP root to project cwd when adding preset. */
export function resolvePreset(
  id: string,
  projectRoot: string,
  opts?: ResolvePresetOpts,
): McpServerSpec | undefined {
  const lower = id.toLowerCase();
  const entry = MCP_ADD_PRESETS[lower];
  if (!entry) return undefined;
  return entry.build ? entry.build(projectRoot, opts) : applyDefaults(entry);
}

export function listPresetIds(): string[] {
  return Object.keys(MCP_ADD_PRESETS).sort();
}

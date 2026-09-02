const CLAUDE_MCP_TIMEOUT_MS = 5000;

/**
 * Shared `claude mcp list` runner -- diagnostics.ts's MCP check, integrations.ts's Slack-MCP
 * check, and the desktop app's general "which MCP servers are available" view all need the
 * exact same subprocess call (find claude on PATH, run `mcp list` with a timeout so a
 * hung/misbehaving binary can't hang the whole RPC response, decode stdout/stderr). One place
 * for that, so a future fix to how it's invoked doesn't need to be made three times.
 *
 * `servers` is a best-effort line split of stdout, not a parsed structure -- `claude mcp list`'s
 * output format isn't a stable contract this codebase controls, so treating each non-empty line
 * as "one server's info" is honest about what's actually known, without pretending to parse a
 * schema that could change under us.
 */
export interface McpListResult {
  ok: boolean;
  claudeFound: boolean;
  servers: string[];
  raw: string;
  error?: string;
}

export function listMcpServersRaw(): McpListResult {
  const claudePath = Bun.which("claude", { PATH: process.env.PATH ?? "" });
  if (!claudePath) {
    return {
      ok: false,
      claudeFound: false,
      servers: [],
      raw: "",
      error: "claude CLI not found on PATH",
    };
  }
  try {
    const r = Bun.spawnSync(["claude", "mcp", "list"], {
      env: { ...process.env },
      timeout: CLAUDE_MCP_TIMEOUT_MS,
    });
    if (r.exitCode !== 0) {
      return {
        ok: false,
        claudeFound: true,
        servers: [],
        raw: "",
        error: new TextDecoder().decode(r.stderr).trim().slice(0, 200),
      };
    }
    const raw = new TextDecoder().decode(r.stdout).trim();
    const servers = raw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    return { ok: true, claudeFound: true, servers, raw: raw.slice(0, 2000) };
  } catch (e) {
    return {
      ok: false,
      claudeFound: true,
      servers: [],
      raw: "",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

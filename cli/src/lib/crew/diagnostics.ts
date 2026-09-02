import { existsSync } from "node:fs";
import { join } from "node:path";
import { collectSkills } from "../../commands/skills.js";
import { findPluginRoot, findProjectRoot } from "../config.js";
import { expandHome } from "./store.js";
import type { CrewConfig } from "./types.js";

/**
 * "Is jstack actually working, from the desktop app's point of view" -- distinct from
 * `jstackc crew doctor` (which is Slack-bot-specific: ingress/egress policy, LaunchAgent load
 * state, TCC/Full Disk Access). This is the smaller set of things a desktop app user hits when
 * something looks broken: is `claude` even on PATH, which project/plugin root did the daemon
 * resolve, did skills actually load, does each agent's workspace exist on disk, is MCP wired up.
 * Kept synchronous except the two `claude` subprocess calls, both bounded by a timeout so a
 * hung/misbehaving `claude` binary can't hang the whole RPC response.
 */
export interface DiagnosticsReport {
  claudeCli: {
    found: boolean;
    path?: string;
    version?: string;
    error?: string;
  };
  projectRoot: { path: string; hasConfig: boolean };
  pluginRoot: { path: string; hasSkillsDir: boolean };
  skills: { count: number; error?: string };
  agents: Array<{
    id: string;
    enabled: boolean;
    model: string;
    workspace: string;
    workspaceExists: boolean;
    mcp: "none" | "inherit";
  }>;
  mcp: {
    anyAgentInherits: boolean;
    claudeMcpListOk?: boolean;
    claudeMcpListDetail?: string;
  };
}

const CLAUDE_TIMEOUT_MS = 5000;

export function runDiagnostics(cfg: CrewConfig): DiagnosticsReport {
  // Bun.which()/spawnSync() with no explicit PATH/env resolve against a snapshot taken at
  // process start, not the live process.env -- fine for the real long-running daemon (its PATH
  // never changes after launchd starts it), but it means a test that mutates process.env.PATH
  // to install a fake `claude` gets silently ignored without passing it explicitly here.
  const claudePath = Bun.which("claude", { PATH: process.env.PATH ?? "" });
  let claudeVersion: string | undefined;
  let claudeError: string | undefined;
  if (claudePath) {
    try {
      const r = Bun.spawnSync(["claude", "--version"], {
        env: { ...process.env },
        timeout: CLAUDE_TIMEOUT_MS,
      });
      if (r.exitCode === 0) {
        claudeVersion = new TextDecoder().decode(r.stdout).trim();
      } else {
        claudeError = new TextDecoder().decode(r.stderr).trim().slice(0, 200);
      }
    } catch (e) {
      claudeError = e instanceof Error ? e.message : String(e);
    }
  }

  const projectRoot = findProjectRoot();
  const pluginRoot = findPluginRoot();

  let skillsCount = 0;
  let skillsError: string | undefined;
  try {
    skillsCount = collectSkills(pluginRoot).length;
  } catch (e) {
    skillsError = e instanceof Error ? e.message : String(e);
  }

  const agents = Object.entries(cfg.agents).map(([id, a]) => {
    const workspace = expandHome(a.workspace);
    return {
      id,
      enabled: a.enabled,
      model: a.model,
      workspace,
      workspaceExists: existsSync(workspace),
      mcp: a.mcp,
    };
  });

  const anyAgentInherits = agents.some((a) => a.mcp === "inherit");
  let claudeMcpListOk: boolean | undefined;
  let claudeMcpListDetail: string | undefined;
  if (claudePath && anyAgentInherits) {
    try {
      const r = Bun.spawnSync(["claude", "mcp", "list"], {
        env: { ...process.env },
        timeout: CLAUDE_TIMEOUT_MS,
      });
      claudeMcpListOk = r.exitCode === 0;
      claudeMcpListDetail = claudeMcpListOk
        ? new TextDecoder().decode(r.stdout).trim().slice(0, 500)
        : new TextDecoder().decode(r.stderr).trim().slice(0, 200);
    } catch (e) {
      claudeMcpListOk = false;
      claudeMcpListDetail = e instanceof Error ? e.message : String(e);
    }
  }

  return {
    claudeCli: {
      found: claudePath !== null,
      path: claudePath ?? undefined,
      version: claudeVersion,
      error: claudeError,
    },
    projectRoot: {
      path: projectRoot,
      hasConfig: existsSync(join(projectRoot, "jstack.config.json")),
    },
    pluginRoot: {
      path: pluginRoot,
      hasSkillsDir: existsSync(join(pluginRoot, "skills")),
    },
    skills: { count: skillsCount, error: skillsError },
    agents,
    mcp: { anyAgentInherits, claudeMcpListOk, claudeMcpListDetail },
  };
}

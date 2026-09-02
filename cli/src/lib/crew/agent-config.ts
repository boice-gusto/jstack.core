import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { findProjectRoot } from "../config.js";
import { findSigilCollisions } from "./guards.js";
import { CrewConfigSchema, type CrewConfig } from "./types.js";

/**
 * Shared read-mutate-write for `jstack.config.json`'s `crew.agents` section -- used by both the
 * CLI's `crew agents *` commands and the RPC server's `agent/create` (the desktop app's
 * onboarding wizard). One writer, so a future field never has to be taught to two places.
 */
const CONFIG_KEY = "crew";

/** Returns the freshly-validated (defaults applied) config, so a caller that needs the exact
 * parsed shape of what it just wrote -- `createAgent` does, to hand the new agent straight to a
 * running daemon's in-memory config without waiting for its next reload -- doesn't have to
 * re-derive it by hand. */
export function mutateAgents(
  fn: (agents: Record<string, Record<string, unknown>>) => void,
): CrewConfig {
  const root = findProjectRoot();
  const path = join(root, "jstack.config.json");
  const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  const crew = raw[CONFIG_KEY] as Record<string, unknown> | undefined;
  if (!crew) throw new Error(`no "${CONFIG_KEY}" key. Run: jstackc crew init`);
  const agents = (crew.agents ?? {}) as Record<string, Record<string, unknown>>;
  fn(agents);
  crew.agents = agents;
  const parsed = CrewConfigSchema.parse(crew); // never write a config that would not load
  writeFileSync(path, `${JSON.stringify(raw, null, 2)}\n`);
  return parsed;
}

export interface CreateAgentInput {
  id: string;
  name: string;
  persona?: string;
  model?: string;
  tools?: string[];
  mcp?: "none" | "inherit";
  workspace: string;
}

/**
 * The onboarding wizard's write path: simpler than the CLI's `crew agents add` (no proactive
 * checks, no persona-file option) since a first-run wizard has no use for either yet -- someone
 * who wants those can still reach for `jstackc crew agents edit` afterward, same config, same
 * schema. Unlike a CLI-added agent, this one starts ENABLED: the whole point of a wizard is that
 * finishing it should produce something immediately usable, not a second manual `enable` step.
 */
export function createAgent(input: CreateAgentInput) {
  const id = input.id.trim();
  if (!/^[a-z][a-z0-9-]{1,23}$/.test(id)) {
    throw new Error(
      "id must be kebab-case, 2-24 chars, starting with a letter",
    );
  }
  const sigils = [`!${id}`, `@agent-${id}`];
  const cfg = mutateAgents((agents) => {
    if (agents[id]) {
      throw new Error(`agent "${id}" already exists`);
    }
    const collisions = findSigilCollisions(agents, null, sigils);
    if (collisions.length) {
      const c = collisions[0]!;
      throw new Error(`sigil "${c.sigil}" already belongs to "${c.ownerId}"`);
    }
    agents[id] = {
      enabled: true,
      name: input.name,
      emoji: ":robot_face:",
      description: "",
      sigils,
      model: input.model ?? "claude-sonnet-5",
      workspace: input.workspace,
      tools: input.tools?.length ? input.tools : ["Read", "Grep", "Glob"],
      max_turns: 30,
      task_timeout_ms: 600_000,
      persona: input.persona ?? "",
      proactive_checks: [],
      mcp: input.mcp ?? "none",
    };
  });
  return { id, agent: cfg.agents[id]! };
}

export interface UpdateAgentInput {
  model?: string;
  tools?: string[];
  mcp?: "none" | "inherit";
  enabled?: boolean;
}

/**
 * Narrow, additive counterpart to `createAgent` -- only the fields the desktop app's Settings
 * dialog needs to change post-creation (model, tool/MCP access, and now enabled/disabled).
 * Anything else (persona, sigils) still goes through `jstackc crew agents edit`, same as before
 * this existed.
 */
export function updateAgent(id: string, patch: UpdateAgentInput) {
  const cfg = mutateAgents((agents) => {
    const agent = agents[id];
    if (!agent) throw new Error(`agent "${id}" not found`);
    if (patch.model !== undefined) agent.model = patch.model;
    if (patch.tools !== undefined) agent.tools = patch.tools;
    if (patch.mcp !== undefined) agent.mcp = patch.mcp;
    if (patch.enabled !== undefined) agent.enabled = patch.enabled;
  });
  return { id, agent: cfg.agents[id]! };
}

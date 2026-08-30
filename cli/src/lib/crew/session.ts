import { taskId, runWorker } from "./tick.js";
import { CrewStore, expandHome } from "./store.js";
import type { CrewConfig } from "./types.js";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import {
  recallAgentMemory,
  rememberAgentMemory,
  type AgentMemoryEntry,
  type AgentMemoryInput,
} from "../memory/index.js";

/**
 * Manual (non-Slack) sessions: an interactive conversation with a crew agent, driven directly
 * (CLI today; a daemon socket later) instead of by a Slack message. Reuses `CrewStore`'s
 * existing `task` table rather than a second store -- a manual session IS a task, just one
 * whose `channel_id` never came from Slack, so `crew status`/`recentTasks()` already display it
 * for free. `MANUAL_CHANNEL_ID` only has to avoid colliding with real Slack ids, which are
 * always `C…`/`D…` (see `types.ts`'s `CHANNEL_ID` schema) -- it is never validated against that
 * schema itself, since these rows never flow through Slack ingress/egress.
 */
export const MANUAL_CHANNEL_ID = "manual";

export class UnknownAgentError extends Error {}
export class DisabledAgentError extends Error {}
export class UnknownSessionError extends Error {}
export class BudgetExceededError extends Error {}

/** Where an agent's tiered memory lives, derived from the same state_dir crew already uses for
 * its SQLite ledger -- one root, not a second config knob. */
export function memoryRootFor(cfg: CrewConfig): string {
  return join(expandHome(cfg.state_dir), "memory");
}

/**
 * Prepends up to 5 recalled memory entries as a labeled, clearly-separate block ahead of the
 * user's own message -- inside the SAME `<untrusted_*>` wrapper `runWorker` builds around
 * `request` (it takes one string; there's no separate trusted-context slot to add without
 * changing that security-sensitive function). That's a deliberate, conservative choice, not an
 * oversight: recalled memory could itself have been shaped by an earlier untrusted turn, so
 * treating it as "data to consider, not instructions" -- the same framing `runWorker`'s system
 * prompt already gives everything inside that wrapper -- is the safer default.
 */
function withRecalledMemory(
  cfg: CrewConfig,
  agentId: string,
  message: string,
): string {
  const recalled = recallAgentMemory(memoryRootFor(cfg), agentId, message, 5);
  if (recalled.length === 0) return message;
  const block = recalled.map((e) => `- (${e.kind}) ${e.content}`).join("\n");
  return `Relevant memory:\n${block}\n\nMessage:\n${message}`;
}

function requireEnabledAgent(cfg: CrewConfig, agentId: string) {
  const agent = cfg.agents[agentId];
  if (!agent) throw new UnknownAgentError(`no such agent: ${agentId}`);
  if (!agent.enabled)
    throw new DisabledAgentError(`agent is disabled: ${agentId}`);
  return agent;
}

/**
 * Creates a new manual session for `agentId` and returns its handle (the same short `taskId()`
 * form Slack tasks use, e.g. `ral-qatq`) plus the claude/codex session id that will be seeded on
 * the first prompt. The session id is generated up front (mirroring tick.ts's Slack-task
 * pattern) rather than learned from the first run's output, so a session is resumable from the
 * moment it's created even if the first prompt never runs.
 */
export function createManualSession(
  store: CrewStore,
  cfg: CrewConfig,
  agentId: string,
): { id: string; sessionId: string } {
  requireEnabledAgent(cfg, agentId);
  const sessionId = randomUUID();
  // taskId() draws from a small (~1.6M) space and task.id is a bare PRIMARY KEY (no retry
  // built into createTask itself) -- one retry on collision costs nothing and matches the
  // low-but-nonzero collision risk this handle format already accepts elsewhere.
  for (let attempt = 0; attempt < 2; attempt++) {
    const id = taskId(agentId);
    if (store.createTask(id, MANUAL_CHANNEL_ID, id, id, sessionId, agentId)) {
      return { id, sessionId };
    }
  }
  throw new Error("could not allocate a unique session id; try again");
}

export type ManualPromptResult = {
  ok: boolean;
  text: string;
  costUsd: number;
};

/**
 * Runs one turn in an existing manual session. Resumes (`--resume`) once the session has
 * produced at least one turn; the very first prompt seeds it fresh (`--session-id`) since
 * `--resume` on an id claude has never seen is a hard error (see tick.ts's own comment on this).
 * `turns > 1 || endedAt !== null` is the "has a turn actually run" signal because
 * `store.createTask` always starts a row at `turns=1` with `ended_at` unset -- neither field
 * moves until the first `bumpTurn`/`finishTask` call this function itself makes.
 */
export async function promptManualSession(
  store: CrewStore,
  cfg: CrewConfig,
  id: string,
  message: string,
): Promise<ManualPromptResult> {
  const task = store.findTaskById(id);
  if (!task) throw new UnknownSessionError(`no such session: ${id}`);
  const agent = requireEnabledAgent(cfg, task.agentId);

  if (!store.reserve(cfg.budget.per_task_usd, cfg.budget.daily_usd)) {
    throw new BudgetExceededError(
      `daily budget cap ($${cfg.budget.daily_usd}) reached`,
    );
  }

  const hasRunTurn = task.turns > 1 || task.endedAt !== null;
  const nonce = Math.random().toString(36).slice(2, 10);
  const messageWithMemory = withRecalledMemory(cfg, task.agentId, message);
  const w = await runWorker(cfg, agent, messageWithMemory, nonce, {
    id: task.sessionId,
    resume: hasRunTurn,
  });

  store.settle(cfg.budget.per_task_usd, w.cost);
  // Defensive, mirroring tick.ts's Slack path: claude is asked to use `task.sessionId` via
  // `--session-id`/`--resume`, but recording whatever it actually reports keeps this session
  // resumable even in the (unobserved) case where it doesn't honor the requested id.
  if (w.sessionId) store.setTaskSession(id, w.sessionId);
  if (hasRunTurn) {
    store.bumpTurn(id, w.cost);
  } else {
    store.finishTask(
      id,
      w.ok ? "done" : "failed",
      w.cost,
      w.ok ? undefined : w.text.slice(0, 200),
    );
  }

  return { ok: w.ok, text: w.text, costUsd: w.cost };
}

/**
 * Marks a manual session closed. There is no in-flight process to kill yet (Phase 1 is
 * synchronous, one CLI invocation per prompt) -- that arrives with the resident daemon, which
 * will `AgentRunHandle.cancel()` a live run before calling this. Safe to call on a session with
 * no active run, which is every manual session today.
 */
export function cancelManualSession(store: CrewStore, id: string): void {
  const task = store.findTaskById(id);
  if (!task) throw new UnknownSessionError(`no such session: ${id}`);
  store.finishTask(id, "cancelled", 0);
}

/**
 * Explicit write path into a session's agent memory -- there is no automatic
 * extraction-from-conversation here (a much fuzzier feature, out of scope for this pass); a
 * caller (a human via the CLI, or an agent asked to remember something) decides what's worth
 * keeping, the same way `self/remember` works for project-scoped memory.
 */
export function rememberInSession(
  store: CrewStore,
  cfg: CrewConfig,
  id: string,
  input: AgentMemoryInput,
): AgentMemoryEntry {
  const task = store.findTaskById(id);
  if (!task) throw new UnknownSessionError(`no such session: ${id}`);
  return rememberAgentMemory(memoryRootFor(cfg), task.agentId, input);
}

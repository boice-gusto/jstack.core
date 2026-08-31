import { invoke } from "@tauri-apps/api/core";

/**
 * Thin, typed wrappers around the Tauri commands in `src-tauri/src/lib.rs`, which 1:1 forward
 * to crew's RPC socket (`cli/src/lib/crew/rpc-server.ts`). Kept here rather than calling
 * `invoke()` inline from components so the response shapes are declared once.
 */

export interface NewSessionResult {
  id: string;
  sessionId: string;
}

export interface ToolCallEvent {
  id?: string;
  name: string;
  input: unknown;
  output?: string;
  isError?: boolean;
}

export interface PromptResult {
  ok: boolean;
  text: string;
  costUsd: number;
  toolEvents: ToolCallEvent[];
}

export type TranscriptEntry =
  | { role: "user"; text: string; at: string }
  | {
      role: "assistant";
      text: string;
      costUsd: number;
      toolEvents: ToolCallEvent[];
      at: string;
    }
  | { role: "error"; text: string; at: string };

export interface MemoryEntry {
  id: string;
  agentId: string;
  kind: string;
  source: string;
  tags: string[];
  confidence: number;
  createdAt: string;
  content: string;
}

export interface DaemonStatus {
  tasks: number;
  outbox: number;
  spentToday: number;
  watermarks: number;
  enabled: boolean;
  mode: string;
}

export interface SessionSummary {
  id: string;
  agentId: string;
  state: string;
  turns: number;
  costUsd: number;
}

export function newSession(agentId: string): Promise<NewSessionResult> {
  return invoke("session_new", { agentId });
}

/** Newest first (matches session.ts's listManualSessions). Metadata only (state, turns, cost) --
 * call getSessionHistory for the actual message transcript. */
export function listSessions(): Promise<SessionSummary[]> {
  return invoke("session_list");
}

/** A session's full message history, oldest first -- what the UI renders as the chat log when a
 * session is reopened or switched back to (transcript.ts is the backing store). */
export function getSessionHistory(id: string): Promise<TranscriptEntry[]> {
  return invoke("session_history", { id });
}

export function promptSession(id: string, message: string): Promise<PromptResult> {
  return invoke("session_prompt", { id, message });
}

export interface SelfRetroResult {
  ran: boolean;
  saved: MemoryEntry[];
  costUsd: number;
}

/** Closing a session also runs a self-retro (retro.ts) over its transcript, so `retro.saved`
 * says what -- if anything -- the agent just learned before this session went away. */
export function cancelSession(
  id: string,
): Promise<{ ok: boolean; retro: SelfRetroResult }> {
  return invoke("session_cancel", { id });
}

export function rememberInSession(
  id: string,
  content: string,
  kind?: string,
  source?: string,
): Promise<MemoryEntry> {
  return invoke("session_remember", { id, content, kind, source });
}

export function daemonStatus(): Promise<DaemonStatus> {
  return invoke("daemon_status");
}

export interface AgentSummary {
  id: string;
  name: string;
  enabled: boolean;
  model: string;
  persona: string;
  tools: string[];
  mcp: "none" | "inherit";
}

/** Every agent configured in `jstack.config.json`'s `crew.agents` -- an empty list is the
 * onboarding wizard's trigger condition (see App.tsx), not an error state. */
export function listAgents(): Promise<AgentSummary[]> {
  return invoke("agent_list");
}

export interface CreateAgentInput {
  id: string;
  name: string;
  persona?: string;
  model?: string;
  tools?: string[];
  mcp?: "none" | "inherit";
}

/** Writes a new agent to the real project config and splices it into the running daemon's
 * in-memory config immediately -- usable via `newSession` the moment this resolves, no restart
 * or wait for the next tick needed (see rpc-server.ts's own note on why that matters). */
export function createAgent(
  input: CreateAgentInput,
): Promise<{ id: string; agent: Omit<AgentSummary, "id"> }> {
  return invoke("agent_create", { ...input });
}

/** Poll-based, not push/streamed -- see rpc-server.ts's own note on why (one request/response
 * per socket connection, no server-initiated messages). A UI wanting "live" logs polls this on
 * an interval rather than subscribing. */
export function recentLogs(limit?: number): Promise<{ lines: string[] }> {
  return invoke("recent_logs", { limit });
}

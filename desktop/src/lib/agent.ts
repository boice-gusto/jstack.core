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

export interface PromptResult {
  ok: boolean;
  text: string;
  costUsd: number;
}

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

/**
 * Newest first (matches session.ts's listManualSessions). Doesn't carry conversation history --
 * crew's store persists task/session metadata (state, turns, cost), not the actual message
 * text -- so switching to a listed session resumes it (the daemon still has the real
 * claude/codex session id) but the UI's own message list only shows what's been sent since this
 * app started, not the session's full past transcript.
 */
export function listSessions(): Promise<SessionSummary[]> {
  return invoke("session_list");
}

export function promptSession(id: string, message: string): Promise<PromptResult> {
  return invoke("session_prompt", { id, message });
}

export function cancelSession(id: string): Promise<{ ok: boolean }> {
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

/** Poll-based, not push/streamed -- see rpc-server.ts's own note on why (one request/response
 * per socket connection, no server-initiated messages). A UI wanting "live" logs polls this on
 * an interval rather than subscribing. */
export function recentLogs(limit?: number): Promise<{ lines: string[] }> {
  return invoke("recent_logs", { limit });
}

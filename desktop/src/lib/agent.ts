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

/** Counterpart to `createAgent` -- model, tool access, and MCP inheritance are all editable from
 * the desktop app's Settings dialog post-creation; same immediate-splice-into-running-daemon
 * behavior. Persona/sigils still require `jstackc crew agents edit`. */
export function updateAgent(
  id: string,
  patch: { model?: string; tools?: string[]; mcp?: "none" | "inherit"; enabled?: boolean },
): Promise<{ id: string; agent: Omit<AgentSummary, "id"> }> {
  return invoke("agent_update", { id, ...patch });
}

/** Poll-based, not push/streamed -- see rpc-server.ts's own note on why (one request/response
 * per socket connection, no server-initiated messages). A UI wanting "live" logs polls this on
 * an interval rather than subscribing. */
export function recentLogs(limit?: number): Promise<{ lines: string[] }> {
  return invoke("recent_logs", { limit });
}

export interface SkillSummary {
  path: string;
  rel: string;
  name: string;
  description: string;
  origin: "core" | "overlay";
}

/** Read-only view into jstack.core's skill catalog (`jstackc skills index`, served over the same
 * RPC socket rather than shelling out from Rust -- see rpc-server.ts's "skills/index" case). This
 * does NOT mean skills are runnable by crew agents: they remain fully disabled for every agent
 * turn (`--disable-slash-commands`, a deliberate security boundary) -- this is purely "here's
 * what's installed," the same way `jstackc skills index` is for a human at the CLI. */
export function skillsIndex(): Promise<{ skills: SkillSummary[] }> {
  return invoke("skills_index");
}

/** "green-dim" is only ever set by the pulsing interval in App.tsx (see useTrayPulse) -- the
 * alternate frame it flips to and from "green" every ~600ms while at least one session is
 * actively thinking, faking an animation since macOS tray icons can't actually animate. */
export type TrayStatus = "none" | "green" | "green-dim" | "yellow" | "red";

/** Swaps the menu-bar icon: every status, including "none", is a full-color icon composited
 * onto a status-colored circle (see src-tauri/icons/tray-icon-<color>.png and lib.rs's
 * set_tray_status) -- never the flat monochrome template. Cheap to call often -- it's just an
 * icon swap, no menu rebuild -- so callers don't need to debounce it beyond React's own render
 * batching. */
export function setTrayStatus(status: TrayStatus): Promise<void> {
  return invoke("set_tray_status", { status });
}

export interface TrayAgent {
  id: string;
  name: string;
}

export interface TraySession {
  id: string;
  agentId: string;
  label: string;
}

/** Rebuilds the tray's whole dropdown (Agents submenu, Recent sessions submenu, Settings, Quit)
 * from the given lists -- see lib.rs's build_tray_menu. Clicking an agent or session in the tray
 * doesn't call back into this module directly; it round-trips through a Tauri event
 * ("tray-agent-selected" / "tray-session-selected" / "tray-open-settings") that App.tsx listens
 * for, since the click happens in the Rust menu-event handler, not in this webview's JS. */
export function updateTrayMenu(agents: TrayAgent[], sessions: TraySession[]): Promise<void> {
  return invoke("update_tray_menu", { agents, sessions });
}

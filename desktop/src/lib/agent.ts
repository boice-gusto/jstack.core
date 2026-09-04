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

export interface AgentTotals {
  agentId: string;
  tasks: number;
  turns: number;
  costUsd: number;
}

export interface DaemonStatus {
  tasks: number;
  outbox: number;
  spentToday: number;
  watermarks: number;
  enabled: boolean;
  mode: string;
  /** Always true if this resolves at all -- see rpc-server.ts's own note: only the resident
   * daemon ever serves this socket, so a reachable status IS "resident." */
  resident: boolean;
  uptimeMs: number;
  perAgent: AgentTotals[];
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
 * call getSessionHistory for the actual message transcript. Includes cancelled/closed sessions
 * -- the daemon's ledger never deletes a row, it only marks one `cancelled`; hiding those is a
 * client-side choice (see App.tsx's sidebar filter), not something this RPC does. The Settings
 * dialog's Sessions tab relies on that to show closed sessions as resumable. */
export function listSessions(limit?: number): Promise<SessionSummary[]> {
  return invoke("session_list", limit === undefined ? {} : { limit });
}

/** A session's full message history, oldest first -- what the UI renders as the chat log when a
 * session is reopened or switched back to (transcript.ts is the backing store). */
export function getSessionHistory(id: string): Promise<TranscriptEntry[]> {
  return invoke("session_history", { id });
}

/** "ask" vs "full-access" mirrors claude's real permission modes (see tick.ts's
 * SessionMode for what each actually does in this daemon's non-interactive invocation).
 * "full-access" is the default -- the mode every session ran in before this existed. */
export type SessionMode = "ask" | "full-access";

/** Raises how much extended-thinking budget the model gives itself for one turn -- see
 * tick.ts's ThinkingLevel for the underlying magic-word mechanism. "none" is the default. */
export type ThinkingLevel = "none" | "think" | "think-hard" | "think-harder" | "ultrathink";

export function promptSession(
  id: string,
  message: string,
  opts: { mode?: SessionMode; thinkingLevel?: ThinkingLevel } = {},
): Promise<PromptResult> {
  return invoke("session_prompt", {
    id,
    message,
    mode: opts.mode,
    thinkingLevel: opts.thinkingLevel,
  });
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

/** A Slack proactive check: fixed prompt + channel, cron-scheduled, CLI-managed
 * (`jstackc crew agents edit --proactive-check`) -- shown read-only in the desktop app's
 * Schedule tab, alongside the desktop-app-created ScheduledPrompts below. */
export interface ProactiveCheckSummary {
  id: string;
  schedule: string;
  prompt: string;
  channel?: string;
}

export interface AgentSummary {
  id: string;
  name: string;
  enabled: boolean;
  model: string;
  persona: string;
  tools: string[];
  mcp: "none" | "inherit";
  proactiveChecks: ProactiveCheckSummary[];
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

/** A desktop-app-created scheduled prompt: re-runs a manual session's message on a cron
 * interval, distinct from a Slack ProactiveCheckSummary above. `sessionId` is null until its
 * first due run creates one. */
export interface ScheduledPrompt {
  id: string;
  agentId: string;
  sessionId: string | null;
  prompt: string;
  cron: string;
  /** Slack channel id the result gets pushed to after each run, via the "[emoji] - message -
   * sent by jstack" template (see integrations.ts) -- null if this schedule doesn't notify. */
  notifyChannel: string | null;
  enabled: boolean;
  createdAt: number;
  lastRunAt: number | null;
  lastRunOk: boolean | null;
}

export function createSchedule(
  agentId: string,
  prompt: string,
  cron: string,
  notifyChannel?: string,
): Promise<{ id: string }> {
  return invoke("schedule_create", { agentId, prompt, cron, notifyChannel });
}

export function listSchedules(): Promise<{ schedules: ScheduledPrompt[] }> {
  return invoke("schedule_list");
}

export function setScheduleEnabled(id: string, enabled: boolean): Promise<{ ok: boolean }> {
  return invoke("schedule_update", { id, enabled });
}

export function deleteSchedule(id: string): Promise<{ ok: boolean }> {
  return invoke("schedule_delete", { id });
}

export interface SkillSummary {
  path: string;
  rel: string;
  name: string;
  description: string;
  /** "" when the skill has no category frontmatter field, not undefined -- see
   * collectSkills/SkillIndexEntry's own note on why. */
  category: string;
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

export interface DiagnosticsReport {
  claudeCli: { found: boolean; path?: string; version?: string; error?: string };
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

/** "Is jstack actually working" checks, run fresh (not cached) each call -- see
 * diagnostics.ts's own note on how this differs from `jstackc crew doctor`. */
export function runDiagnostics(): Promise<DiagnosticsReport> {
  return invoke("run_diagnostics");
}

export interface Integration {
  id: string;
  name: string;
  description: string;
  configured: boolean;
  mcpAvailable: boolean;
  mcpDetail?: string;
}

/** See integrations.ts's own note on what "integration" means here -- today just Slack DM, but
 * the shape (a status card: configured?, external dependency available?) is meant to generalize
 * to whatever gets added next. */
export function listIntegrations(): Promise<{ integrations: Integration[] }> {
  return invoke("integrations_list");
}

export interface McpListResult {
  ok: boolean;
  claudeFound: boolean;
  servers: string[];
  raw: string;
  error?: string;
}

/** Every MCP server `claude mcp list` reports, unconditionally -- distinct from
 * Integration.mcpAvailable above, which only checks for a Slack-named one. */
export function listMcpServers(): Promise<McpListResult> {
  return invoke("mcp_list");
}

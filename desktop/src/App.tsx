import { useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  cancelSession,
  getSessionHistory,
  listAgents,
  listSessions,
  newSession,
  promptSession,
  setTrayStatus,
  updateTrayMenu,
  type AgentSummary,
  type PromptResult,
  type SessionMode,
  type SessionSummary,
  type ThinkingLevel,
  type ToolCallEvent,
  type TrayStatus,
} from "./lib/agent";
import {
  loadSessionMode,
  loadThinkingLevel,
  SESSION_MODE_LABEL,
  storeSessionMode,
  storeThinkingLevel,
  THINKING_LEVEL_LABEL,
} from "./lib/promptControls";
import { Onboarding } from "./components/Onboarding";
import { CreateAgentDialog } from "./components/CreateAgentDialog";
import { CommandPalette } from "./components/CommandPalette";
import { SettingsDialog, type SettingsTab } from "./components/SettingsDialog";
import { AgentAvatar } from "./components/AgentAvatar";
import { NewSessionControls } from "./components/NewSessionControls";
import { SessionTabStrip } from "./components/SessionTabStrip";
import { AvatarPickerDialog } from "./components/AvatarPickerDialog";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { loadAllAgentAvatars } from "./lib/avatars";
import {
  loadNavigationLayout,
  storeNavigationLayout,
  type NavigationLayout,
} from "./lib/navigationLayout";
import {
  LAST_SEEN_TURNS_KEY,
  loadLastSeenTurns,
  sessionStatusColor,
  STATUS_DOT_CLASS,
  STATUS_RING_CLASS,
  type SessionStatusColor,
} from "./lib/sessionStatus";
import { Splash } from "./components/Splash";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "./components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "./components/ai-elements/message";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
  extractFilePath,
} from "./components/ai-elements/tool";
import { openPath } from "@tauri-apps/plugin-opener";
import type { CodeBlockLanguage } from "./components/ai-elements/code-block";
import { Shimmer } from "./components/ai-elements/shimmer";
import { Reasoning, ReasoningTrigger } from "./components/ai-elements/reasoning";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSpeechButton,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from "./components/ai-elements/prompt-input";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./components/ui/tooltip";
import { Skeleton } from "./components/ui/skeleton";
import {
  BrainIcon,
  ChevronRightIcon,
  MessageCircleIcon,
  PanelLeftCloseIcon,
  PanelLeftIcon,
  MoreVerticalIcon,
  PlayCircleIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  ShieldCheckIcon,
  ShieldIcon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react";

const MOD_KEY_SYMBOL =
  typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac")
    ? "⌘"
    : "Ctrl+";

/** Remembers which session was open across app restarts -- the daemon already persists every
 * session's transcript (transcript.ts); this is just which one to reopen without asking. */
const LAST_SESSION_KEY = "jstack.lastSessionId";

const SESSION_NAME_KEY = "jstack.sessionName";
const GROUP_OPEN_KEY = "jstack.groupOpen";
const SIDEBAR_COLLAPSED_KEY = "jstack.sidebarCollapsed";
const SIDEBAR_WIDTH_KEY = "jstack.sidebarWidth";
const SIDEBAR_DEFAULT_WIDTH = 192;
const SIDEBAR_MIN_WIDTH = 160;
const SIDEBAR_MAX_WIDTH = 360;
// Dragging the sidebar narrower than this snaps it into the fully-collapsed icon rail instead
// of letting it shrink to something too thin to read -- "draggable down to how thin you want it
// before going into minimal," per the request that added this.
const SIDEBAR_COLLAPSE_THRESHOLD = 130;

function loadStoredSidebarWidth(): number {
  const stored = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
  return Number.isFinite(stored) && stored >= SIDEBAR_MIN_WIDTH && stored <= SIDEBAR_MAX_WIDTH
    ? stored
    : SIDEBAR_DEFAULT_WIDTH;
}

function loadStringMap(key: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : {};
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function loadGroupOpenMap(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(GROUP_OPEN_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/** A faint colored glow on a collapsed agent group's header -- so "something in here needs you"
 * (running/needs-input/error) is visible without expanding it. White is deliberately excluded:
 * idle/done sessions aren't worth glowing over. */
const GROUP_ATTENTION_GLOW: Record<"red" | "yellow" | "green", string> = {
  red: "shadow-[0_0_10px_1px_rgba(239,68,68,0.5)]",
  yellow: "shadow-[0_0_10px_1px_rgba(234,179,8,0.5)]",
  green: "shadow-[0_0_10px_1px_rgba(34,197,94,0.5)]",
};

function groupAttentionColor(
  items: SessionSummary[],
  lastSeenTurns: Record<string, number>,
): "red" | "yellow" | "green" | null {
  const colors = items.map((s) => sessionStatusColor(s, lastSeenTurns));
  if (colors.includes("red")) return "red";
  if (colors.includes("yellow")) return "yellow";
  if (colors.includes("green")) return "green";
  return null;
}

type ChatMessage =
  | { role: "user"; text: string }
  | {
      role: "assistant";
      text: string;
      costUsd: number;
      elapsedMs: number;
      toolEvents: ToolCallEvent[];
    }
  | { role: "error"; text: string }
  | { role: "system"; text: string };

/** "12s" under a minute, "1:32" at or past it -- matches how the composer's live "Thinking..."
 * counter formats the same elapsed value while a turn is still in flight. */
function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Edit output is typically a unified diff -- everything else (Bash stdout, grep/glob matches,
 * file reads) is plain text. Not exhaustive (Read's output is really whatever language the file
 * itself is), but honest: no guessing from a filename that isn't reliably available here. */
function toolOutputLanguage(toolName: string): CodeBlockLanguage {
  return toolName.toLowerCase() === "edit" ? "diff" : "text";
}

/** Opens a file a tool call touched with the OS default app for that file type -- failures are
 * logged, not surfaced as a UI error, since this is a convenience action off a link, not
 * something the user is blocked on (same treatment as a browser failing to open a dead link). */
function handleOpenFile(path: string): void {
  openPath(path).catch((e) => {
    console.error(`[jstack] openPath(${path}) failed:`, e);
  });
}

/**
 * The chat view: Vercel AI Elements (Conversation/Message/Tool/PromptInput) render the
 * transcript and composer, including tool-call events inline on assistant turns, attachments,
 * and dictation; the rest of the chrome (sidebar, session controls) uses shadcn/ui primitives
 * (Button/Input/Badge) + Tailwind utilities directly.
 */
function App() {
  const [agents, setAgents] = useState<AgentSummary[] | null>(null);
  const [agentId, setAgentId] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Only for New chat / Close session -- genuinely global, one-at-a-time daemon actions, not tied
  // to any particular session. Do NOT use this for "is the session I'm looking at processing a
  // prompt" -- that's `busySessionIds` below. Sessions process independently on the daemon side;
  // sending a message in one must never block or visually affect any other.
  const [busy, setBusy] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  // Keyed by session id, not a single flag -- a session/prompt round-trip in flight for session A
  // must stay scoped to A's own view. Before this was a single global value, switching to a
  // different (idle) session B while A was still "Thinking..." incorrectly showed A's thinking
  // indicator (and disabled composer) on B too, and A's eventual reply risked landing in whatever
  // session happened to be on screen when it arrived instead of A's.
  const [busySessionIds, setBusySessionIds] = useState<ReadonlySet<string>>(new Set());
  const [pendingSinceBySession, setPendingSinceBySession] = useState<Record<string, number>>({});
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Mirrors `sessionId` for reading the CURRENT view from inside a promptSession callback that
  // was set up when a possibly-different session was active -- `sessionId` itself would be stale
  // there (closed over at call time), which is exactly the bug this whole change fixes.
  const sessionIdRef = useRef(sessionId);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  function markSessionBusy(id: string): void {
    setBusySessionIds((prev) => new Set(prev).add(id));
    setPendingSinceBySession((prev) => ({ ...prev, [id]: Date.now() }));
  }

  function markSessionIdle(id: string): void {
    setBusySessionIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setPendingSinceBySession((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  const currentSessionBusy = sessionId !== null && busySessionIds.has(sessionId);
  const pendingSince = sessionId !== null ? (pendingSinceBySession[sessionId] ?? null) : null;

  useEffect(() => {
    if (pendingSince === null) return;
    const interval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [pendingSince]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionNames, setSessionNames] = useState<Record<string, string>>(() =>
    loadStringMap(SESSION_NAME_KEY),
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1",
  );
  const [navigationLayout, setNavigationLayoutState] = useState<NavigationLayout>(loadNavigationLayout);
  function setNavigationLayout(next: NavigationLayout): void {
    setNavigationLayoutState(next);
    storeNavigationLayout(next);
  }
  const [sessionMode, setSessionModeState] = useState<SessionMode>(loadSessionMode);
  function setSessionMode(next: SessionMode): void {
    setSessionModeState(next);
    storeSessionMode(next);
  }
  const [thinkingLevel, setThinkingLevelState] = useState<ThinkingLevel>(loadThinkingLevel);
  function setThinkingLevel(next: ThinkingLevel): void {
    setThinkingLevelState(next);
    storeThinkingLevel(next);
  }
  const [sidebarWidth, setSidebarWidth] = useState(loadStoredSidebarWidth);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const resizeStartRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const liveSidebarWidthRef = useRef(sidebarWidth);
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");
  const [avatarPickerAgent, setAvatarPickerAgent] = useState<{ id: string; name: string } | null>(
    null,
  );
  // Session id awaiting a confirm-before-close prompt -- closing used to fire immediately on a
  // single click with no undo (flagged by /impeccable critique's P1s).
  const [confirmCloseSessionId, setConfirmCloseSessionId] = useState<string | null>(null);
  // AvatarPickerDialog writes straight to localStorage (see lib/avatars.ts); mirrored into real
  // state here, same pattern as groupOpen, so a change actually triggers a re-render instead of
  // silently going stale until something unrelated happens to re-render this component.
  const [avatars, setAvatars] = useState(loadAllAgentAvatars);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [groupOpen, setGroupOpen] = useState(loadGroupOpenMap);
  const [lastSeenTurns, setLastSeenTurns] = useState(loadLastSeenTurns);

  // Marks the active session "seen" up to its current turn count -- runs whenever either changes,
  // so switching to a session, or receiving a new reply while already watching it, both clear its
  // green dot without a separate explicit "mark as read" action anywhere.
  useEffect(() => {
    if (!sessionId) return;
    const active = sessions.find((s) => s.id === sessionId);
    if (!active) return;
    setLastSeenTurns((prev) => {
      if ((prev[sessionId] ?? 0) >= active.turns) return prev;
      const next = { ...prev, [sessionId]: active.turns };
      localStorage.setItem(LAST_SEEN_TURNS_KEY, JSON.stringify(next));
      return next;
    });
  }, [sessionId, sessions]);

  // Menu-bar icon reflects the single worst status across every session, not just the active
  // one -- the whole point of a tray indicator is surfacing something in a BACKGROUND chat you
  // aren't currently looking at. "A chat is actively thinking" outranks everything else and
  // pulses (green/green-dim, alternating below) -- that's the one state that means "come back
  // in a second," as opposed to red/yellow (something's wrong or waiting, no rush implied by
  // pulsing) or an unseen-but-already-arrived reply (doesn't need the tray's attention at all,
  // per the request this replaced: "changes to white when all things are answered").
  const anyThinking = busySessionIds.size > 0;
  useEffect(() => {
    if (anyThinking) return; // the pulse effect below owns the icon while this is true
    const colors = sessions.map((s) => sessionStatusColor(s, lastSeenTurns));
    const overall: TrayStatus = colors.includes("red")
      ? "red"
      : colors.includes("yellow")
        ? "yellow"
        : "none";
    setTrayStatus(overall).catch((e) => {
      console.error("[jstack] setTrayStatus failed:", e);
    });
  }, [anyThinking, sessions, lastSeenTurns]);

  // The pulse itself: flip between "green" and "green-dim" every 600ms for as long as anything
  // is thinking. macOS/Tauri have no real animated-tray-icon API, so this two-frame flipbook is
  // the whole "animation." Torn down (and the icon corrected by the effect above) the instant
  // nothing is thinking anymore, not left mid-pulse.
  useEffect(() => {
    if (!anyThinking) return;
    let dim = false;
    const tick = (): void => {
      dim = !dim;
      setTrayStatus(dim ? "green-dim" : "green").catch((e) => {
        console.error("[jstack] setTrayStatus failed:", e);
      });
    };
    tick();
    const interval = setInterval(tick, 600);
    return () => clearInterval(interval);
  }, [anyThinking]);

  // Keeps the tray's "Agents" and "Sessions" submenus current -- every open session, so the
  // right-click menu can jump straight to any of them without going through the main window
  // first. `sessions` already excludes cancelled/closed ones (see refreshSessions).
  useEffect(() => {
    if (!agents) return;
    updateTrayMenu(
      agents.map((a) => ({ id: a.id, name: a.name })),
      sessions.map((s) => ({
        id: s.id,
        agentId: s.agentId,
        label: sessionNames[s.id] ?? s.id,
      })),
    ).catch((e) => {
      console.error("[jstack] updateTrayMenu failed:", e);
    });
  }, [agents, sessions, sessionNames]);

  // Tray menu clicks happen in Rust (the click itself isn't in this webview), so they arrive
  // here as events rather than direct function calls -- see lib.rs's on_menu_event.
  useEffect(() => {
    const unlistenPromises = [
      listen<string>("tray-agent-selected", (event) => setAgentId(event.payload)),
      listen<{ id: string; agentId: string }>("tray-session-selected", (event) => {
        switchToSession(event.payload.id, event.payload.agentId);
      }),
      listen("tray-open-settings", () => setShowSettings(true)),
    ];
    return () => {
      unlistenPromises.forEach((p) => p.then((unlisten) => unlisten()));
    };
  }, []);

  function isGroupOpen(groupId: string): boolean {
    return groupOpen[groupId] ?? true;
  }

  function handleGroupOpenChange(groupId: string, open: boolean): void {
    setGroupOpen((prev) => {
      const next = { ...prev, [groupId]: open };
      localStorage.setItem(GROUP_OPEN_KEY, JSON.stringify(next));
      return next;
    });
  }

  /** Cmd/Ctrl+K, the universal shortcut for this kind of Spotlight-style palette (VS Code,
   * Slack, Linear, Raycast all use it) -- opens from anywhere, not just by clicking the search
   * bar in the header. */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowCommandPalette((v) => !v);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setSettingsTab("info");
        setShowSettings(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const sessionsByAgent = useMemo(() => {
    const map = new Map<string, SessionSummary[]>();
    for (const s of sessions) {
      const bucket = map.get(s.agentId) ?? [];
      bucket.push(s);
      map.set(s.agentId, bucket);
    }
    return map;
  }, [sessions]);

  /** Known agents first, then any agentId a session references that isn't in the current agent
   * list (a deleted or renamed agent) -- a session must never just silently vanish from the
   * sidebar because its agent no longer exists. Filtered to groups that actually have sessions,
   * matching what the sidebar renders -- shared with the "expand/collapse all" control so it
   * only ever touches groups a user can currently see. */
  const visibleSidebarGroupIds = useMemo(() => {
    const knownAgents = agents ?? [];
    const ids = [
      ...knownAgents.map((a) => a.id),
      ...[...sessionsByAgent.keys()].filter((aid) => !knownAgents.some((a) => a.id === aid)),
    ];
    return ids.filter((id) => (sessionsByAgent.get(id) ?? []).length > 0);
  }, [agents, sessionsByAgent]);

  /** index.html's static <title>jstack</title> is otherwise the only remaining "jstack" text
   * anywhere near the top of the window -- the native title bar itself already renders no text
   * (see tauri.conf.json), so document.title is what shows up in the Cmd+Tab switcher and
   * Mission Control instead. Keeps it in sync with whichever agent is actually active rather
   * than a static app name that never changes as you switch agents. */
  useEffect(() => {
    document.title = agents?.find((a) => a.id === agentId)?.name ?? agentId;
  }, [agents, agentId]);

  function handleToggleSidebar(): void {
    setSidebarCollapsed((v) => {
      const next = !v;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      return next;
    });
  }

  function handleSidebarResizeStart(e: React.MouseEvent): void {
    e.preventDefault();
    resizeStartRef.current = { startX: e.clientX, startWidth: sidebarWidth };
    setIsResizingSidebar(true);
  }

  /** Below SIDEBAR_COLLAPSE_THRESHOLD it snaps straight to the icon rail rather than letting the
   * panel shrink to something too narrow to read -- the requested "draggable down to how thin
   * you want it before going into minimal" behavior. The width itself is only ever persisted at
   * drag-end (via liveSidebarWidthRef, since this effect doesn't re-subscribe on every pixel of
   * movement) so a mid-drag value never gets written on every mousemove. */
  useEffect(() => {
    if (!isResizingSidebar) return;

    function onMove(e: MouseEvent): void {
      if (!resizeStartRef.current) return;
      const next = resizeStartRef.current.startWidth + (e.clientX - resizeStartRef.current.startX);
      if (next < SIDEBAR_COLLAPSE_THRESHOLD) {
        setIsResizingSidebar(false);
        resizeStartRef.current = null;
        setSidebarCollapsed(true);
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "1");
        return;
      }
      const clamped = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, next));
      liveSidebarWidthRef.current = clamped;
      setSidebarWidth(clamped);
    }

    function onUp(): void {
      setIsResizingSidebar(false);
      resizeStartRef.current = null;
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(liveSidebarWidthRef.current));
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isResizingSidebar]);

  /** Inline editing rather than `window.prompt` -- Tauri's WKWebView-backed window doesn't
   * reliably implement `window.prompt`, so a native dialog would silently do nothing on the
   * packaged app even though it worked fine in a browser during development. Also just a
   * better fit for the ChatGPT-like sidebar this is going for; ChatGPT itself renames threads
   * in place, not via a modal dialog. */
  function startRenameSession(id: string): void {
    setRenamingSessionId(id);
    setRenameDraft(sessionNames[id] ?? id);
  }

  function commitRenameSession(): void {
    if (renamingSessionId === null) return;
    const id = renamingSessionId;
    const name = renameDraft.trim();
    setSessionNames((prev) => {
      const next = { ...prev };
      if (name && name !== id) next[id] = name;
      else delete next[id]; // empty (or unchanged) name reverts to showing the raw session id
      localStorage.setItem(SESSION_NAME_KEY, JSON.stringify(next));
      return next;
    });
    setRenamingSessionId(null);
  }

  function cancelRenameSession(): void {
    setRenamingSessionId(null);
  }

  async function refreshSessions(): Promise<SessionSummary[]> {
    try {
      const all = await listSessions();
      // The daemon's ledger never deletes a row -- "close session" just marks it `cancelled` so
      // its history/self-retro survive -- so without this filter a closed session never actually
      // disappears from the sidebar (it just sits there, still clickable, looking identical to an
      // open one). This is the desktop client's own "what's an open chat" view; the CLI's history
      // views still see the full ledger via listSessions/session/list directly.
      const list = all.filter((s) => s.state !== "cancelled");
      setSessions(list);
      return list;
    } catch (e) {
      // Session list is a convenience panel; a daemon that's briefly unreachable shouldn't
      // block the rest of the UI the way a failed chat action does -- still logged, though, so
      // a silent daemon-connection problem doesn't go unnoticed.
      console.error("[jstack] refreshSessions failed:", e);
      return [];
    } finally {
      // Set once and never unset -- distinguishes "still loading" (skeleton rows) from
      // "loaded, genuinely zero sessions" ("No sessions yet"), which looked identical before.
      setSessionsLoaded(true);
    }
  }

  /** Elapsed time per turn isn't stored anywhere -- derived here from the preceding user
   * message's timestamp instead of faking it, so history playback shows the same honest
   * "12s"/"1:32" the live composer counts up to, not a placeholder. */
  function transcriptToMessages(
    history: Awaited<ReturnType<typeof getSessionHistory>>,
  ): ChatMessage[] {
    let lastUserAt: number | null = null;
    return history.map((entry) => {
      if (entry.role === "user") {
        lastUserAt = new Date(entry.at).getTime();
        return entry;
      }
      if (entry.role === "assistant") {
        const elapsedMs = lastUserAt === null ? 0 : new Date(entry.at).getTime() - lastUserAt;
        lastUserAt = null;
        return {
          role: "assistant",
          text: entry.text,
          costUsd: entry.costUsd,
          elapsedMs,
          toolEvents: entry.toolEvents,
        };
      }
      return entry;
    });
  }

  async function switchToSession(id: string, agent: string): Promise<void> {
    setSessionId(id);
    setAgentId(agent);
    setSessionError(null);
    setMessages([]);
    setHistoryLoading(true);
    localStorage.setItem(LAST_SESSION_KEY, id);
    try {
      const history = await getSessionHistory(id);
      setMessages(transcriptToMessages(history));
    } catch (e) {
      console.error(`[jstack] getSessionHistory(${id}) failed:`, e);
      setMessages([
        {
          role: "system",
          text: `Could not load history for ${id}: ${e instanceof Error ? e.message : String(e)}`,
        },
      ]);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function refreshAgents(): Promise<AgentSummary[]> {
    try {
      const list = await listAgents();
      setAgents(list);
      return list;
    } catch (e) {
      console.error("[jstack] listAgents failed:", e);
      setAgents([]);
      return [];
    }
  }

  useEffect(() => {
    (async () => {
      const agentList = await refreshAgents();
      if (agentList.length > 0) setAgentId((prev) => prev || agentList[0]!.id);
      const list = await refreshSessions();
      const lastId = localStorage.getItem(LAST_SESSION_KEY);
      const last = lastId ? list.find((s) => s.id === lastId) : undefined;
      if (last) await switchToSession(last.id, last.agentId);
    })();
  }, []);

  async function handleNewSession(targetAgentId: string = agentId): Promise<void> {
    if (!targetAgentId) return;
    setSessionError(null);
    setBusy(true);
    try {
      const created = await newSession(targetAgentId);
      setAgentId(targetAgentId);
      setSessionId(created.id);
      setMessages([]);
      localStorage.setItem(LAST_SESSION_KEY, created.id);
      await refreshSessions();
    } catch (e) {
      console.error(`[jstack] newSession(${targetAgentId}) failed:`, e);
      setSessionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  /** Picking an agent from the "agent for new chats" dropdown doesn't just change which agent a
   * future "New chat" targets -- it jumps you there now, the same way clicking an existing
   * session or a tray-menu agent does. No open session for that agent yet -> start one (and it
   * becomes the active tab). Sessions already exist -> switch to the most recent one (`sessions`
   * is newest-first, per listManualSessions), not create a redundant new one. */
  function handleSelectAgentFromPicker(id: string): void {
    const agentSessions = sessions.filter((s) => s.agentId === id);
    if (agentSessions.length === 0) {
      handleNewSession(id);
    } else {
      switchToSession(agentSessions[0]!.id, id);
    }
  }

  function handleSwitchSession(s: SessionSummary): void {
    switchToSession(s.id, s.agentId);
  }

  /** Closes any session, not just the active one -- the context menu on a listed session needs
   * to close it without first switching to it, which the old "Close session" button (bound to
   * whatever `sessionId` happened to be active) couldn't do. */
  async function handleCloseSessionById(id: string): Promise<void> {
    if (busy) return;
    const wasActive = id === sessionId;
    setBusy(true);
    try {
      const { retro } = await cancelSession(id);
      if (wasActive) {
        const learned = retro.saved.map((m) => `(${m.kind}) ${m.content}`);
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            text:
              learned.length > 0
                ? `Session closed. Learned:\n${learned.join("\n")}`
                : "Session closed.",
          },
        ]);
        localStorage.removeItem(LAST_SESSION_KEY);
        setSessionId(null);
      }
      await refreshSessions();
    } catch (e) {
      console.error(`[jstack] cancelSession(${id}) failed:`, e);
      setSessionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  /** The daemon only accepts a plain text message (no attachment field in session/prompt), so a
   * dropped file gets read as text and inlined into the message rather than silently discarded.
   * Anything that isn't text (an image, say) can't be turned into something the agent can
   * actually read yet, so it's called out in the message instead of pretending to attach it. */
  async function attachmentsToText(files: PromptInputMessage["files"]): Promise<string> {
    const INLINEABLE = /^text\/|^application\/(json|javascript|xml|x-yaml|yaml)$|^$/;
    const parts: string[] = [];
    for (const f of files) {
      if (f.mediaType && !INLINEABLE.test(f.mediaType)) {
        parts.push(
          `[Attached "${f.filename}" (${f.mediaType}) -- only text files can be read into the message today, not this type.]`,
        );
        continue;
      }
      try {
        const text = f.url ? await (await fetch(f.url)).text() : "";
        parts.push(`--- ${f.filename} ---\n${text}`);
      } catch (e) {
        console.error(`[jstack] reading attachment "${f.filename}" failed:`, e);
        parts.push(`[Could not read attached file "${f.filename}".]`);
      }
    }
    return parts.join("\n\n");
  }

  async function handlePromptInputSubmit(message: PromptInputMessage): Promise<void> {
    // Guards on THIS session already being busy, not any other -- sessions run independently on
    // the daemon, so session B being idle must never be blocked by session A still processing.
    if (sessionId === null || busySessionIds.has(sessionId)) return;
    const attachmentText =
      message.files.length > 0 ? await attachmentsToText(message.files) : "";
    const text = [message.text.trim(), attachmentText].filter(Boolean).join("\n\n");
    if (text.length === 0) return;
    // Captured now, not read again later -- `sessionId` (the React state/closure variable) can
    // change if the user switches sessions before this request resolves, but this request is
    // always about the session that was active at submit time.
    const targetSessionId = sessionId;
    setMessages((prev) => [...prev, { role: "user", text }]);
    markSessionBusy(targetSessionId);
    const startedAt = Date.now();
    try {
      const result: PromptResult = await promptSession(targetSessionId, text, {
        mode: sessionMode,
        thinkingLevel,
      });
      if (!result.ok) {
        console.error(`[jstack] promptSession(${targetSessionId}) returned ok:false:`, result.text);
      }
      // Only touch the visible transcript if the user is still looking at this session -- if
      // they've since switched away, the reply is already safely stored server-side, and
      // switchToSession's own getSessionHistory call will pick it up naturally if/when they
      // switch back. Applying it to whatever session happens to be on screen right now would put
      // this reply in the wrong transcript entirely.
      if (sessionIdRef.current === targetSessionId) {
        setMessages((prev) => [
          ...prev,
          result.ok
            ? {
                role: "assistant",
                text: result.text,
                costUsd: result.costUsd,
                elapsedMs: Date.now() - startedAt,
                toolEvents: result.toolEvents,
              }
            : { role: "error", text: result.text },
        ]);
      }
    } catch (e) {
      console.error(`[jstack] promptSession(${targetSessionId}) failed:`, e);
      if (sessionIdRef.current === targetSessionId) {
        setMessages((prev) => [
          ...prev,
          { role: "error", text: e instanceof Error ? e.message : String(e) },
        ]);
      }
    } finally {
      markSessionIdle(targetSessionId);
      await refreshSessions();
    }
  }

  /** Text-to-speech via the browser's SpeechSynthesis API, same "no daemon change needed"
   * reasoning as dictation above. Only one message reads aloud at a time. */
  function handleToggleSpeak(index: number, text: string): void {
    if (!("speechSynthesis" in window)) {
      setSessionError("Reading aloud isn't supported in this app's webview.");
      return;
    }
    window.speechSynthesis.cancel();
    if (speakingIndex === index) {
      setSpeakingIndex(null);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setSpeakingIndex(null);
    utterance.onerror = () => setSpeakingIndex(null);
    window.speechSynthesis.speak(utterance);
    setSpeakingIndex(index);
  }

  function renderSessionItem(s: SessionSummary) {
    const displayName = sessionNames[s.id] ?? s.id;
    const isRenaming = renamingSessionId === s.id;
    const color = sessionStatusColor(s, lastSeenTurns);
    const statusDot = (
      <span
        title={s.state}
        className={`size-2 shrink-0 rounded-full ${STATUS_DOT_CLASS[color]}`}
      />
    );
    return (
      <li key={s.id} className="group/session">
        <div
          className={`flex w-full items-center gap-1 rounded-md border p-2 text-sm transition-colors hover:bg-accent ${
            s.id === sessionId ? "border-primary bg-accent" : "border-transparent"
          }`}
        >
          {isRenaming ? (
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              {statusDot}
              <Input
                autoFocus
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitRenameSession();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    cancelRenameSession();
                  }
                }}
                onBlur={commitRenameSession}
                className="h-6 text-sm"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => handleSwitchSession(s)}
              className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
            >
              {statusDot}
              <span className="truncate font-medium">{displayName}</span>
            </button>
          )}
          {!isRenaming && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="icon"
                    size="icon-xs"
                    title="Session options"
                    className="shrink-0 opacity-0 group-hover/session:opacity-100"
                  >
                    <MoreVerticalIcon className="size-3.5" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => startRenameSession(s.id)}>
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setConfirmCloseSessionId(s.id)}
                >
                  Close
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </li>
    );
  }

  // `agents === null` means "still loading," not "none configured" -- render nothing rather
  // than flash the onboarding wizard for a moment on every launch.
  if (agents !== null && agents.length === 0) {
    return (
      <Onboarding
        onCreated={(agent) => {
          setAgents([agent]);
          setAgentId(agent.id);
        }}
      />
    );
  }
  if (agents === null) return <Splash />;

  // Sorted so a glance at the collapsed rail surfaces what needs you first: errors, then
  // questions, then in-progress work, then everything settled.
  const statusPriority: Record<SessionStatusColor, number> = { red: 0, yellow: 1, green: 2, white: 3 };
  const collapsedStatusSessions = [...sessions].sort(
    (a, b) =>
      statusPriority[sessionStatusColor(a, lastSeenTurns)] -
      statusPriority[sessionStatusColor(b, lastSeenTurns)],
  );

  return (
    <TooltipProvider>
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* macOS overlay title bar (see tauri.conf.json's titleBarStyle) -- the collapse toggle
          sits on the same row as the traffic lights, with enough left margin that it can never
          overlap them. tauri.conf.json's window title is set to "" (not "hiddenTitle: true",
          which removes the traffic-light buttons entirely on this Tauri/macOS combination) so no
          title text renders next to the traffic lights -- confirmed via a real screenshot of the
          packaged app, since a browser-based dev-server check can't see native title-bar chrome
          at all and will falsely suggest there's nothing there. The two empty strips (traffic-light
          gutter and
          the gap right of the search box) are dedicated drag regions -- deliberately never on the
          header itself or on a button, so a real click always reaches its button no matter how
          Tauri's drag detection walks the DOM. */}
      <header className="relative flex h-10 shrink-0 items-center border-b pr-2">
        <div data-tauri-drag-region className="h-full w-20 shrink-0" />
        {navigationLayout === "vertical" && (
          <Button
            type="button"
            variant="icon"
            size="icon"
            // macOS pins the traffic lights near the top of the titlebar regardless of how tall
            // this header is, so centering this button in the full h-10 header (like every other
            // header control) sits visibly lower than the dots -- self-start pins it to the same
            // top edge instead, verified pixel-for-pixel against a real screenshot.
            className="self-start"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={handleToggleSidebar}
          >
            {sidebarCollapsed ? (
              <PanelLeftIcon className="size-4" />
            ) : (
              <PanelLeftCloseIcon className="size-4" />
            )}
          </Button>
        )}
        <div data-tauri-drag-region className="h-full flex-1" />
        <Button
          type="button"
          variant="icon"
          size="icon"
          title={`Search chats, agents, settings... (${MOD_KEY_SYMBOL}K)`}
          onClick={() => setShowCommandPalette(true)}
        >
          <SearchIcon className="size-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button type="button" variant="icon" size="icon" title="More">
                <MoreVerticalIcon className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setShowCreateAgent(true)}>
              <PlusIcon className="size-3.5" />
              New agent
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setShowSettings(true)}>
              <SettingsIcon className="size-3.5" />
              Settings
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {navigationLayout === "vertical" && (
        <aside
          aria-label="sessions"
          className={
            sidebarCollapsed
              ? "flex w-14 shrink-0 flex-col items-center gap-2 border-r p-2"
              : "flex shrink-0 flex-col gap-3 overflow-y-auto border-r p-3"
          }
          style={sidebarCollapsed ? undefined : { width: sidebarWidth }}
        >
          <div
            className={
              sidebarCollapsed
                ? "flex flex-col items-center gap-1 border-b"
                : "flex items-center justify-end gap-1 border-b"
            }
          >
            {/* Right-aligned (expanded) / centered (collapsed, no room to align anything).
                A border-b here (not a separate <hr>) gives a clean line break from the session
                list below without adding an extra DOM element or extra padding beyond the
                existing gap-2/gap-3 the parent <aside> already puts between its children. */}
            <NewSessionControls
              agents={agents}
              agentId={agentId}
              onSelectAgent={handleSelectAgentFromPicker}
              avatars={avatars}
              busy={busy}
              onNewChat={() => handleNewSession()}
            />
          </div>

          {sidebarCollapsed ? (
            <div className="flex flex-1 flex-col items-center gap-2 overflow-y-auto pt-1">
              {collapsedStatusSessions.map((s) => {
                const displayName = sessionNames[s.id] ?? s.id;
                const color = sessionStatusColor(s, lastSeenTurns);
                const agentName = agents?.find((a) => a.id === s.agentId)?.name ?? s.agentId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    title={`${displayName} — ${s.state}`}
                    onClick={() => handleSwitchSession(s)}
                    className={`shrink-0 rounded-full ${
                      // Selected gets a thin blue ring instead of the status color -- a status
                      // ring on the one you're already looking at isn't very useful (you're
                      // looking at it), and it needs to look unambiguously different from every
                      // other circle so "which one is active" is obvious at a glance.
                      s.id === sessionId ? "ring-1 ring-blue-500" : `ring-2 ${STATUS_RING_CLASS[color]}`
                    }`}
                  >
                    <AgentAvatar
                      agentId={s.agentId}
                      name={agentName}
                      avatar={avatars[s.agentId]}
                      sizeClassName="size-5"
                    />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
              {!sessionsLoaded ? (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-3/4" />
                </div>
              ) : (
                sessions.length === 0 && (
                  <p className="text-sm text-muted-foreground">No sessions yet</p>
                )
              )}
              {visibleSidebarGroupIds
                .map((id) => ({ id, name: agents.find((a) => a.id === id)?.name ?? id }))
                .map((group) => {
                const items = sessionsByAgent.get(group.id) ?? [];
                if (items.length === 0) return null;
                const open = isGroupOpen(group.id);
                const attention = open ? null : groupAttentionColor(items, lastSeenTurns);
                return (
                  <Collapsible
                    key={group.id}
                    open={open}
                    onOpenChange={(next) => handleGroupOpenChange(group.id, next)}
                    className="group/agent"
                  >
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title={`Change ${group.name}'s avatar`}
                        onClick={() => setAvatarPickerAgent({ id: group.id, name: group.name })}
                        className="shrink-0 rounded-full"
                      >
                        <AgentAvatar
                          agentId={group.id}
                          name={group.name}
                          avatar={avatars[group.id]}
                          sizeClassName="size-5"
                        />
                      </button>
                      <CollapsibleTrigger
                        className={`flex min-w-0 flex-1 items-center gap-1 rounded-md px-1 py-0.5 text-xs font-semibold text-foreground transition-shadow ${
                          attention ? `animate-pulse ${GROUP_ATTENTION_GLOW[attention]}` : ""
                        }`}
                      >
                        <ChevronRightIcon className="size-3 shrink-0 transition-transform group-data-[open]/agent:rotate-90" />
                        <span className="truncate">
                          {group.name} ({items.length})
                        </span>
                      </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent>
                      <ul className="mt-1 ml-4 flex flex-col gap-1">
                        {items.map((s) => renderSessionItem(s))}
                      </ul>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </aside>
        )}

        {navigationLayout === "vertical" && !sidebarCollapsed && (
          // biome-ignore lint/a11y/useKeyWithMouseEvents: a mouse-drag resize handle has no
          // meaningful keyboard equivalent; the collapse button already covers that path.
          <div
            role="separator"
            aria-orientation="vertical"
            title="Drag to resize, or drag past the edge to collapse"
            onMouseDown={handleSidebarResizeStart}
            className={`w-1 shrink-0 cursor-col-resize hover:bg-primary/30 ${
              isResizingSidebar ? "bg-primary/40" : "bg-transparent"
            }`}
          />
        )}

        <div className="flex flex-1 flex-col overflow-hidden">
          {navigationLayout === "horizontal" && (
            <SessionTabStrip
              sessions={sessions}
              sessionId={sessionId}
              agents={agents ?? []}
              avatars={avatars}
              sessionNames={sessionNames}
              lastSeenTurns={lastSeenTurns}
              onSelect={handleSwitchSession}
              onClose={setConfirmCloseSessionId}
              busy={busy}
              agentId={agentId}
              onSelectAgent={handleSelectAgentFromPicker}
              onNewChat={() => handleNewSession()}
            />
          )}
          {/* No border here -- the composer below already has its own (InputGroup's
              border-input + rounded-lg); framing the whole pane too just nested one box
              inside another. */}
          <main className="m-2 flex flex-1 flex-col overflow-hidden p-4">
        {sessionError && (
          <p className="mb-2 text-center text-sm text-destructive">{sessionError}</p>
        )}

        <Conversation
          aria-label="messages"
          style={{
            // Fades the top/bottom couple lines of the scroll area to transparent, so a message
            // sliding under the edge reads as "fading out," not "getting clipped." WebKit prefix
            // is required, not optional -- Tauri's macOS webview is WKWebView, which does not
            // understand unprefixed mask-image.
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent, black 24px, black calc(100% - 24px), transparent)",
            maskImage:
              "linear-gradient(to bottom, transparent, black 24px, black calc(100% - 24px), transparent)",
          }}
        >
          {(sessionId === null || (!historyLoading && messages.length === 0)) && (
            <img
              src="/jstack-mark.png"
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 m-auto size-64 select-none opacity-[0.04] dark:opacity-[0.06]"
            />
          )}
          <ConversationContent>
            {sessionId === null ? (
              <ConversationEmptyState
                icon={<PlayCircleIcon className="size-8" />}
                title="No session yet"
                description="Click the + in the sidebar to start chatting."
              />
            ) : historyLoading ? (
              <div className="flex flex-col gap-4 p-4">
                <Skeleton className="ml-auto h-10 w-2/5 rounded-2xl" />
                <Skeleton className="h-16 w-3/5 rounded-2xl" />
                <Skeleton className="ml-auto h-10 w-1/3 rounded-2xl" />
              </div>
            ) : messages.length === 0 ? (
              <ConversationEmptyState
                icon={<MessageCircleIcon className="size-8" />}
                title="Say something to get started"
                description={`Chatting with ${agentId}`}
              />
            ) : null}
            {messages.map((m, i) => {
              if (m.role === "system") {
                return (
                  <p
                    key={i}
                    data-role="system"
                    className="text-center text-xs italic text-muted-foreground whitespace-pre-line"
                  >
                    {m.text}
                  </p>
                );
              }
              if (m.role === "user") {
                return (
                  <Message key={i} from="user" data-role="user">
                    <MessageContent>{m.text}</MessageContent>
                  </Message>
                );
              }
              if (m.role === "error") {
                return (
                  <Message key={i} from="assistant" data-role="error">
                    <MessageContent className="bg-destructive/10 text-destructive">
                      {m.text}
                    </MessageContent>
                  </Message>
                );
              }
              return (
                <Message key={i} from="assistant" data-role="assistant">
                  {m.toolEvents.map((t, j) => (
                    <Tool key={j}>
                      <ToolHeader
                        type="dynamic-tool"
                        toolName={t.name}
                        state={
                          t.output === undefined
                            ? "input-available"
                            : t.isError
                              ? "output-error"
                              : "output-available"
                        }
                        filePath={extractFilePath(t.input)}
                        onOpenFile={handleOpenFile}
                      />
                      <ToolContent>
                        <ToolInput input={t.input} />
                        {t.output !== undefined && (
                          <ToolOutput
                            output={t.output}
                            errorText={t.isError ? t.output : undefined}
                            language={toolOutputLanguage(t.name)}
                          />
                        )}
                      </ToolContent>
                    </Tool>
                  ))}
                  <MessageContent>
                    <MessageResponse>{m.text}</MessageResponse>
                    <div className="mt-1 flex items-center gap-1">
                      <Button
                        type="button"
                        variant="icon"
                        size="icon-xs"
                        title={speakingIndex === i ? "Stop reading aloud" : "Read aloud"}
                        onClick={() => handleToggleSpeak(i, m.text)}
                      >
                        {speakingIndex === i ? (
                          <VolumeXIcon className="size-3" />
                        ) : (
                          <Volume2Icon className="size-3" />
                        )}
                      </Button>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <span className="cursor-default text-xs text-muted-foreground">
                              {formatElapsed(m.elapsedMs)}
                            </span>
                          }
                        />
                        <TooltipContent>${m.costUsd.toFixed(4)}</TooltipContent>
                      </Tooltip>
                    </div>
                  </MessageContent>
                </Message>
              );
            })}
            {pendingSince !== null && (
              <Message from="assistant" data-role="thinking">
                <MessageContent>
                  <Reasoning isStreaming>
                    <ReasoningTrigger
                      getThinkingMessage={() => (
                        <Shimmer duration={1}>
                          {`Thinking... ${formatElapsed(nowTick - pendingSince)}`}
                        </Shimmer>
                      )}
                    />
                  </Reasoning>
                </MessageContent>
              </Message>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <PromptInput className="mt-2" multiple onSubmit={handlePromptInputSubmit}>
          <PromptInputAttachments>
            {(attachment) => <PromptInputAttachment data={attachment} />}
          </PromptInputAttachments>
          <PromptInputBody>
            <PromptInputTextarea
              ref={textareaRef}
              aria-label="message"
              placeholder={sessionId ? "Say something..." : "Start a session first"}
              disabled={sessionId === null || currentSessionBusy}
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger disabled={sessionId === null || currentSessionBusy} />
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
              <PromptInputSpeechButton
                textareaRef={textareaRef}
                title="Dictate"
                disabled={sessionId === null || currentSessionBusy}
              />
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="icon"
                      size="icon"
                      title={`Thinking level: ${THINKING_LEVEL_LABEL[thinkingLevel]}`}
                      aria-label="Thinking level"
                      className={thinkingLevel !== "none" ? "text-primary" : undefined}
                    >
                      <BrainIcon className="size-4" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="start">
                  {(Object.keys(THINKING_LEVEL_LABEL) as ThinkingLevel[]).map((level) => (
                    <DropdownMenuItem
                      key={level}
                      onClick={() => setThinkingLevel(level)}
                      className={level === thinkingLevel ? "font-semibold" : undefined}
                    >
                      {THINKING_LEVEL_LABEL[level]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="icon"
                      size="icon"
                      title={`Mode: ${SESSION_MODE_LABEL[sessionMode]}`}
                      aria-label="Session mode"
                      className={sessionMode === "ask" ? "text-primary" : undefined}
                    >
                      {sessionMode === "ask" ? (
                        <ShieldIcon className="size-4" />
                      ) : (
                        <ShieldCheckIcon className="size-4" />
                      )}
                    </Button>
                  }
                />
                <DropdownMenuContent align="start">
                  {(Object.keys(SESSION_MODE_LABEL) as SessionMode[]).map((mode) => (
                    <DropdownMenuItem
                      key={mode}
                      onClick={() => setSessionMode(mode)}
                      className={mode === sessionMode ? "font-semibold" : undefined}
                    >
                      {SESSION_MODE_LABEL[mode]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </PromptInputTools>
            <PromptInputSubmit
              aria-label="Send"
              status={currentSessionBusy ? "submitted" : undefined}
              disabled={sessionId === null || currentSessionBusy}
            />
          </PromptInputFooter>
        </PromptInput>
          </main>
        </div>
      </div>

      <CreateAgentDialog
        open={showCreateAgent}
        onOpenChange={setShowCreateAgent}
        onCreated={async (agent) => {
          await refreshAgents();
          setAgentId(agent.id);
        }}
      />

      <SettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        onRefresh={refreshSessions}
        agents={agents}
        agentId={agentId}
        onAgentUpdated={() => refreshAgents()}
        navigationLayout={navigationLayout}
        onNavigationLayoutChange={setNavigationLayout}
        activeTab={settingsTab}
        onActiveTabChange={setSettingsTab}
      />

      <ConfirmDialog
        open={confirmCloseSessionId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmCloseSessionId(null);
        }}
        title="Close session?"
        description={`This ends "${
          confirmCloseSessionId ? (sessionNames[confirmCloseSessionId] ?? confirmCloseSessionId) : ""
        }". Anything worth remembering is saved to the agent's notes first, but the conversation itself can't be reopened.`}
        confirmLabel="Close session"
        onConfirm={() => {
          if (confirmCloseSessionId) void handleCloseSessionById(confirmCloseSessionId);
        }}
      />

      {avatarPickerAgent && (
        <AvatarPickerDialog
          open
          onOpenChange={(open) => {
            if (!open) setAvatarPickerAgent(null);
          }}
          agentId={avatarPickerAgent.id}
          agentName={avatarPickerAgent.name}
          currentAvatar={avatars[avatarPickerAgent.id]}
          onChange={() => setAvatars(loadAllAgentAvatars())}
        />
      )}

      <CommandPalette
        open={showCommandPalette}
        onOpenChange={setShowCommandPalette}
        agents={agents}
        sessions={sessions}
        sessionNames={sessionNames}
        onSwitchSession={handleSwitchSession}
        onSwitchAgent={setAgentId}
        onNewChat={() => handleNewSession()}
        onNewAgent={() => setShowCreateAgent(true)}
        onOpenSettings={() => setShowSettings(true)}
        onToggleSidebar={handleToggleSidebar}
      />
    </div>
    </TooltipProvider>
  );
}

export default App;

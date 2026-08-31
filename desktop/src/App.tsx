import { useEffect, useMemo, useState } from "react";
import {
  cancelSession,
  getSessionHistory,
  listAgents,
  listSessions,
  newSession,
  promptSession,
  type AgentSummary,
  type PromptResult,
  type SessionSummary,
  type ToolCallEvent,
} from "./lib/agent";
import { Onboarding } from "./components/Onboarding";
import { SettingsDialog } from "./components/SettingsDialog";
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
} from "./components/ai-elements/tool";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./components/ui/collapsible";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "./components/ui/context-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import {
  ChevronRightIcon,
  FolderIcon,
  FolderPlusIcon,
  MessageCircleIcon,
  PanelLeftCloseIcon,
  PanelLeftIcon,
  PlayCircleIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";

/** Remembers which session was open across app restarts -- the daemon already persists every
 * session's transcript (transcript.ts); this is just which one to reopen without asking. */
const LAST_SESSION_KEY = "jstack.lastSessionId";

/**
 * Session folders are a client-side organizational overlay, not a daemon concept -- crew's
 * store has no notion of "folders," and every session still belongs to exactly one real crew
 * agent regardless of which folder it's filed under. Persisted in localStorage (survives app
 * restarts, same durability tier as `LAST_SESSION_KEY`) rather than round-tripped through the
 * daemon, since grouping is purely a UI convenience over data the daemon already owns.
 */
const FOLDERS_KEY = "jstack.folders";
const SESSION_FOLDER_KEY = "jstack.sessionFolder";
const SESSION_NAME_KEY = "jstack.sessionName";
const SIDEBAR_COLLAPSED_KEY = "jstack.sidebarCollapsed";
const UNFILED = "unfiled";

interface Folder {
  id: string;
  name: string;
}

function loadFolders(): Folder[] {
  try {
    const raw = localStorage.getItem(FOLDERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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

type ChatMessage =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; costUsd: number; toolEvents: ToolCallEvent[] }
  | { role: "error"; text: string }
  | { role: "system"; text: string };

/**
 * The chat view: Vercel AI Elements (Conversation/Message/Tool) render the transcript, including
 * tool-call events inline on assistant turns; the rest of the chrome (sidebar, composer, session
 * controls) uses shadcn/ui primitives (Button/Input/Badge) + Tailwind utilities directly, rather
 * than AI Elements' full PromptInput, which brings attachment/model-selector/speech-input
 * features this app doesn't use.
 */
function App() {
  const [agents, setAgents] = useState<AgentSummary[] | null>(null);
  const [agentId, setAgentId] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [folders, setFolders] = useState<Folder[]>(() => loadFolders());
  const [sessionFolder, setSessionFolder] = useState<Record<string, string>>(() =>
    loadStringMap(SESSION_FOLDER_KEY),
  );
  const [sessionNames, setSessionNames] = useState<Record<string, string>>(() =>
    loadStringMap(SESSION_NAME_KEY),
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1",
  );

  /** Splits a list of sessions (already scoped to one agent) into user-created folders vs.
   * Unfiled -- reused per-agent, since folders organize within an agent's chats, not across
   * agents (that's what the agent grouping itself is for). */
  function splitByFolder(list: SessionSummary[]) {
    const byFolder = new Map<string, SessionSummary[]>();
    const unfiled: SessionSummary[] = [];
    for (const s of list) {
      const fid = sessionFolder[s.id];
      if (fid && folders.some((f) => f.id === fid)) {
        const bucket = byFolder.get(fid) ?? [];
        bucket.push(s);
        byFolder.set(fid, bucket);
      } else {
        unfiled.push(s);
      }
    }
    return { byFolder, unfiled };
  }

  const sessionsByAgent = useMemo(() => {
    const map = new Map<string, SessionSummary[]>();
    for (const s of sessions) {
      const bucket = map.get(s.agentId) ?? [];
      bucket.push(s);
      map.set(s.agentId, bucket);
    }
    return map;
  }, [sessions]);

  function handleToggleSidebar(): void {
    setSidebarCollapsed((v) => {
      const next = !v;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      return next;
    });
  }

  function handleCreateFolder(): void {
    const name = window.prompt("Folder name?")?.trim();
    if (!name) return;
    const next = [...folders, { id: crypto.randomUUID(), name }];
    setFolders(next);
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(next));
  }

  function handleDeleteFolder(folderId: string): void {
    setFolders((prev) => {
      const next = prev.filter((f) => f.id !== folderId);
      localStorage.setItem(FOLDERS_KEY, JSON.stringify(next));
      return next;
    });
    setSessionFolder((prev) => {
      const next = { ...prev };
      for (const sid of Object.keys(next)) {
        if (next[sid] === folderId) delete next[sid];
      }
      localStorage.setItem(SESSION_FOLDER_KEY, JSON.stringify(next));
      return next;
    });
  }

  function handleAssignFolder(sessionIdToMove: string, folderId: string): void {
    setSessionFolder((prev) => {
      const next = { ...prev };
      if (folderId === UNFILED) delete next[sessionIdToMove];
      else next[sessionIdToMove] = folderId;
      localStorage.setItem(SESSION_FOLDER_KEY, JSON.stringify(next));
      return next;
    });
  }

  function handleRenameSession(id: string): void {
    const name = window.prompt("Rename session", sessionNames[id] ?? "")?.trim();
    if (name === undefined) return; // cancelled, as opposed to cleared with an empty string
    setSessionNames((prev) => {
      const next = { ...prev };
      if (name) next[id] = name;
      else delete next[id]; // empty name reverts to showing the raw session id
      localStorage.setItem(SESSION_NAME_KEY, JSON.stringify(next));
      return next;
    });
  }

  async function refreshSessions(): Promise<SessionSummary[]> {
    try {
      const list = await listSessions();
      setSessions(list);
      return list;
    } catch (e) {
      // Session list is a convenience panel; a daemon that's briefly unreachable shouldn't
      // block the rest of the UI the way a failed chat action does -- still logged, though, so
      // a silent daemon-connection problem doesn't go unnoticed.
      console.error("[jstack] refreshSessions failed:", e);
      return [];
    }
  }

  function transcriptToMessages(
    history: Awaited<ReturnType<typeof getSessionHistory>>,
  ): ChatMessage[] {
    return history.map((entry) =>
      entry.role === "assistant"
        ? {
            role: "assistant",
            text: entry.text,
            costUsd: entry.costUsd,
            toolEvents: entry.toolEvents,
          }
        : entry,
    );
  }

  async function switchToSession(id: string, agent: string): Promise<void> {
    setSessionId(id);
    setAgentId(agent);
    setSessionError(null);
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

  async function handleNewSession(): Promise<void> {
    if (!agentId) return;
    setSessionError(null);
    setBusy(true);
    try {
      const created = await newSession(agentId);
      setSessionId(created.id);
      setMessages([]);
      localStorage.setItem(LAST_SESSION_KEY, created.id);
      await refreshSessions();
    } catch (e) {
      console.error(`[jstack] newSession(${agentId}) failed:`, e);
      setSessionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
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

  async function handleSend(): Promise<void> {
    const text = draft.trim();
    if (text.length === 0 || sessionId === null || busy) return;
    setDraft("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setBusy(true);
    try {
      const result: PromptResult = await promptSession(sessionId, text);
      if (!result.ok) console.error(`[jstack] promptSession(${sessionId}) returned ok:false:`, result.text);
      setMessages((prev) => [
        ...prev,
        result.ok
          ? {
              role: "assistant",
              text: result.text,
              costUsd: result.costUsd,
              toolEvents: result.toolEvents,
            }
          : { role: "error", text: result.text },
      ]);
    } catch (e) {
      console.error(`[jstack] promptSession(${sessionId}) failed:`, e);
      setMessages((prev) => [
        ...prev,
        { role: "error", text: e instanceof Error ? e.message : String(e) },
      ]);
    } finally {
      setBusy(false);
      await refreshSessions();
    }
  }

  function renderSessionItem(s: SessionSummary) {
    const displayName = sessionNames[s.id] ?? s.id;
    return (
      <li key={s.id}>
        <ContextMenu>
          <ContextMenuTrigger>
            <button
              type="button"
              onClick={() => handleSwitchSession(s)}
              className={`flex w-full flex-col items-start gap-1 rounded-md border p-2 text-left text-sm transition-colors hover:bg-accent ${
                s.id === sessionId ? "border-primary bg-accent" : "border-transparent"
              }`}
            >
              <span className="font-medium">{displayName}</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Badge variant="secondary" className="text-[10px]">
                  {s.state}
                </Badge>
                {s.turns} turn{s.turns === 1 ? "" : "s"}
              </span>
            </button>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={() => handleRenameSession(s.id)}>Rename</ContextMenuItem>
            <ContextMenuItem onClick={() => handleCloseSessionById(s.id)}>Close</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        {folders.length > 0 && (
          <Select
            value={sessionFolder[s.id] ?? UNFILED}
            onValueChange={(v) => handleAssignFolder(s.id, v ?? UNFILED)}
          >
            <SelectTrigger size="sm" className="mt-1 h-6 w-full text-[10px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNFILED}>Unfiled</SelectItem>
              {folders.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
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
  if (agents === null) return null;

  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside
        aria-label="sessions"
        className={
          sidebarCollapsed
            ? "flex w-14 shrink-0 flex-col items-center gap-2 border-r p-2"
            : "flex w-64 shrink-0 flex-col gap-6 overflow-y-auto border-r p-4"
        }
      >
        <div className="flex w-full items-center justify-between gap-1">
          {!sidebarCollapsed && (
            <h2 className="text-sm font-semibold text-muted-foreground">Sessions</h2>
          )}
          <div className="flex items-center gap-1">
            {!sidebarCollapsed && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="New folder"
                onClick={handleCreateFolder}
              >
                <FolderPlusIcon className="size-4" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="New chat"
              onClick={handleNewSession}
              disabled={busy}
            >
              <PlusIcon className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={handleToggleSidebar}
            >
              {sidebarCollapsed ? (
                <PanelLeftIcon className="size-4" />
              ) : (
                <PanelLeftCloseIcon className="size-4" />
              )}
            </Button>
            {!sidebarCollapsed && <SettingsDialog onRefresh={refreshSessions} />}
          </div>
        </div>

        {!sidebarCollapsed && (
          <>
            {agents && agents.length > 1 && (
              <Select value={agentId} onValueChange={(v) => v && setAgentId(v)}>
                <SelectTrigger size="sm" className="w-full" aria-label="agent for new chats">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
              {sessions.length === 0 && (
                <p className="text-sm text-muted-foreground">No sessions yet</p>
              )}
              {/* Known agents first, then any agentId a session references that isn't in the
                  current agent list (a deleted or renamed agent) -- a session must never just
                  silently vanish from the sidebar because its agent no longer exists. */}
              {[
                ...agents.map((a) => ({ id: a.id, name: a.name })),
                ...[...sessionsByAgent.keys()]
                  .filter((aid) => !agents.some((a) => a.id === aid))
                  .map((aid) => ({ id: aid, name: aid })),
              ].map((group) => {
                const items = sessionsByAgent.get(group.id) ?? [];
                if (items.length === 0) return null;
                const { byFolder, unfiled } = splitByFolder(items);
                return (
                  <Collapsible key={group.id} defaultOpen className="group/agent">
                    <CollapsibleTrigger className="flex w-full items-center gap-1 text-xs font-semibold text-foreground">
                      <ChevronRightIcon className="size-3 transition-transform group-data-[state=open]/agent:rotate-90" />
                      {group.name} ({items.length})
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-1 ml-4 flex flex-col gap-3">
                        {folders.map((f) => {
                          const folderItems = byFolder.get(f.id) ?? [];
                          return (
                            <Collapsible key={f.id} defaultOpen className="group/folder">
                              <div className="flex items-center justify-between gap-1">
                                <CollapsibleTrigger className="flex flex-1 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                                  <ChevronRightIcon className="size-3 transition-transform group-data-[state=open]/folder:rotate-90" />
                                  <FolderIcon className="size-3" />
                                  {f.name} ({folderItems.length})
                                </CollapsibleTrigger>
                                <button
                                  type="button"
                                  title="Delete folder"
                                  onClick={() => handleDeleteFolder(f.id)}
                                  className="text-muted-foreground hover:text-destructive"
                                >
                                  <XIcon className="size-3" />
                                </button>
                              </div>
                              <CollapsibleContent>
                                <ul className="mt-1 ml-4 flex flex-col gap-1">
                                  {folderItems.length === 0 ? (
                                    <li className="text-xs text-muted-foreground">Empty</li>
                                  ) : (
                                    folderItems.map((s) => renderSessionItem(s))
                                  )}
                                </ul>
                              </CollapsibleContent>
                            </Collapsible>
                          );
                        })}
                        {unfiled.length > 0 && (
                          <ul className="flex flex-col gap-1">
                            {unfiled.map((s) => renderSessionItem(s))}
                          </ul>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          </>
        )}
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden p-4">
        <h1 className="mb-4 text-center text-xl font-semibold">
          {agents?.find((a) => a.id === agentId)?.name ?? "jstack"}
        </h1>

        {sessionError && (
          <p className="text-center text-sm text-destructive">{sessionError}</p>
        )}
        {sessionId && (
          <div className="mb-2 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span>session {sessionNames[sessionId] ?? sessionId}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleCloseSessionById(sessionId)}
              disabled={busy}
            >
              Close session
            </Button>
          </div>
        )}

        <Conversation aria-label="messages">
          <ConversationContent>
            {sessionId === null ? (
              <ConversationEmptyState
                icon={<PlayCircleIcon className="size-8" />}
                title="No session yet"
                description="Click the + in the sidebar to start chatting."
              />
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
                    <Tool key={j} defaultOpen>
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
                      />
                      <ToolContent>
                        <ToolInput input={t.input} />
                        {t.output !== undefined && (
                          <ToolOutput
                            output={t.output}
                            errorText={t.isError ? t.output : undefined}
                          />
                        )}
                      </ToolContent>
                    </Tool>
                  ))}
                  <MessageContent>
                    <MessageResponse>{m.text}</MessageResponse>
                    <span className="text-xs text-muted-foreground"> (${m.costUsd.toFixed(4)})</span>
                  </MessageContent>
                </Message>
              );
            })}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <Input
            aria-label="message"
            value={draft}
            onChange={(e) => setDraft(e.currentTarget.value)}
            placeholder={sessionId ? "Say something..." : "Start a session first"}
            disabled={sessionId === null || busy}
          />
          <Button type="submit" disabled={sessionId === null || busy}>
            {busy ? "..." : "Send"}
          </Button>
        </form>
      </main>
    </div>
  );
}

export default App;

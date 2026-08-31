import { useEffect, useState } from "react";
import {
  cancelSession,
  daemonStatus,
  getSessionHistory,
  listSessions,
  newSession,
  promptSession,
  recentLogs,
  type DaemonStatus,
  type PromptResult,
  type SessionSummary,
  type ToolCallEvent,
} from "./lib/agent";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "./components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "./components/ai-elements/message";
import { Tool, ToolContent, ToolHeader, ToolInput } from "./components/ai-elements/tool";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";

/** How often the debug panel polls logs/recent while open. The RPC transport has no
 * push/streaming, so "live" here means "refreshed on this interval," not truly real-time. */
const LOG_POLL_MS = 3000;
/** Remembers which session was open across app restarts -- the daemon already persists every
 * session's transcript (transcript.ts); this is just which one to reopen without asking. */
const LAST_SESSION_KEY = "jstack.lastSessionId";

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
  const [agentId, setAgentId] = useState("ralph");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [status, setStatus] = useState<DaemonStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [logError, setLogError] = useState<string | null>(null);

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

  async function refreshStatus(): Promise<void> {
    try {
      setStatus(await daemonStatus());
      setStatusError(null);
    } catch (e) {
      console.error("[jstack] daemonStatus failed:", e);
      setStatusError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    (async () => {
      const list = await refreshSessions();
      const lastId = localStorage.getItem(LAST_SESSION_KEY);
      const last = lastId ? list.find((s) => s.id === lastId) : undefined;
      if (last) await switchToSession(last.id, last.agentId);
    })();
    refreshStatus();
  }, []);

  useEffect(() => {
    if (!showDebug) return;
    let cancelled = false;
    const poll = async (): Promise<void> => {
      try {
        const { lines } = await recentLogs();
        if (!cancelled) {
          setLogLines(lines);
          setLogError(null);
        }
      } catch (e) {
        console.error("[jstack] recentLogs failed:", e);
        if (!cancelled) setLogError(e instanceof Error ? e.message : String(e));
      }
    };
    poll();
    const interval = setInterval(poll, LOG_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [showDebug]);

  async function handleNewSession(): Promise<void> {
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

  async function handleCloseSession(): Promise<void> {
    if (sessionId === null || busy) return;
    const closingId = sessionId;
    setBusy(true);
    try {
      const { retro } = await cancelSession(closingId);
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
      await refreshSessions();
    } catch (e) {
      console.error(`[jstack] cancelSession(${closingId}) failed:`, e);
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
      await refreshStatus();
    }
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside
        aria-label="sessions"
        className="flex w-64 shrink-0 flex-col gap-6 overflow-y-auto border-r p-4"
      >
        <div>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Sessions</h2>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sessions yet</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {sessions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => handleSwitchSession(s)}
                    className={`flex w-full flex-col items-start gap-1 rounded-md border p-2 text-left text-sm transition-colors hover:bg-accent ${
                      s.id === sessionId ? "border-primary bg-accent" : "border-transparent"
                    }`}
                  >
                    <span className="font-medium">{s.id}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      {s.agentId}
                      <Badge variant="secondary" className="text-[10px]">
                        {s.state}
                      </Badge>
                      {s.turns} turn{s.turns === 1 ? "" : "s"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div aria-label="daemon status">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Status</h2>
          {statusError && <p className="mb-2 text-sm text-destructive">{statusError}</p>}
          {status && (
            <ul className="mb-2 flex flex-col gap-0.5 text-xs text-muted-foreground">
              <li>enabled: {String(status.enabled)}</li>
              <li>mode: {status.mode}</li>
              <li>tasks: {status.tasks}</li>
              <li>spent today: ${status.spentToday.toFixed(4)}</li>
            </ul>
          )}
          <Button type="button" variant="outline" size="sm" onClick={refreshStatus}>
            Refresh
          </Button>
        </div>

        <div aria-label="debug logs">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowDebug((v) => !v)}
          >
            {showDebug ? "Hide debug logs" : "Show debug logs"}
          </Button>
          {showDebug && (
            <>
              {logError && <p className="mt-2 text-sm text-destructive">{logError}</p>}
              <ul className="mt-2 max-h-60 overflow-y-auto rounded-md bg-muted p-2 font-mono text-xs break-all">
                {logLines.length === 0 && (
                  <li className="text-muted-foreground">No log lines yet</li>
                )}
                {logLines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden p-4">
        <h1 className="mb-4 text-center text-xl font-semibold">jstack</h1>

        <div className="mb-2 flex justify-center gap-2">
          <Input
            aria-label="agent id"
            value={agentId}
            onChange={(e) => setAgentId(e.currentTarget.value)}
            placeholder="agent id (e.g. ralph)"
            disabled={busy}
            className="max-w-xs"
          />
          <Button type="button" onClick={handleNewSession} disabled={busy}>
            New session
          </Button>
        </div>
        {sessionError && (
          <p className="text-center text-sm text-destructive">{sessionError}</p>
        )}
        {sessionId && (
          <div className="mb-2 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span>session {sessionId}</span>
            <Button type="button" variant="ghost" size="sm" onClick={handleCloseSession} disabled={busy}>
              Close session
            </Button>
          </div>
        )}

        <Conversation aria-label="messages">
          <ConversationContent>
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
                        state="output-available"
                      />
                      <ToolContent>
                        <ToolInput input={t.input} />
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

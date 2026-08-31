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
import { Button } from "./components/ui/button";

/** How often the debug panel polls logs/recent while open. The RPC transport has no
 * push/streaming, so "live" here means "refreshed on this interval," not truly real-time. */
const LOG_POLL_MS = 3000;
/** Remembers which session was open across app restarts -- the daemon already persists every
 * session's transcript (transcript.ts); this is just which one to reopen without asking. */
const LAST_SESSION_KEY = "jstack.lastSessionId";
import "./App.css";

type ChatMessage =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; costUsd: number; toolEvents: ToolCallEvent[] }
  | { role: "error"; text: string }
  | { role: "system"; text: string };

/**
 * The chat view: Vercel AI Elements (Conversation/Message/Tool, on shadcn/ui + Tailwind) render
 * the transcript, including tool-call events inline on assistant turns -- the composer and
 * sidebar (sessions/status/debug) stay plain markup, since AI Elements' full PromptInput brings
 * attachments/model-selector/speech-input features this app doesn't have.
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
    } catch {
      // Session list is a convenience panel; a daemon that's briefly unreachable shouldn't
      // block the rest of the UI the way a failed chat action does.
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
    <div className="app-layout">
      <aside className="sidebar" aria-label="sessions">
        <h2>Sessions</h2>
        <ul className="session-list">
          {sessions.length === 0 && <li className="empty">No sessions yet</li>}
          {sessions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className={s.id === sessionId ? "session-item active" : "session-item"}
                onClick={() => handleSwitchSession(s)}
              >
                <span className="session-item-id">{s.id}</span>
                <span className="session-item-meta">
                  {s.agentId} · {s.state} · {s.turns} turn{s.turns === 1 ? "" : "s"}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="status-panel" aria-label="daemon status">
          <h2>Status</h2>
          {statusError && <p className="error">{statusError}</p>}
          {status && (
            <ul className="status-list">
              <li>enabled: {String(status.enabled)}</li>
              <li>mode: {status.mode}</li>
              <li>tasks: {status.tasks}</li>
              <li>spent today: ${status.spentToday.toFixed(4)}</li>
            </ul>
          )}
          <button type="button" onClick={refreshStatus}>
            Refresh
          </button>
        </div>

        <div className="debug-panel" aria-label="debug logs">
          <button type="button" onClick={() => setShowDebug((v) => !v)}>
            {showDebug ? "Hide debug logs" : "Show debug logs"}
          </button>
          {showDebug && (
            <>
              {logError && <p className="error">{logError}</p>}
              <ul className="log-list">
                {logLines.length === 0 && <li className="empty">No log lines yet</li>}
                {logLines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden p-4">
        <h1 className="mb-2 text-center text-xl font-semibold">jstack</h1>

        <div className="row">
          <input
            aria-label="agent id"
            value={agentId}
            onChange={(e) => setAgentId(e.currentTarget.value)}
            placeholder="agent id (e.g. ralph)"
            disabled={busy}
          />
          <button type="button" onClick={handleNewSession} disabled={busy}>
            New session
          </button>
        </div>
        {sessionError && <p className="error">{sessionError}</p>}
        {sessionId && (
          <p className="session-id">
            session {sessionId}{" "}
            <button type="button" onClick={handleCloseSession} disabled={busy}>
              Close session
            </button>
          </p>
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
                    <span className="cost text-xs text-muted-foreground">
                      {" "}
                      (${m.costUsd.toFixed(4)})
                    </span>
                  </MessageContent>
                </Message>
              );
            })}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <input
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

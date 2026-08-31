import { useEffect, useState } from "react";
import {
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
 * Minimal, functional-first chat view: proves the daemon round trip works end to end (create a
 * session, send a message, see a real reply, switch between sessions) before any visual polish.
 * Deliberately plain CSS, not shadcn/AI Elements yet -- that pass is pending real jstack
 * branding assets and is a separate concern from whether the plumbing works.
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

      <main className="container">
        <h1>jstack</h1>

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
        {sessionId && <p className="session-id">session {sessionId}</p>}

        <ul className="messages" aria-label="messages">
          {messages.map((m, i) => (
            <li key={i} className={`message message-${m.role}`}>
              {m.role === "assistant" && m.toolEvents.length > 0 && (
                <ul className="tool-events" aria-label="tool calls">
                  {m.toolEvents.map((t, j) => (
                    <li key={j} className="tool-event">
                      <span aria-hidden="true">🔧</span>
                      <span className="tool-event-name">{t.name}</span>
                      <code>{JSON.stringify(t.input)}</code>
                    </li>
                  ))}
                </ul>
              )}
              {m.text}
              {m.role === "assistant" && (
                <span className="cost"> (${m.costUsd.toFixed(4)})</span>
              )}
            </li>
          ))}
        </ul>

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
          <button type="submit" disabled={sessionId === null || busy}>
            {busy ? "..." : "Send"}
          </button>
        </form>
      </main>
    </div>
  );
}

export default App;

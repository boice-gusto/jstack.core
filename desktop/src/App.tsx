import { useEffect, useState } from "react";
import {
  daemonStatus,
  listSessions,
  newSession,
  promptSession,
  type DaemonStatus,
  type PromptResult,
  type SessionSummary,
} from "./lib/agent";
import "./App.css";

type ChatMessage =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; costUsd: number }
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

  async function refreshSessions(): Promise<void> {
    try {
      setSessions(await listSessions());
    } catch {
      // Session list is a convenience panel; a daemon that's briefly unreachable shouldn't
      // block the rest of the UI the way a failed chat action does.
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
    refreshSessions();
    refreshStatus();
  }, []);

  async function handleNewSession(): Promise<void> {
    setSessionError(null);
    setBusy(true);
    try {
      const created = await newSession(agentId);
      setSessionId(created.id);
      setMessages([]);
      await refreshSessions();
    } catch (e) {
      setSessionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function handleSwitchSession(s: SessionSummary): void {
    setSessionId(s.id);
    setAgentId(s.agentId);
    setSessionError(null);
    setMessages([
      {
        role: "system",
        text: `Switched to ${s.id} (${s.agentId}). The daemon remembers this conversation; this window doesn't show its past messages.`,
      },
    ]);
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
          ? { role: "assistant", text: result.text, costUsd: result.costUsd }
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

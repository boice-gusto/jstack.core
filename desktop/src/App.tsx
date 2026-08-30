import { useState } from "react";
import { newSession, promptSession, type PromptResult } from "./lib/agent";
import "./App.css";

type ChatMessage =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; costUsd: number }
  | { role: "error"; text: string };

/**
 * Minimal, functional-first chat view: proves the daemon round trip works end to end (create a
 * session, send a message, see a real reply) before any visual polish. Deliberately plain CSS,
 * not shadcn/AI Elements yet -- that pass is pending real jstack branding assets and is a
 * separate concern from whether the plumbing works.
 */
function App() {
  const [agentId, setAgentId] = useState("ralph");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  async function handleNewSession(): Promise<void> {
    setSessionError(null);
    setBusy(true);
    try {
      const created = await newSession(agentId);
      setSessionId(created.id);
      setMessages([]);
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
    }
  }

  return (
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
  );
}

export default App;

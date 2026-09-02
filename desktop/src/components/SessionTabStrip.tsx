import { XIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import type { AgentSummary, SessionSummary } from "../lib/agent";
import type { AgentAvatar as AgentAvatarValue } from "../lib/avatars";
import { sessionStatusColor, STATUS_DOT_CLASS } from "../lib/sessionStatus";
import { AgentAvatar } from "./AgentAvatar";
import { NewSessionControls } from "./NewSessionControls";

/**
 * The "horizontal" alternative to the sidebar's agent-grouped session list -- every open session
 * across every agent as one flat row of browser-style tabs, for people who'd rather switch chats
 * left/right along the top than up/down in a side panel. Lives above `<main>`, full width, in
 * place of the sidebar (see App.tsx's `navigationLayout` state).
 */
export function SessionTabStrip({
  sessions,
  sessionId,
  agents,
  avatars,
  sessionNames,
  lastSeenTurns,
  onSelect,
  onClose,
  busy,
  agentId,
  onSelectAgent,
  onNewChat,
}: {
  sessions: SessionSummary[];
  sessionId: string | null;
  agents: AgentSummary[];
  avatars: Record<string, AgentAvatarValue | undefined>;
  sessionNames: Record<string, string>;
  lastSeenTurns: Record<string, number>;
  onSelect: (s: SessionSummary) => void;
  onClose: (id: string) => void;
  busy: boolean;
  agentId: string;
  onSelectAgent: (id: string) => void;
  onNewChat: () => void;
}) {
  // listSessions returns newest-first; reversed here so a freshly created session lands as a new
  // tab on the right (next to "+"), the same left-to-right growth every tabbed browser uses,
  // instead of popping to the front and shoving every other tab sideways.
  const ordered = [...sessions].reverse();

  // Whenever the active session changes -- whether from clicking a tab directly, picking an
  // agent (which may land on a brand-new tab all the way at the end of the strip), a tray-menu
  // click, or the command palette -- its tab scrolls into view if it's off-screen and takes
  // keyboard focus, the same way a newly-opened browser tab does.
  const activeTabRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
    activeTabRef.current?.focus();
  }, [sessionId]);

  return (
    <div aria-label="session tabs" className="flex shrink-0 items-center gap-1 border-b bg-muted/40 pr-2">
      <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto p-1.5">
        {ordered.map((s) => {
          const displayName = sessionNames[s.id] ?? s.id;
          const color = sessionStatusColor(s, lastSeenTurns);
          const agentName = agents.find((a) => a.id === s.agentId)?.name ?? s.agentId;
          const active = s.id === sessionId;
          return (
            <div
              key={s.id}
              className={`group/tab flex shrink-0 items-center gap-1.5 rounded-t-md border px-2 py-1.5 text-sm transition-colors ${
                // Active reads as "lifted, connected to the content below": a bright bottom
                // accent border (the classic tab-underline convention), a background that's
                // *lighter* than the strip around it, and full-strength text -- the previous
                // version used bg-background for the active tab, which in dark mode is actually
                // darker than the strip's own bg-muted wash, so the "selected" tab visually
                // receded instead of popping forward. Inactive tabs get a real (if subdued)
                // border on every side instead of an invisible one, so they read as distinct
                // connected squares rather than bare floating text.
                active
                  ? "border-border border-b-2 border-b-primary bg-accent font-semibold text-foreground"
                  : "border-border bg-transparent text-muted-foreground hover:border-foreground/20 hover:bg-accent/40 hover:text-foreground"
              }`}
            >
              <button
                ref={active ? activeTabRef : undefined}
                type="button"
                onClick={() => onSelect(s)}
                title={`${displayName} — ${s.state}`}
                className="flex min-w-0 max-w-40 items-center gap-1.5"
              >
                <AgentAvatar
                  agentId={s.agentId}
                  name={agentName}
                  avatar={avatars[s.agentId]}
                  sizeClassName="size-4"
                />
                <span
                  title={s.state}
                  className={`size-1.5 shrink-0 rounded-full ${STATUS_DOT_CLASS[color]}`}
                />
                <span className="truncate">{displayName}</span>
              </button>
              <button
                type="button"
                title="Close"
                onClick={() => onClose(s.id)}
                className="shrink-0 rounded-sm p-0.5 text-muted-foreground opacity-0 hover:bg-accent hover:text-foreground group-hover/tab:opacity-100"
              >
                <XIcon className="size-3" />
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <NewSessionControls
          agents={agents}
          agentId={agentId}
          onSelectAgent={onSelectAgent}
          avatars={avatars}
          busy={busy}
          onNewChat={onNewChat}
        />
      </div>
    </div>
  );
}

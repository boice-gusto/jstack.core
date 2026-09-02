import type { SessionSummary } from "./agent";

export type SessionStatusColor = "green" | "yellow" | "red" | "white";

export const LAST_SEEN_TURNS_KEY = "jstack.lastSeenTurns";

export function loadLastSeenTurns(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LAST_SEEN_TURNS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * An attention status, not a process status: red/yellow reflect the session's derived state
 * (crew store's `deriveTaskDisplayStatus`/`finishTask` reasons -- "running", "idle", "done",
 * "failed", "cancelled" today; "yellow" anticipates a future "waiting on you" state the daemon
 * doesn't emit yet), but green means "this session's turn count has moved since you last looked
 * at it" -- not "currently running". A session can finish running and go green (new reply you
 * haven't seen) or finish and go straight to white (you were already watching it happen).
 *
 * Two things this deliberately gets right:
 * - A brand-new, empty session (turns: 0) never shows green -- `0 > 0` is false, so there has to
 *   be an actual reply before anything lights up. An untouched chat isn't "unseen new activity."
 * - "Seen" is remembered durably (turn count per session id, in localStorage via
 *   `loadLastSeenTurns`/`LAST_SEEN_TURNS_KEY`), not just for the current window session -- once
 *   you've looked at a reply, it stays white after an app restart. Turn count rather than a
 *   timestamp on purpose: no clock-skew/timezone edge cases, and "has a new turn arrived since
 *   the last one I saw" is exactly the question this needs answered.
 */
export function sessionStatusColor(
  s: SessionSummary,
  lastSeenTurns: Record<string, number>,
): SessionStatusColor {
  const state = s.state.toLowerCase();
  if (state.includes("error") || state.includes("fail")) return "red";
  if (state.includes("wait") || state.includes("permission") || state.includes("question")) {
    return "yellow";
  }
  if (s.turns > (lastSeenTurns[s.id] ?? 0)) return "green";
  return "white";
}

export const STATUS_RING_CLASS: Record<SessionStatusColor, string> = {
  green: "ring-green-500",
  yellow: "ring-yellow-500",
  red: "ring-red-500",
  white: "ring-gray-300",
};

export const STATUS_DOT_CLASS: Record<SessionStatusColor, string> = {
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  red: "bg-red-500",
  white: "bg-gray-300",
};

import type { SessionMode, ThinkingLevel } from "./agent";

/**
 * The composer's per-message mode/thinking-level pickers, persisted across restarts like the
 * other small UI prefs in this directory (navigationLayout.ts, theme.ts) -- global, not
 * per-agent/per-session, since these are "how do you want THIS turn handled" choices a user
 * flips occasionally, not a per-conversation setting worth tracking separately for every tab.
 */
const SESSION_MODE_KEY = "jstack.sessionMode";
const THINKING_LEVEL_KEY = "jstack.thinkingLevel";

export function loadSessionMode(): SessionMode {
  return localStorage.getItem(SESSION_MODE_KEY) === "ask" ? "ask" : "full-access";
}

export function storeSessionMode(mode: SessionMode): void {
  localStorage.setItem(SESSION_MODE_KEY, mode);
}

const THINKING_LEVELS: readonly ThinkingLevel[] = [
  "none",
  "think",
  "think-hard",
  "think-harder",
  "ultrathink",
];

export function loadThinkingLevel(): ThinkingLevel {
  const stored = localStorage.getItem(THINKING_LEVEL_KEY);
  return (THINKING_LEVELS as readonly string[]).includes(stored ?? "")
    ? (stored as ThinkingLevel)
    : "none";
}

export function storeThinkingLevel(level: ThinkingLevel): void {
  localStorage.setItem(THINKING_LEVEL_KEY, level);
}

export const THINKING_LEVEL_LABEL: Record<ThinkingLevel, string> = {
  none: "No extra thinking",
  think: "Think",
  "think-hard": "Think hard",
  "think-harder": "Think harder",
  ultrathink: "Ultrathink",
};

export const SESSION_MODE_LABEL: Record<SessionMode, string> = {
  ask: "Ask before acting",
  "full-access": "Full access",
};

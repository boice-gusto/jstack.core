/**
 * Per-agent avatars: a curated set of cute animal emoji (offline, no external asset fetches) or
 * a custom uploaded image, either way rendered in a colored circle. This is a v1, frontend-only,
 * localStorage-keyed-by-agent-id concern -- NOT yet a `jstack.config.json` field (see
 * agent-config.ts's `emoji`, which is a different, security-relevant Slack-identity field this
 * must never be confused with or write over). If avatars need to sync across machines later,
 * that's a real schema change (`cli/src/types/config.ts` + `bun run schema:generate`), not a
 * refactor of this file's shape.
 */

export const AVATAR_EMOJIS = [
  "🐶", "🐱", "🐻", "🐼", "🦊", "🐨", "🐰", "🐯",
  "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧", "🦉",
  "🐺", "🐭", "🐹", "🦝", "🐢", "🦋", "🐙", "🦄",
] as const;

export interface AgentAvatar {
  /** "emoji" for a curated pick, "image" for an uploaded data URL. */
  kind: "emoji" | "image";
  value: string;
}

const AVATAR_KEY = "jstack.agentAvatars";

/** Read fresh from storage, not cached -- callers that need this to stay current across changes
 * (App.tsx) mirror it into real React state instead, same pattern as `loadGroupOpenMap`. */
export function loadAllAgentAvatars(): Record<string, AgentAvatar> {
  try {
    const raw = localStorage.getItem(AVATAR_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function setAgentAvatar(agentId: string, avatar: AgentAvatar): void {
  const all = loadAllAgentAvatars();
  all[agentId] = avatar;
  localStorage.setItem(AVATAR_KEY, JSON.stringify(all));
}

export function clearAgentAvatar(agentId: string): void {
  const all = loadAllAgentAvatars();
  delete all[agentId];
  localStorage.setItem(AVATAR_KEY, JSON.stringify(all));
}

/** Every new agent gets an emoji avatar up front -- never blank -- so the letter-and-circle
 * fallback (`fallbackHue` below) stays reserved for agents that existed before this feature did,
 * not the normal path for a freshly created one. Picks one no other agent is currently using so
 * two agents don't visually collide at a glance; once every curated emoji is taken, further
 * agents just get a uniformly random one (a small curated set was never going to stay unique
 * forever, and a repeat is a lot less confusing than a fallback letter reappearing). */
export function pickRandomUnusedEmoji(): string {
  const used = new Set(
    Object.values(loadAllAgentAvatars())
      .filter((a) => a.kind === "emoji")
      .map((a) => a.value),
  );
  const unused = AVATAR_EMOJIS.filter((e) => !used.has(e));
  const pool = unused.length > 0 ? unused : AVATAR_EMOJIS;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

/** Deterministic fallback color for an agent with no avatar set yet, so the plain-letter circle
 * that used to be the only option (still the fallback here) at least varies by agent instead of
 * every one being the same flat `bg-muted` gray. Hash, not random, so the same agent always gets
 * the same color across reloads without needing to persist it. */
const FALLBACK_HUES = [220, 260, 300, 340, 20, 60, 150, 190] as const;

export function fallbackHue(agentId: string): number {
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    hash = (hash * 31 + agentId.charCodeAt(i)) | 0;
  }
  return FALLBACK_HUES[Math.abs(hash) % FALLBACK_HUES.length]!;
}

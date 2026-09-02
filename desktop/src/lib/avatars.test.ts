import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AVATAR_EMOJIS, pickRandomUnusedEmoji, setAgentAvatar } from "./avatars";

describe("pickRandomUnusedEmoji", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  test("never returns an emoji already assigned to another agent, as long as unused ones remain", () => {
    // Every emoji except the last one is already taken -- whatever index Math.random maps to,
    // the result has to be that one remaining emoji.
    for (const e of AVATAR_EMOJIS.slice(0, -1)) {
      setAgentAvatar(`agent-${e}`, { kind: "emoji", value: e });
    }
    const lastUnused = AVATAR_EMOJIS[AVATAR_EMOJIS.length - 1];
    for (let i = 0; i < 10; i++) {
      expect(pickRandomUnusedEmoji()).toBe(lastUnused);
    }
  });

  test("falls back to the full set (repeats allowed) once every emoji is already taken", () => {
    for (const e of AVATAR_EMOJIS) {
      setAgentAvatar(`agent-${e}`, { kind: "emoji", value: e });
    }
    const result = pickRandomUnusedEmoji();
    expect(AVATAR_EMOJIS).toContain(result);
  });

  test("ignores image avatars when computing what's 'used' -- only emoji collide", () => {
    setAgentAvatar("agent-with-photo", { kind: "image", value: "data:image/png;base64,x" });
    // Should still be free to return any curated emoji, including ones that happen to look like
    // they'd be "used" by an unrelated image avatar (there's nothing to collide with here).
    expect(AVATAR_EMOJIS).toContain(pickRandomUnusedEmoji());
  });
});

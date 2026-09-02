import { beforeEach, describe, expect, test } from "vitest";
import {
  loadSessionMode,
  loadThinkingLevel,
  SESSION_MODE_LABEL,
  storeSessionMode,
  storeThinkingLevel,
  THINKING_LEVEL_LABEL,
} from "./promptControls";

describe("promptControls", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("defaults to full-access / none when nothing has been stored", () => {
    expect(loadSessionMode()).toBe("full-access");
    expect(loadThinkingLevel()).toBe("none");
  });

  test("round-trips a stored session mode", () => {
    storeSessionMode("ask");
    expect(loadSessionMode()).toBe("ask");
  });

  test("round-trips a stored thinking level", () => {
    storeThinkingLevel("think-harder");
    expect(loadThinkingLevel()).toBe("think-harder");
  });

  test("an unrecognized stored thinking level falls back to 'none' rather than passing through garbage", () => {
    localStorage.setItem("jstack.thinkingLevel", "maximum-overdrive");
    expect(loadThinkingLevel()).toBe("none");
  });

  test("every SessionMode/ThinkingLevel value has a label", () => {
    expect(Object.keys(SESSION_MODE_LABEL).sort()).toEqual(["ask", "full-access"]);
    expect(Object.keys(THINKING_LEVEL_LABEL).sort()).toEqual(
      ["none", "think", "think-hard", "think-harder", "ultrathink"].sort(),
    );
  });
});

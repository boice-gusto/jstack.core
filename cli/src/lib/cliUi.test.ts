import { describe, expect, it } from "bun:test";
import { nonInteractiveHint } from "./cliUi.js";

describe("cliUi", () => {
  describe("nonInteractiveHint", () => {
    it("mentions json flag by default", () => {
      expect(nonInteractiveHint()).toContain("--json");
    });
  });
});

import { expect, test } from "bun:test";
import { categorize, jaccardSimilarity } from "./compare-lib.js";

test("categorize: single model passed -> right", () => {
  expect(
    categorize({
      claude: { id: "x", surface: "cli", model: "claude", status: "passed" },
    }),
  ).toBe("right");
});

test("categorize: single model failed -> wrong", () => {
  expect(
    categorize({
      claude: { id: "x", surface: "cli", model: "claude", status: "failed" },
    }),
  ).toBe("wrong");
});

test("categorize: single model skipped -> needs_review", () => {
  expect(
    categorize({
      claude: { id: "x", surface: "cli", model: "claude", status: "skipped" },
    }),
  ).toBe("needs_review");
});

test("categorize: two models both passed -> accepted", () => {
  expect(
    categorize({
      claude: { id: "x", surface: "agents", model: "claude", status: "passed" },
      codex: { id: "x", surface: "agents", model: "codex", status: "passed" },
    }),
  ).toBe("accepted");
});

test("categorize: two models both failed -> wrong", () => {
  expect(
    categorize({
      claude: { id: "x", surface: "agents", model: "claude", status: "failed" },
      codex: { id: "x", surface: "agents", model: "codex", status: "failed" },
    }),
  ).toBe("wrong");
});

test("categorize: models disagree -> difference_detected", () => {
  expect(
    categorize({
      claude: { id: "x", surface: "agents", model: "claude", status: "passed" },
      codex: { id: "x", surface: "agents", model: "codex", status: "failed" },
    }),
  ).toBe("difference_detected");
});

test("categorize: any skip among multiple models -> needs_review, even if the rest agree", () => {
  expect(
    categorize({
      claude: { id: "x", surface: "agents", model: "claude", status: "passed" },
      codex: { id: "x", surface: "agents", model: "codex", status: "skipped" },
    }),
  ).toBe("needs_review");
});

test("jaccardSimilarity: identical text is 1", () => {
  expect(jaccardSimilarity("the quick brown fox", "the quick brown fox")).toBe(
    1,
  );
});

test("jaccardSimilarity: completely disjoint text is 0", () => {
  expect(jaccardSimilarity("apple banana cherry", "dog elephant giraffe")).toBe(
    0,
  );
});

test("jaccardSimilarity: both empty is 1 (nothing to disagree about)", () => {
  expect(jaccardSimilarity("", "")).toBe(1);
});

test("jaccardSimilarity: one empty, one not, is 0", () => {
  expect(jaccardSimilarity("", "something here")).toBe(0);
});

test("jaccardSimilarity: partial overlap is between 0 and 1", () => {
  const s = jaccardSimilarity(
    "the quick brown fox jumps",
    "the slow brown fox sleeps",
  );
  expect(s).toBeGreaterThan(0);
  expect(s).toBeLessThan(1);
});

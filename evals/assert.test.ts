import { describe, expect, test } from "bun:test";
import { runResponseAsserts } from "./assert.js";

describe("runResponseAsserts", () => {
  test("response_match_regex passes when pattern matches", () => {
    const rows = runResponseAsserts("Hello ## Links\n", {
      response_match_regex: ["Links"],
    });
    expect(rows.length).toBe(1);
    expect(rows[0]?.passed).toBe(true);
  });

  test("response_match_regex fails when pattern missing", () => {
    const rows = runResponseAsserts("no footer here", {
      response_match_regex: ["## Links"],
    });
    expect(rows.some((r) => !r.passed)).toBe(true);
  });

  test("invalid regex yields failed assert row", () => {
    const rows = runResponseAsserts("x", {
      response_match_regex: ["("],
    });
    expect(rows.some((r) => r.evidence.includes("Invalid regular"))).toBe(true);
  });
});

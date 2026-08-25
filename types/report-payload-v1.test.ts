import { describe, expect, test } from "bun:test";
import {
  ReportLinkSchema,
  safeParseReportPayload,
} from "./report-payload-v1.js";

/**
 * ReportLinkSchema.url used to be optional, letting a label-only/empty link pass validation
 * even though report-viewer.tsx (the one real consumer) already fell back to "#" for a missing
 * url -- the schema was laxer than the code that reads it. Verified during that fix via a
 * direct before/after safeParse comparison, but never captured as a regression test.
 */
describe("ReportLinkSchema", () => {
  test("rejects a link with no url", () => {
    const result = ReportLinkSchema.safeParse({ label: "Sprint board" });
    expect(result.success).toBe(false);
  });

  test("rejects a link with an empty url", () => {
    const result = ReportLinkSchema.safeParse({
      label: "Sprint board",
      url: "",
    });
    expect(result.success).toBe(false);
  });

  test("accepts a link with a non-empty url", () => {
    const result = ReportLinkSchema.safeParse({
      label: "Sprint board",
      url: "https://example.com/board",
    });
    expect(result.success).toBe(true);
  });
});

describe("safeParseReportPayload — links", () => {
  test("rejects a full payload whose links array has a url-less entry", () => {
    const result = safeParseReportPayload({
      schema_version: 1,
      meta: { title: "t", generated_at: "2026-01-01T00:00:00.000Z" },
      links: [{ label: "Missing url" }],
    });
    expect(result.success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import {
  parseStructuredJsonText,
  validateStructuredEnvelope,
} from "@/lib/structured-json";

describe("parseStructuredJsonText", () => {
  it("rejects empty", () => {
    const r = parseStructuredJsonText("   ");
    expect(r.ok).toBe(false);
  });

  it("parses valid JSON object", () => {
    const r = parseStructuredJsonText('{"type":"x","version":"1"}');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual({ type: "x", version: "1" });
    }
  });

  it("fails on invalid JSON", () => {
    const r = parseStructuredJsonText("{");
    expect(r.ok).toBe(false);
  });
});

describe("validateStructuredEnvelope", () => {
  it("accepts type and version", () => {
    const r = validateStructuredEnvelope({ type: "report", version: "1", extra: true });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.type).toBe("report");
      expect(r.data.extra).toBe(true);
    }
  });

  it("rejects missing fields", () => {
    const r = validateStructuredEnvelope({ type: "only" });
    expect(r.ok).toBe(false);
  });
});

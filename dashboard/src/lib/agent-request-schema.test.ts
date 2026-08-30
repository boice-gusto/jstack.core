import { describe, expect, it } from "vitest";

import { AgentStreamBodySchema } from "@/lib/agent-request-schema";

describe("AgentStreamBodySchema", () => {
  it("accepts minimal valid body", () => {
    const r = AgentStreamBodySchema.safeParse({
      messages: [{ role: "user", content: "hi" }],
    });
    expect(r.success).toBe(true);
  });

  it("rejects empty messages", () => {
    const r = AgentStreamBodySchema.safeParse({ messages: [] });
    expect(r.success).toBe(false);
  });

  it("accepts optional fields", () => {
    const r = AgentStreamBodySchema.safeParse({
      messages: [
        { role: "user", content: "a" },
        { role: "assistant", content: "b" },
      ],
      skillId: "research",
      systemAddendum: "extra",
      expectStructuredJson: true,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.skillId).toBe("research");
      expect(r.data.expectStructuredJson).toBe(true);
    }
  });

  it("defaults backend to undefined (route.ts treats that as claude)", () => {
    const r = AgentStreamBodySchema.safeParse({ messages: [{ role: "user", content: "hi" }] });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.backend).toBeUndefined();
    }
  });

  it("accepts backend: codex", () => {
    const r = AgentStreamBodySchema.safeParse({
      messages: [{ role: "user", content: "hi" }],
      backend: "codex",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.backend).toBe("codex");
    }
  });

  it("rejects an unknown backend value", () => {
    const r = AgentStreamBodySchema.safeParse({
      messages: [{ role: "user", content: "hi" }],
      backend: "gpt5",
    });
    expect(r.success).toBe(false);
  });
});

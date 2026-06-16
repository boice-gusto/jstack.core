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
});

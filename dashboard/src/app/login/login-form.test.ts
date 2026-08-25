import { describe, expect, it } from "vitest";

import { safeRedirectTarget } from "./login-form";

describe("safeRedirectTarget", () => {
  it("allows a normal same-origin path", () => {
    expect(safeRedirectTarget("/dashboard")).toBe("/dashboard");
    expect(safeRedirectTarget("/skills?tab=all")).toBe("/skills?tab=all");
  });

  it("falls back to / for a protocol-relative URL (open redirect)", () => {
    expect(safeRedirectTarget("//evil.com")).toBe("/");
    expect(safeRedirectTarget("//evil.com/phish")).toBe("/");
  });

  it("falls back to / for a backslash-prefixed URL some browsers normalize to //", () => {
    expect(safeRedirectTarget("/\\evil.com")).toBe("/");
  });

  it("falls back to / for an absolute URL or protocol-qualified value", () => {
    expect(safeRedirectTarget("https://evil.com")).toBe("/");
    expect(safeRedirectTarget("javascript:alert(1)")).toBe("/");
  });

  it("falls back to / for an empty string", () => {
    expect(safeRedirectTarget("")).toBe("/");
  });
});

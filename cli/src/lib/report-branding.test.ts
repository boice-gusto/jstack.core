import { describe, expect, test } from "bun:test";
import { mergeReportBranding } from "./report-branding.js";

/**
 * report-branding.ts used to hand-declare its own ReportBrandingSchema, independently drifted
 * from types/config.ts's `reports.branding`: a closed 13-key `colors` object (vs. an open
 * hex-validated record) and a `density` enum missing "spacious". A config valid by the
 * documented contract (config.ts) crashed here at render time, and a custom color key was
 * silently dropped instead of rendered. Both schemas are now the same schema.
 */
describe("mergeReportBranding", () => {
  test("accepts density: 'spacious' without crashing (previously threw a ZodError)", () => {
    expect(() =>
      mergeReportBranding({}, { density: "spacious" }),
    ).not.toThrow();
  });

  test("emits density as a CSS custom property instead of leaving it inert", () => {
    const { css, branding } = mergeReportBranding({}, { density: "compact" });
    expect(branding.density).toBe("compact");
    expect(css).toContain("--report-density: compact;");
  });

  test("renders a custom (non-fixed-key) color instead of silently dropping it", () => {
    const { css, branding } = mergeReportBranding(
      {},
      { colors: { accentAlt: "#123456" } },
    );
    expect(branding.colors?.accentAlt).toBe("#123456");
    expect(css).toContain("--color-accent-alt: #123456;");
  });

  test("override colors merge over (not replace) default colors", () => {
    const { branding } = mergeReportBranding(
      { colors: { main: "#111111", primary: "#222222" } },
      { colors: { primary: "#333333" } },
    );
    expect(branding.colors?.main).toBe("#111111");
    expect(branding.colors?.primary).toBe("#333333");
  });

  test("radiusMd and fontSans still render as before", () => {
    const { css } = mergeReportBranding(
      {},
      { radiusMd: "8px", fontSans: "Inter, sans-serif" },
    );
    expect(css).toContain("--radius-md: 8px;");
    expect(css).toContain("--font-sans: Inter, sans-serif;");
  });
});

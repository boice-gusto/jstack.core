import { z } from "zod";
import { ReportBrandingConfigSchema } from "../types/config.js";

/** Re-exported for callers that used to import this name -- the schema itself now lives in
 * types/config.ts, the single source of truth `reports.branding` is validated against
 * everywhere else too, so this file can no longer independently drift from it. */
export const ReportBrandingSchema = ReportBrandingConfigSchema;

export type ReportBranding = z.infer<typeof ReportBrandingSchema>;

const ReportsBrandingSliceSchema = z
  .object({
    reports: z.object({ branding: z.unknown().optional() }).optional(),
  })
  .strip();

/** Extract `reports.branding` from a config or defaults object without `as` casts. */
export function extractReportsBranding(raw: unknown): unknown {
  const r = ReportsBrandingSliceSchema.safeParse(raw);
  if (!r.success) return undefined;
  return r.data.reports?.branding;
}

/** Merge defaults + optional override from jstack.config.json `reports.branding`. */
export function mergeReportBranding(
  defaults: unknown,
  override: unknown,
): { css: string; branding: ReportBranding } {
  const base = ReportBrandingSchema.parse(defaults ?? {});
  const over = ReportBrandingSchema.parse(override ?? {});
  const colors = { ...base.colors, ...over.colors };
  const branding: ReportBranding = {
    ...base,
    ...over,
    colors,
  };
  const lines: string[] = [":root {"];
  if (branding.colors) {
    for (const [k, v] of Object.entries(branding.colors)) {
      if (!v) continue;
      const varName = k.replace(/([A-Z])/g, "-$1").toLowerCase();
      lines.push(`  --color-${varName}: ${v};`);
    }
  }
  if (branding.radiusMd) lines.push(`  --radius-md: ${branding.radiusMd};`);
  if (branding.fontSans) lines.push(`  --font-sans: ${branding.fontSans};`);
  // Previously validated but never emitted anywhere -- a config author setting it saw no
  // effect. Emit it as a CSS custom property (matching radiusMd/fontSans) so a template can
  // opt into reading it instead of the value being silently inert.
  if (branding.density) lines.push(`  --report-density: ${branding.density};`);
  lines.push("}");
  return { css: lines.join("\n"), branding };
}

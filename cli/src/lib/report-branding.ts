import { z } from "zod";

const ColorSchema = z.string().min(1);

export const ReportBrandingSchema = z.object({
  colors: z
    .object({
      main: ColorSchema.optional(),
      primary: ColorSchema.optional(),
      secondary: ColorSchema.optional(),
      background: ColorSchema.optional(),
      surface: ColorSchema.optional(),
      text: ColorSchema.optional(),
      textMuted: ColorSchema.optional(),
      border: ColorSchema.optional(),
      buttonPrimaryBg: ColorSchema.optional(),
      buttonPrimaryText: ColorSchema.optional(),
      buttonSecondaryBg: ColorSchema.optional(),
      buttonSecondaryText: ColorSchema.optional(),
      link: ColorSchema.optional(),
    })
    .optional(),
  radiusMd: z.string().optional(),
  fontSans: z.string().optional(),
  density: z.enum(["compact", "comfortable"]).optional(),
});

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
  lines.push("}");
  return { css: lines.join("\n"), branding };
}

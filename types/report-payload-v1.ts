import { z } from "zod";

/**
 * Discriminates layout hints in the dashboard. Optional — CLI static shell ignores it.
 * Align with `templates/reports/*.md` filenames.
 */
export const REPORT_KINDS = [
  "team-weekly",
  "engineer-weekly",
  "manager-rollup",
  "project-status",
  "sprint-summary",
  "incident-retro",
  "eval-report",
  "self-report",
  "generic",
] as const;

export type ReportKind = (typeof REPORT_KINDS)[number];

export const ReportMetaSchema = z
  .object({
    title: z.string(),
    generated_at: z.string(),
    team: z.string().optional(),
    report_kind: z.enum(REPORT_KINDS).optional(),
    subtitle: z.string().optional(),
    /** Optional footer line; when omitted, the report shell picks copy from `report_kind`. */
    footer_note: z.string().optional(),
  })
  .passthrough();

/** Chart.js–backed block: `bar`, `line`, or `doughnut` (dashboard + static shell). */
export const CHART_TYPES = ["bar", "line", "doughnut"] as const;
export type ReportChartType = (typeof CHART_TYPES)[number];

export const ReportChartDatasetSchema = z.object({
  label: z.string(),
  data: z.array(z.number()),
  backgroundColor: z.union([z.string(), z.array(z.string())]).optional(),
  borderColor: z.union([z.string(), z.array(z.string())]).optional(),
  fill: z.boolean().optional(),
});

export const ReportChartSchema = z.object({
  type: z.enum(CHART_TYPES),
  /** Shown as Chart.js title plugin (optional if the section `title` is enough). */
  title: z.string().optional(),
  labels: z.array(z.string()).min(1),
  datasets: z.array(ReportChartDatasetSchema).min(1),
  options: z
    .object({
      stacked: z.boolean().optional(),
      y_axis_begin_at_zero: z.boolean().optional(),
    })
    .optional(),
});

const ReportSectionCommonSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
});

const nonEmptyBodyMarkdown = z
  .string()
  .refine((v) => v.trim().length > 0, { message: "must be non-empty" });

/**
 * A section needs a chart and/or non-empty body_markdown -- expressed as a union of the two
 * valid shapes (rather than an unconstrained object plus a `.refine`) so the exported
 * `ReportSection` TYPE also forbids "neither," not just the runtime parse. A plain object +
 * refine validates the same inputs correctly but its `z.infer`'d type still allows `{}`, which
 * forced a defensive third UI branch in the dashboard's report-viewer purely to handle a state
 * the schema itself already rejects.
 */
export const ReportSectionSchema = z.union(
  [
    ReportSectionCommonSchema.extend({
      chart: ReportChartSchema,
      body_markdown: z.string().optional(),
    }).passthrough(),
    ReportSectionCommonSchema.extend({
      chart: ReportChartSchema.optional(),
      body_markdown: nonEmptyBodyMarkdown,
    }).passthrough(),
  ],
  {
    errorMap: () => ({
      message: "Section must include chart and/or non-empty body_markdown",
    }),
  },
);

export const ReportLinkSchema = z
  .object({
    label: z.string().optional(),
    url: z.string().optional(),
  })
  .passthrough();

/**
 * JSON shape for `jstack report render` and dashboard preview.
 * JSON Schema: `schemas/reports/report-payload-v1.schema.json`
 */
export const ReportPayloadSchema = z
  .object({
    schema_version: z.literal(1),
    meta: ReportMetaSchema,
    sections: z.array(ReportSectionSchema).optional(),
    links: z.array(ReportLinkSchema).optional(),
  })
  .passthrough();

export type ReportMeta = z.infer<typeof ReportMetaSchema>;
export type ReportChartDataset = z.infer<typeof ReportChartDatasetSchema>;
export type ReportChart = z.infer<typeof ReportChartSchema>;
export type ReportSection = z.infer<typeof ReportSectionSchema>;
export type ReportLink = z.infer<typeof ReportLinkSchema>;
export type ReportPayload = z.infer<typeof ReportPayloadSchema>;

export function parseReportPayload(data: unknown): ReportPayload {
  return ReportPayloadSchema.parse(data);
}

export function safeParseReportPayload(
  data: unknown,
):
  | { success: true; data: ReportPayload }
  | { success: false; error: z.ZodError<ReportPayload> } {
  const r = ReportPayloadSchema.safeParse(data);
  if (r.success) {
    return { success: true, data: r.data };
  }
  return { success: false, error: r.error };
}

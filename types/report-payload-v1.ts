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

export const ReportSectionSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().optional(),
    body_markdown: z.string().optional(),
    chart: ReportChartSchema.optional(),
  })
  .passthrough()
  .refine(
    (s) =>
      s.chart != null ||
      (typeof s.body_markdown === "string" && s.body_markdown.trim().length > 0),
    { message: "Section must include chart and/or non-empty body_markdown" },
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

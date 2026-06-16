import { z } from "zod";

export const NotionSurfaceSchema = z.enum([
  "team_hub",
  "private_vault",
  "one_on_ones",
  "standalone",
]);
export type NotionSurface = z.infer<typeof NotionSurfaceSchema>;

export const NotionTemplateKindSchema = z.enum([
  "page_dashboard",
  "page_hub",
  "page_template",
  "database",
]);
export type NotionTemplateKind = z.infer<typeof NotionTemplateKindSchema>;

export const NotionColorSchema = z.enum([
  "default",
  "gray",
  "brown",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "red",
]);
export type NotionColor = z.infer<typeof NotionColorSchema>;

const BaseTemplate = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/, "snake_case ascii"),
  title: z.string().min(1),
  surface: NotionSurfaceSchema,
  config_key: z.string().min(1),
  marketplace_url: z.string().url().optional(),
  note: z.string().optional(),
  icon: z
    .string()
    .min(1)
    .describe(
      "REQUIRED at render time: emoji ('🏢'), custom emoji name (':rocket_ship:'), or external image URL. " +
        "Pages without icons feel unfinished — every catalog entry MUST set one.",
    ),
  cover: z
    .string()
    .url()
    .describe(
      "REQUIRED at render time: external image URL for the page cover. " +
        "Conventionally a Notion built-in gradient (https://www.notion.so/images/page-cover/gradients_<n>.png) " +
        "matching the surface's color theme. Drives the 'solid color top header' feel.",
    ),
  header_color: NotionColorSchema.describe(
    "Color theme for the page's first heading + intro callout. Matches the cover's hue. " +
      "See skills/notion/references/notion-components.md for the canonical theme map.",
  ),
});

export const NotionContentKindSchema = z
  .enum(["static", "prompt"])
  .default("static")
  .describe(
    "static = the .md file is the page body verbatim (after placeholder substitution). " +
      "prompt = the .md file is a prompt the agent reads to generate the page body at setup time " +
      "(typically authored as <id>.prompt.md).",
  );
export type NotionContentKind = z.infer<typeof NotionContentKindSchema>;

export const NotionPageTemplateSchema = BaseTemplate.extend({
  kind: z.enum(["page_dashboard", "page_hub", "page_template"]),
  content_kind: NotionContentKindSchema.optional(),
  content_path: z
    .string()
    .min(1)
    .describe(
      "Relative to the catalog set's directory. " +
        "Conventions: '<set>/<id>.md' for static content, '<set>/<id>.prompt.md' for prompt-driven content.",
    ),
});
export type NotionPageTemplate = z.infer<typeof NotionPageTemplateSchema>;

export const NotionDatabaseTemplateSchema = BaseTemplate.extend({
  kind: z.literal("database"),
  description: z.string(),
  schema: z.string().describe("SQL DDL: CREATE TABLE (...)"),
  data_source_config_key: z
    .string()
    .optional()
    .describe("Optional separate config_key for the data_source id (collection)"),
});
export type NotionDatabaseTemplate = z.infer<typeof NotionDatabaseTemplateSchema>;

export const NotionTemplateSchema = z.discriminatedUnion("kind", [
  NotionPageTemplateSchema.extend({ kind: z.literal("page_dashboard") }),
  NotionPageTemplateSchema.extend({ kind: z.literal("page_hub") }),
  NotionPageTemplateSchema.extend({ kind: z.literal("page_template") }),
  NotionDatabaseTemplateSchema,
]);
export type NotionTemplate = z.infer<typeof NotionTemplateSchema>;

export const NotionTemplateSetIdSchema = z.string().regex(/^[a-z][a-z0-9_]*$/);
export type NotionTemplateSetId = z.infer<typeof NotionTemplateSetIdSchema>;

export const NotionTemplateSetSchema = z.object({
  id: NotionTemplateSetIdSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  source: z
    .enum(["jstack-builtin", "marketplace-mirror", "custom"])
    .default("custom")
    .describe("Provenance: jstack-built, mirrors a marketplace pack, or user-defined"),
  templates: z.array(NotionTemplateSchema),
});
export type NotionTemplateSet = z.infer<typeof NotionTemplateSetSchema>;

export const NotionTemplateCatalogSchema = z.object({
  active_set: NotionTemplateSetIdSchema,
  sets: z.record(NotionTemplateSetIdSchema, NotionTemplateSetSchema),
});
export type NotionTemplateCatalog = z.infer<typeof NotionTemplateCatalogSchema>;

export function isPageTemplate(t: NotionTemplate): t is NotionPageTemplate {
  return t.kind !== "database";
}

export function isDatabaseTemplate(t: NotionTemplate): t is NotionDatabaseTemplate {
  return t.kind === "database";
}

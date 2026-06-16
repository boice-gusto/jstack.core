import { z } from "zod";
import { McpRegistrySchema } from "./mcp-registry.js";

const loose = z.record(z.unknown());

const NotionVaultSchema = z
  .object({
    root_parent_page_key: z.string().default("private_root"),
    setup_complete: z.boolean().default(false),
  })
  .passthrough();

const NotionTeamSchema = z
  .object({
    root_parent_page_key: z.string().default("team_hub"),
    setup_complete: z.boolean().default(false),
    teamspace_anchor_page_id: z
      .string()
      .default("")
      .describe(
        "Required for team_hub side because Notion API has no teamspace_id parent type. " +
          "User creates one anchor page inside the target teamspace and pastes its id.",
      ),
  })
  .passthrough();

const NotionSurfaceRoutingSchema = z
  .object({
    team_hub: z.string().default("team_notion"),
    private_vault: z.string().default("private_vault"),
    one_on_ones: z.string().default("team_notion"),
  })
  .passthrough();

export const NotionDefaultsSchema = z
  .object({
    template_set: z.string().default("official"),
    template_catalog_path: z.string().default("templates/notion/catalog"),
    surface_routing: NotionSurfaceRoutingSchema.optional(),
    private_vault: NotionVaultSchema.optional(),
    team_notion: NotionTeamSchema.optional(),
    parent_pages: z.record(z.string(), z.string()).optional(),
    database_ids: z.record(z.string(), z.string()).optional(),
    template_pages: z.record(z.string(), z.string()).optional(),
    golden_pages: z
      .record(z.string(), z.string())
      .optional()
      .describe(
        "Per-template golden source page ids. Convention: key = catalog template id (e.g. " +
          "'kanban', 'company_team_page', 'product_wiki'). When non-empty, jstack-notion-setup " +
          "duplicates from that page instead of creating from the catalog's markdown/SQL. " +
          "Useful for visually-rich pages (configured DB views, embedded blocks, gallery layouts) " +
          "that the API can't easily reproduce. Empty fallback = use catalog content_path / schema.",
      ),
    post_targets: z.record(z.string(), z.string()).optional(),
    default_tags: z.array(z.string()).optional(),
    auto_backlink: z.boolean().optional(),
  })
  .passthrough();

export type NotionDefaults = z.infer<typeof NotionDefaultsSchema>;

export const JstackConfigSchema = z
  .object({
    version: z.string().optional(),
    onboarding: loose.optional(),
    team: loose.optional(),
    integrations: loose.optional(),
    mcp_servers: McpRegistrySchema.optional().default({}),
    gbrain: loose.optional(),
    session: loose.optional(),
    jira_rules: loose.optional(),
    notion_defaults: NotionDefaultsSchema.optional(),
    policies: loose.optional(),
    channels: loose.optional(),
    debug: loose.optional(),
    skills: loose.optional(),
    skill_defaults: loose.optional(),
    cross_plugins: loose.optional(),
    routines: loose.optional(),
    workflows: loose.optional(),
    telemetry: loose.optional(),
    evals: loose.optional(),
    knowledge_base: loose.optional(),
    knowledge_storage: loose.optional(),
  })
  .passthrough();

export type JstackConfig = z.infer<typeof JstackConfigSchema>;

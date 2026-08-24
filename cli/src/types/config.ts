/**
 * The enforced contract for `jstack.config.json`.
 *
 * This file is the SINGLE source of truth for config shape. `config/schema.json` is generated from
 * it by `bun run schema:generate` and a drift gate in `bun run check` fails if the two disagree —
 * previously `config/schema.json` was hand-maintained, loaded by no code, and 29 of its 43 sections
 * were empty shells with zero `enum`/`pattern`/`required` constraints anywhere in the file.
 *
 * Two design rules keep this safe to enforce on real user configs:
 *
 * 1. **Every section is `.passthrough()` and every field `.optional()`.** Unknown keys are allowed,
 *    so a newer config never fails against an older CLI. What is validated is the TYPE of keys we
 *    do know — the failure mode that actually bites (a cron string that never fires, a threshold
 *    written as "5" instead of 5) rather than the presence of keys.
 *
 * 2. **No `.default()` on any field.** Defaults come from merging `config/defaults.json`, which is
 *    the established mechanism. Zod defaults would be a second, competing source: `readConfig`
 *    injects them and `writeConfig` persists them, so a user's hand-written 20-line config would
 *    silently balloon into a few hundred lines of restated defaults on the next write. The two
 *    pre-existing exceptions (`notion_defaults` inner fields, `mcp_servers`) are preserved as-is to
 *    avoid changing behavior that setup already depends on.
 */
import { z } from "zod";
import { McpRegistrySchema } from "./mcp-registry.js";

// ── Reusable primitives ───────────────────────────────────────────────────────

/** An object we deliberately do not describe yet. Named so `loose` never looks intentional. */
const undescribed = z.record(z.unknown());

/** A positive integer count. Rejects 0, negatives, and floats. */
const posInt = z.number().int().positive();
/** A count where zero is meaningful (e.g. "no approvals required"). */
const nonNegInt = z.number().int().nonnegative();
/** A ratio used as a threshold. Out-of-range values silently disable or over-trigger a check. */
const ratio = z.number().min(0).max(1);

/**
 * A string that may be empty (unconfigured) but must be a URL when set.
 *
 * Empty-string-as-unset is the convention throughout `defaults.json`, so `z.string().url()` would
 * reject every default. This validates only the configured case.
 */
const urlOrEmpty = z.union([z.literal(""), z.string().url()]);

/** `HH:MM` 24-hour clock. `"9am"` in `business_hours.start` produces silently wrong scheduling. */
const clockTime = z
  .string()
  .regex(
    /^([01]\d|2[0-3]):[0-5]\d$/,
    "must be 24-hour HH:MM, e.g. 09:30 or 17:00",
  );

/**
 * A 5-field cron expression, or `""` for "not scheduled".
 *
 * This is the highest-value constraint in the file: `routines.<id>.cron` drives scheduled work, and
 * a malformed expression does not error — the routine simply never fires, which looks identical to
 * "nothing happened this week". Deliberately permissive about field syntax (ranges, steps, lists,
 * names) while requiring exactly five whitespace-separated fields.
 *
 * Empty is allowed because it is the shipped convention for a routine that exists but has no
 * schedule yet (`routines.sprint_close.cron` is `""` in `defaults.json`, and `scheduler.ts` falls
 * back to `""`). Rejecting it would fail the repo's own default config.
 *
 * Exported so other schemas needing a cron string (e.g. `crew`'s `proactive_checks[].schedule`
 * in `cli/src/lib/crew/types.ts`) reuse this validator instead of inventing a second one that
 * could silently drift from it.
 */
export const cronExpr = z.union([
  z.literal(""),
  z
    .string()
    .regex(
      /^\s*(?:[0-9*,\-/]+|\*)\s+(?:[0-9*,\-/]+|\*)\s+(?:[0-9*,\-/?LW]+|\*)\s+(?:[0-9A-Za-z*,\-/]+|\*)\s+(?:[0-9A-Za-z*,\-/?#L]+|\*)\s*$/,
      "must be a 5-field cron expression (minute hour day-of-month month day-of-week), e.g. '30 9 * * 1-5'",
    ),
]);

/** An IANA timezone name, verified against the runtime's own zone database. */
const timezone = z.string().refine(
  (tz) => {
    if (!tz) return true; // unconfigured
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  },
  { message: "must be a valid IANA timezone, e.g. America/Los_Angeles" },
);

/**
 * A skill slug as it appears in a routine chain.
 *
 * Chains use BARE slugs (`recon`, `team-report`, `research/competitive`) — not the `jstack:<slug>`
 * tokens used in skill-body chain comments. Requiring the prefixed form here rejected all four
 * shipped routines; the two notations are genuinely different and only prose mixes them up.
 * Resolution to a live skill is `bun run validate-chains`, not this schema.
 */
const skillSlug = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*$/, {
    message:
      "must be a bare skill slug like 'recon' or 'research/competitive' (no 'jstack:' prefix)",
  });

/** A CSS hex colour. Report branding renders these straight into HTML. */
const hexColor = z
  .string()
  .regex(
    /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/,
    "must be a hex colour like #1a73e8",
  );

const weekday = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

/** Section helper: every section allows unknown keys so newer configs never break older CLIs. */
const section = <T extends z.ZodRawShape>(shape: T) =>
  z.object(shape).passthrough();

// ── Notion (pre-existing; defaults preserved) ─────────────────────────────────

const NotionVaultSchema = section({
  root_parent_page_key: z.string().default("private_root"),
  setup_complete: z.boolean().default(false),
});

const NotionTeamSchema = section({
  root_parent_page_key: z.string().default("team_hub"),
  setup_complete: z.boolean().default(false),
  teamspace_anchor_page_id: z
    .string()
    .default("")
    .describe(
      "Required for team_hub side because Notion API has no teamspace_id parent type. " +
        "User creates one anchor page inside the target teamspace and pastes its id.",
    ),
});

const NotionSurfaceRoutingSchema = section({
  team_hub: z.string().default("team_notion"),
  private_vault: z.string().default("private_vault"),
  one_on_ones: z.string().default("team_notion"),
});

export const NotionDefaultsSchema = section({
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
});

export type NotionDefaults = z.infer<typeof NotionDefaultsSchema>;

// ── Identity and cadence ──────────────────────────────────────────────────────

const BusinessHoursSchema = section({
  start: clockTime.optional(),
  end: clockTime.optional(),
  days: z.array(weekday).optional(),
});

const CanonicalGroupSchema = section({
  // Values mirror the select options in `cli/src/lib/schema-questions.ts`
  // ("team-canonical-group-mode"); "" is the unset state. Keep the two in sync.
  mode: z
    .enum(["none", "manual_list", "slack_user_group", "google_group", ""])
    .optional(),
  slack_user_group_id: z.string().optional(),
  slack_handle: z.string().optional(),
  google_group_email: z.union([z.literal(""), z.string().email()]).optional(),
  display_name: z.string().optional(),
});

const TeamSchema = section({
  name: z.string().optional(),
  timezone: timezone.optional(),
  business_hours: BusinessHoursSchema.optional(),
  members: z.array(undescribed).optional(),
  canonical_group: CanonicalGroupSchema.optional(),
});

const SprintSchema = section({
  cadence_weeks: posInt.optional(),
  current: z.string().optional(),
  ceremonies: z.array(z.string()).optional(),
  capacity_metric: z.string().optional(),
  velocity_window: posInt.optional(),
});

// ── Integrations ──────────────────────────────────────────────────────────────

const IntegrationsSchema = section({
  jira: section({
    base_url: urlOrEmpty.optional(),
    project_key: z.string().optional(),
    board_id: z.string().optional(),
  }).optional(),
  slack: section({
    public_channel: z.string().optional(),
    private_channel: z.string().optional(),
    webhook_url: urlOrEmpty.optional(),
  }).optional(),
  notion: section({
    workspace_id: z.string().optional(),
    databases: z.record(z.string(), z.string()).optional(),
  }).optional(),
  github: section({
    org: z.string().optional(),
    default_repo: z.string().optional(),
  }).optional(),
  gcal: section({ primary_calendar_id: z.string().optional() }).optional(),
  sheets: section({ default_spreadsheet_id: z.string().optional() }).optional(),
  share_html: section({
    output_dir: z.string().optional(),
    mcp_url: urlOrEmpty.optional(),
    public_base_url: urlOrEmpty.optional(),
    default_slug: z.string().optional(),
    default_owner_key: z.string().optional(),
    access_password: z.string().optional(),
    password_argument_name: z.string().optional(),
    report_shell: z.string().optional(),
    cdn_profile: z.string().optional(),
    branding: undescribed.optional(),
  }).optional(),
  google_drive: section({
    transcripts_folder_id: z.string().optional(),
    note: z.string().optional(),
  }).optional(),
  transcripts: section({
    sources: undescribed.optional(),
    notion_database_id: z.string().optional(),
    zoom_default_folder: z.string().optional(),
  }).optional(),
});

// ── Knowledge ─────────────────────────────────────────────────────────────────

const KnowledgeBaseSchema = section({
  roots: z.array(z.string()).optional(),
  include_globs: z.array(z.string()).optional(),
  exclude_globs: z.array(z.string()).optional(),
  doc_urls: z.array(z.string()).optional(),
  github: section({
    repos: z.array(z.string()).optional(),
    search_issues: z.boolean().optional(),
    prefer_readme: z.boolean().optional(),
  }).optional(),
  retrieval: section({ system_prompt: z.string().optional() }).optional(),
  gbrain: section({
    include: z.boolean().optional(),
    note: z.string().optional(),
  }).optional(),
});

const KnowledgeRemoteSchema = section({
  git_remote: z.string().optional(),
  local_checkout: z.string().optional(),
  note: z.string().optional(),
});

const KnowledgeStorageSchema = section({
  disk_fallback_root: z.string().optional(),
  team: KnowledgeRemoteSchema.optional(),
  personal: KnowledgeRemoteSchema.optional(),
});

const GbrainTargetSchema = section({
  url: urlOrEmpty.optional(),
  trust_policy: z.string().optional(),
});

const GbrainSchema = section({
  team: GbrainTargetSchema.optional(),
  personal: GbrainTargetSchema.optional(),
  provenance: section({
    config_label: z.string().optional(),
    entry_fields: z.array(z.string()).optional(),
    resolve_slack_from_team_members: z.boolean().optional(),
    identity: undescribed.optional(),
  }).optional(),
});

// ── Process rules ─────────────────────────────────────────────────────────────

const JiraRulesSchema = section({
  required_fields: z.array(z.string()).optional(),
  transitions: z.record(z.string(), z.unknown()).optional(),
  naming_conventions: z.record(z.string(), z.unknown()).optional(),
  auto_assign: z.boolean().optional(),
  max_story_points: posInt.optional(),
  labels_required: z.boolean().optional(),
  sprint_required_for_progress: z.boolean().optional(),
  custom_rules: z.array(undescribed).optional(),
});

const PoliciesSchema = section({
  review: section({
    required_approvals: nonNegInt.optional(),
    counsel_roles: z.array(z.string()).optional(),
  }).optional(),
  announcements: section({
    approval_required: z.boolean().optional(),
    channels: z.array(z.string()).optional(),
  }).optional(),
  incidents: section({
    severity_levels: z.array(z.string()).optional(),
    escalation: undescribed.optional(),
  }).optional(),
  sdlc: section({
    stages: z.array(z.string()).optional(),
    gates: undescribed.optional(),
  }).optional(),
});

const ApprovalChainsSchema = section({
  template: z.string().optional(),
  chains: z.record(z.string(), z.array(z.string())).optional(),
});

// ── Automation ────────────────────────────────────────────────────────────────

/**
 * One scheduled routine.
 *
 * `chain` must also resolve to live skills and agree with `config/schedules/<id>.json`; that
 * cross-source check is `bun run validate-chains`, which caught both a silent divergence between
 * the two sources and an id/filename mismatch that left 3 of 4 routines unable to load a schedule.
 */
const RoutineSchema = section({
  enabled: z.boolean().optional(),
  cron: cronExpr.optional(),
  chain: z.array(skillSlug).optional(),
});

const RoutinesSchema = z.record(z.string(), RoutineSchema);

const TelemetrySchema = section({
  enabled: z.boolean().optional(),
  endpoint: urlOrEmpty.optional(),
  satisfaction_enabled: z.boolean().optional(),
  satisfaction_frequency: z.number().int().min(0).max(100).optional(),
  batch_size: posInt.optional(),
  flush_interval_ms: posInt.optional(),
});

const EvalsSchema = section({
  auto_gate: z.boolean().optional(),
  token_budgets: z.record(z.string(), z.number().positive()).optional(),
  latency_thresholds_ms: z.record(z.string(), z.number().positive()).optional(),
  required_fields: z.record(z.string(), z.array(z.string())).optional(),
});

const WorkflowsSchema = section({
  default_output: z.string().optional(),
  artifacts_dir: z.string().optional(),
});

const SessionSchema = section({
  default_gbrain_target: z.enum(["team", "personal", ""]).optional(),
  current_session_id: z.string().optional(),
  auto_end: z.boolean().optional(),
  metrics_on_end: z.boolean().optional(),
  diary_auto_prompt: z.boolean().optional(),
});

const DebugSchema = section({
  enabled: z.boolean().optional(),
  mock_mcp: z.boolean().optional(),
  mock_mcp_scenario: z.string().optional(),
  log_level: z.enum(["error", "warn", "info", "debug", "trace"]).optional(),
  trace_skills: z.array(z.string()).optional(),
  trace_chains: z.boolean().optional(),
});

// ── Reporting and presentation ────────────────────────────────────────────────

/** The single source of truth for `reports.branding` -- also imported directly by
 * `cli/src/lib/report-branding.ts`, which used to hand-declare its own, independently
 * drifted copy (a closed 13-key `colors` object instead of this open hex-validated record,
 * and a `density` enum missing "spacious"). A config value valid by THIS schema must not be
 * able to fail `report-branding.ts`'s own re-parse of the same data. */
export const ReportBrandingConfigSchema = section({
  colors: z.record(z.string(), hexColor).optional(),
  radiusMd: z.string().optional(),
  fontSans: z.string().optional(),
  density: z.enum(["compact", "comfortable", "spacious"]).optional(),
});

const ReportsSchema = section({
  branding: ReportBrandingConfigSchema.optional(),
});

// ── Org and personal context ──────────────────────────────────────────────────

const OrgContextSchema = section({
  notes: z.string().optional(),
  local: section({
    base_path: z.string().optional(),
    files: z.record(z.string(), z.string()).optional(),
  }).optional(),
  notion_pages: z.record(z.string(), z.string()).optional(),
  google_drive_folders: z.record(z.string(), z.string()).optional(),
  people: section({
    notes: z.string().optional(),
    prefer_team_members: z.boolean().optional(),
  }).optional(),
  mcp_labels: section({
    documents: z.array(z.string()).optional(),
    people: z.array(z.string()).optional(),
  }).optional(),
});

const TeamContextSchema = section({
  base_path: z.string().optional(),
  files: z.record(z.string(), z.string()).optional(),
});

const LevelsSchema = section({
  markdown_path: z.string().optional(),
  canonical_url: urlOrEmpty.optional(),
});

const OneOnOneCycleSchema = section({
  transcript_sources: z.array(z.string()).optional(),
  primary_storage: z.string().optional(),
  lattice: section({
    enabled: z.boolean().optional(),
    mcp_server_label: z.string().optional(),
    note: z.string().optional(),
  }).optional(),
  notion: section({
    parent_page_key: z.string().optional(),
    private_pe_parent_key: z.string().optional(),
    default_template_page_key: z.string().optional(),
    note: z.string().optional(),
  }).optional(),
  ai_attribution: section({
    append_to_generated_notes: z.boolean().optional(),
    footer_markdown: z.string().optional(),
  }).optional(),
  prepare_vs_after: section({
    prepare_title_suffix: z.string().optional(),
    after_title_suffix: z.string().optional(),
    link_transcript_paths_in_body: z.boolean().optional(),
  }).optional(),
});

const PeSchema = section({
  configured: z.boolean().optional(),
  teams: z.array(z.string()).optional(),
  projects: z.array(z.string()).optional(),
  jira_project_keys: z.array(z.string()).optional(),
  notion_parent_keys: z.array(z.string()).optional(),
  reporting_window_days: posInt.optional(),
  note: z.string().optional(),
});

// ── Distribution and cross-plugin wiring ──────────────────────────────────────

const GithubRepoRefSchema = section({
  owner: z.string().optional(),
  repo: z.string().optional(),
  default_branch: z.string().optional(),
});

const DistributionSchema = section({
  update_check: z.boolean().optional(),
  version_url: urlOrEmpty.optional(),
  github: z.record(z.string(), GithubRepoRefSchema).optional(),
  plugin_pr: section({
    path_deny_globs: z.array(z.string()).optional(),
  }).optional(),
});

const CrossPluginEntrySchema = section({
  enabled: z.boolean().optional(),
  skills: z.array(z.string()).optional(),
  note: z.string().optional(),
});

// ── Per-skill knobs ───────────────────────────────────────────────────────────

const SkillsSchema = section({
  machine_readable: section({
    enabled: z.boolean().optional(),
    require_schema_ref: z.boolean().optional(),
  }).optional(),
});

const StandupSchema = section({
  jira_comments: z.boolean().optional(),
  side_work_thresholds: z.record(z.string(), z.number()).optional(),
});

const WeeklyDigestSchema = section({
  window_days: posInt.optional(),
  notion_parent_page_id: z.string().optional(),
  dual_audience: z.boolean().optional(),
});

const SiloScanSchema = section({
  confidence_threshold: ratio.optional(),
  comment_marker: z.string().optional(),
  jira_lookback_days: posInt.optional(),
});

const EngineeringHealthSchema = section({
  stale_pr_days: posInt.optional(),
});

const ClaudeMdImproverSchema = section({
  enabled: z.boolean().optional(),
  transcript_lookback_days: posInt.optional(),
  commit_lookback_count: posInt.optional(),
  // A score FLOOR on the improve-claude-md scoring scale, not a 0..1 ratio. Default is 5.0 —
  // see skills/skill-creator/improve-claude-md/references/scoring.md.
  min_priority: z.number().positive().optional(),
  // How many of the FOUR personas (CEO/PM/ENG/QA) must approve an edit; default 3. The upper bound
  // matters: a threshold above 4 can never be satisfied, so every proposed edit is silently
  // rejected and the skill appears to find nothing. Carried over from the previous hand-written
  // config/schema.json, which had this bound and would otherwise have lost it in the move to Zod.
  persona_threshold: z.number().int().min(1).max(4).optional(),
  report_path: z.string().optional(),
  patch_path: z.string().optional(),
  high_correction_session_threshold: posInt.optional(),
});

const BragSchema = section({
  default_mode: z.string().optional(),
  dimensions_file: z.string().optional(),
  level: z.string().optional(),
  google_doc_id: z.string().optional(),
});

const ImpactSchema = section({
  custom_rubric_path: z.string().optional(),
  org_priorities_file: z.string().optional(),
});

const KickoffWorkflowsSchema = section({
  morning: section({ path: z.string().optional() }).optional(),
  state_path: z.string().optional(),
});

const OnboardingSchema = section({
  complete: z.boolean().optional(),
  wizard_last_run: z.string().optional(),
  required_integrations: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

// ── Root ──────────────────────────────────────────────────────────────────────

// ── Crew: background Slack agents ─────────────────────────────────────────────
//
// This is the DOCUMENTED contract, mirrored into config/schema.json. The ENFORCED schema
// is CrewConfigSchema in cli/src/lib/crew/types.ts, which is strict and carries defaults.
// `crew` is parsed explicitly there rather than through readConfig, so those defaults are
// never written back into a user's config. crew-schema-drift.test.ts keeps the field sets
// in step.

/**
 * A scheduled, unprompted investigation the agent runs on its own -- distinct from answering
 * an inbound Slack message. `schedule` reuses `cronExpr` above rather than a second validator.
 * `require_explicit_finding` defaults true in the enforced schema (`ProactiveCheckSchema` in
 * `cli/src/lib/crew/types.ts`); this documented copy leaves it optional like every other field
 * here, per the file's own convention.
 */
const CrewProactiveCheckSchema = section({
  id: z.string().optional(),
  schedule: cronExpr.optional(),
  prompt: z.string().optional(),
  channel: z.string().optional(),
  require_explicit_finding: z.boolean().optional(),
});

const CrewAgentSchema = section({
  enabled: z.boolean().optional(),
  name: z.string().optional(),
  emoji: z.string().optional(),
  description: z.string().optional(),
  sigils: z.array(z.string()).optional(),
  model: z.string().optional(),
  workspace: z.string().optional(),
  tools: z.array(z.string()).optional(),
  max_turns: posInt.optional(),
  task_timeout_ms: posInt.optional(),
  persona: z.string().optional(),
  persona_file: z.string().optional(),
  proactive_checks: z.array(CrewProactiveCheckSchema).optional(),
});

const CrewSchema = section({
  enabled: z.boolean().optional(),
  mode: z.enum(["dry_run", "live"]).optional(),
  state_dir: z.string().optional(),
  slack: section({
    self_user_id: z.string().optional(),
    read_limit: posInt.optional(),
    max_pages: posInt.optional(),
    reactions: section({
      seen: z.string().optional(),
      done: z.string().optional(),
      failed: z.string().optional(),
      enabled: z.boolean().optional(),
    }).optional(),
    reply_in_thread: z.boolean().optional(),
    thread_active_ms: posInt.optional(),
  }).optional(),
  budget: section({
    daily_usd: z.number().positive().optional(),
    per_task_usd: z.number().positive().optional(),
  }).optional(),
  agents: z.record(z.string(), CrewAgentSchema).optional(),
  policy: section({
    ingress: section({
      channels: z.array(z.string()).optional(),
      authors: z.array(z.string()).optional(),
      require_sigil: z.boolean().optional(),
      ignore_older_than_ms: posInt.optional(),
      respond_to_others: z.boolean().optional(),
    }).optional(),
    egress: section({
      channels: z.array(z.string()).optional(),
      require_identity_prefix: z.boolean().optional(),
      max_message_chars: posInt.optional(),
      max_messages_per_task: posInt.optional(),
    }).optional(),
  }).optional(),
});

export const JstackConfigSchema = z
  .object({
    version: z.string().optional(),
    onboarding: OnboardingSchema.optional(),
    team: TeamSchema.optional(),
    sprint: SprintSchema.optional(),
    integrations: IntegrationsSchema.optional(),
    mcp_servers: McpRegistrySchema.optional().default({}),
    gbrain: GbrainSchema.optional(),
    session: SessionSchema.optional(),
    jira_rules: JiraRulesSchema.optional(),
    notion_defaults: NotionDefaultsSchema.optional(),
    policies: PoliciesSchema.optional(),
    approval_chains: ApprovalChainsSchema.optional(),
    channels: section({
      routing: z.record(z.string(), z.unknown()).optional(),
    }).optional(),
    debug: DebugSchema.optional(),
    skills: SkillsSchema.optional(),
    skill_defaults: z.record(z.string(), undescribed).optional(),
    cross_plugins: z.record(z.string(), CrossPluginEntrySchema).optional(),
    routines: RoutinesSchema.optional(),
    workflows: WorkflowsSchema.optional(),
    telemetry: TelemetrySchema.optional(),
    crew: CrewSchema.optional(),
    evals: EvalsSchema.optional(),
    knowledge_base: KnowledgeBaseSchema.optional(),
    knowledge_storage: KnowledgeStorageSchema.optional(),

    // Sections that exist in defaults.json and were previously absent from this schema entirely.
    reports: ReportsSchema.optional(),
    org_context: OrgContextSchema.optional(),
    team_context: TeamContextSchema.optional(),
    levels_and_expectations: LevelsSchema.optional(),
    one_on_one_cycle: OneOnOneCycleSchema.optional(),
    pe: PeSchema.optional(),
    distribution: DistributionSchema.optional(),
    standup: StandupSchema.optional(),
    weekly_digest: WeeklyDigestSchema.optional(),
    silo_scan: SiloScanSchema.optional(),
    engineering_health: EngineeringHealthSchema.optional(),
    claude_md_improver: ClaudeMdImproverSchema.optional(),
    brag: BragSchema.optional(),
    impact: ImpactSchema.optional(),
    impact_prep: section({ rubrics_file: z.string().optional() }).optional(),
    kickoff_workflows: KickoffWorkflowsSchema.optional(),
    ingest_all: z.array(undescribed).optional(),
    code_review: undescribed.optional(),
    tones: z.record(z.string(), z.unknown()).optional(),
    personas: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export type JstackConfig = z.infer<typeof JstackConfigSchema>;

/**
 * Format a Zod failure as one `path: message` line per issue.
 *
 * `readConfig` throws on invalid config, and a raw `ZodError` stringifies to a wall of JSON that
 * buries which key is wrong. Every caller that surfaces config errors to a human should use this.
 */
export function formatConfigIssues(error: z.ZodError): string[] {
  return error.issues.map((i) => {
    const path = i.path.length ? i.path.join(".") : "(root)";
    return `${path}: ${i.message}`;
  });
}

/**
 * Typed catalog of QuestionSpec entries for the jstack config wizard.
 *
 * Consumers (the prompt engine, doctor, dependency-resolver) read this file to
 * decide what to ask, what default to suggest, what canned discussion to show,
 * and which dep-check id to look up when the user wants more help.
 *
 * Add new entries here rather than hardcoding prompts in setup.ts.
 */

export type QuestionType = "string" | "boolean" | "select" | "list" | "url" | "path" | "ianaTz";

export type QuestionSpec = {
  /** Stable, unique kebab-case id. Safe to reference from telemetry, dep checks, tests. */
  id: string;
  /** JSON path into the config object, as path segments. */
  path: string[];
  /** Section grouping label for the wizard UI. */
  section: string;
  /** The question shown to the user (one line). */
  question: string;
  /** 1-2 sentence explanation of what this field does. */
  describe: string;
  /** Input shape — drives the prompt widget and validation. */
  type: QuestionType;
  /** Choices for type=select. */
  options?: { value: string; label: string }[];
  /** Concrete example value, e.g. "https://acme.atlassian.net". */
  example?: string;
  /** Multiline canned text shown when the user picks "Discuss". Honest tradeoffs, not marketing. */
  discussion?: string;
  /**
   * Returns the value to use when the user picks "Default".
   * Falls through: existing value at path → default value at path → undefined.
   */
  default?: (defaults: Record<string, unknown>, existing: Record<string, unknown>) => unknown;
  /**
   * What to do when the user skips. "omit" leaves the path absent in the patch (recommended);
   * "empty" writes a typed-empty value (e.g. "" or []).
   */
  skipBehavior?: "omit" | "empty";
  /** ID into the dependency-resolver registry (resolver lives in dependency-resolver.ts). */
  depId?: string;
  /** Optional simple validator. Returns null on success or an error message string. */
  validate?: (v: unknown) => string | null;
};

// ---------- Validators ----------

function validateUrl(v: unknown): string | null {
  if (typeof v !== "string") return "expected a string";
  if (v === "") return null; // skip-equivalent under empty skipBehavior
  if (!/^https?:\/\//i.test(v)) return "must start with http:// or https://";
  return null;
}

function validateIanaTz(v: unknown): string | null {
  if (typeof v !== "string") return "expected a string";
  if (v === "UTC") return null;
  if (!v.includes("/")) return "expected an IANA timezone like 'America/New_York' or 'UTC'";
  return null;
}

// ---------- Deep-get helpers ----------

export function getDefaultsAt(defaults: Record<string, unknown>, path: string[]): unknown {
  return deepGet(defaults, path);
}

export function getExistingAt(existing: Record<string, unknown>, path: string[]): unknown {
  return deepGet(existing, path);
}

function deepGet(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const seg of path) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

// ---------- Default factory ----------

/**
 * Standard fall-through default: existing → defaults → undefined.
 * Optional `fallback` is used only when neither existing nor defaults has a value.
 */
function existingOrDefault(path: string[], fallback?: unknown) {
  return (defaults: Record<string, unknown>, existing: Record<string, unknown>): unknown => {
    const e = deepGet(existing, path);
    if (e !== undefined && e !== "") return e;
    const d = deepGet(defaults, path);
    if (d !== undefined && d !== "") return d;
    return fallback;
  };
}

// ---------- Catalog ----------

export const QUESTION_CATALOG: QuestionSpec[] = [
  // -------------------- Team --------------------
  {
    id: "team-name",
    path: ["team", "name"],
    section: "Team",
    question: "Team name",
    describe: "Human-readable label for the team this config represents. Used in reports and prompts.",
    type: "string",
    example: "Platform Eng",
    discussion:
      "This is mostly cosmetic but it shows up in generated reports, standup headers, and AI prompts " +
      "that reference the team. Keep it short and recognizable to your org. If multiple subteams share " +
      "this config, prefer the umbrella name (e.g. 'Platform Eng') over a project codename. Renaming " +
      "later is safe — nothing keys off this string for routing.",
    default: existingOrDefault(["team", "name"]),
    skipBehavior: "omit",
  },
  {
    id: "team-timezone",
    path: ["team", "timezone"],
    section: "Team",
    question: "Team timezone (IANA)",
    describe: "Default timezone used to interpret business hours, cron expressions, and digest windows.",
    type: "ianaTz",
    example: "America/New_York",
    discussion:
      "Use a real IANA zone (e.g. 'America/New_York', 'Europe/Berlin') so DST is handled correctly. " +
      "'UTC' is fine for distributed teams that prefer absolute time, but routines like standup will " +
      "fire at the same UTC instant regardless of where members live. If your team is mostly co-located, " +
      "pick the office zone; if not, pick the manager's zone or UTC and document it elsewhere.",
    default: existingOrDefault(["team", "timezone"], "UTC"),
    validate: validateIanaTz,
    skipBehavior: "omit",
  },
  {
    id: "team-business-hours-start",
    path: ["team", "business_hours", "start"],
    section: "Team",
    question: "Business hours start (HH:MM, 24h)",
    describe: "Local-time start of the working day, used by routines and scheduling helpers.",
    type: "string",
    example: "09:00",
    discussion:
      "This bounds when automations like standup or reminders are allowed to fire and when 'after hours' " +
      "warnings trigger. Pick the time most of the team is reliably online, not the earliest riser. " +
      "If the team is split across zones, this is interpreted in team.timezone — distributed teams " +
      "may want to widen the window or override per-member later.",
    default: existingOrDefault(["team", "business_hours", "start"], "09:00"),
    skipBehavior: "omit",
  },
  {
    id: "team-business-hours-end",
    path: ["team", "business_hours", "end"],
    section: "Team",
    question: "Business hours end (HH:MM, 24h)",
    describe: "Local-time end of the working day. Pairs with business_hours.start.",
    type: "string",
    example: "17:00",
    discussion:
      "Mirror of business_hours.start. Use 24-hour format. If you want automations to keep running into " +
      "the evening, push this to 18:00 or 19:00; the field doesn't block work, it just informs scheduling " +
      "and 'is it polite to ping' heuristics. Keep start < end.",
    default: existingOrDefault(["team", "business_hours", "end"], "17:00"),
    skipBehavior: "omit",
  },
  {
    id: "team-canonical-group-mode",
    path: ["team", "canonical_group", "mode"],
    section: "Team",
    question: "How should tools resolve the team membership?",
    describe: "Selects the source of truth for 'who is on this team' beyond the local roster.",
    type: "select",
    options: [
      { value: "none", label: "none — no external group" },
      { value: "manual_list", label: "manual_list — team.members is the source of truth" },
      { value: "slack_user_group", label: "slack_user_group — resolve from a Slack user group" },
      { value: "google_group", label: "google_group — resolve from a Google Group email" },
    ],
    example: "manual_list",
    discussion:
      "manual_list is simplest and works offline — but you must keep team.members up to date by hand. " +
      "slack_user_group lets membership track Slack reality automatically (good for fast-moving teams) " +
      "but requires Slack auth and the group ID. google_group is similar but for orgs that gate " +
      "membership through Google Workspace. Pick 'none' only if this config isn't tied to a real team.",
    default: existingOrDefault(["team", "canonical_group", "mode"], "manual_list"),
    skipBehavior: "omit",
  },
  {
    id: "team-canonical-group-slack-id",
    path: ["team", "canonical_group", "slack_user_group_id"],
    section: "Team",
    question: "Slack user group ID (e.g. S01234567)",
    describe: "Used when canonical_group.mode = slack_user_group to resolve members at runtime.",
    type: "string",
    example: "S01234567",
    discussion:
      "Slack user groups have IDs starting with 'S'. Find one via the Slack UI (group settings) or the " +
      "Slack API (usergroups.list). The display handle (@eng-platform) is not the ID — store the ID here " +
      "so renames don't break resolution. Only relevant when mode = slack_user_group; safe to leave empty " +
      "otherwise.",
    default: existingOrDefault(["team", "canonical_group", "slack_user_group_id"]),
    skipBehavior: "omit",
  },
  {
    id: "team-canonical-group-google-email",
    path: ["team", "canonical_group", "google_group_email"],
    section: "Team",
    question: "Google Group email (e.g. team@company.com)",
    describe: "Used when canonical_group.mode = google_group to resolve members at runtime.",
    type: "string",
    example: "eng-platform@company.com",
    discussion:
      "This is the addressable group email — the same one HR or IT manages in Google Workspace. " +
      "Resolution requires Google auth wired up via MCP or a service account. If your group is private, " +
      "double-check that the runtime identity has list-members permission, otherwise resolution will " +
      "silently return empty.",
    default: existingOrDefault(["team", "canonical_group", "google_group_email"]),
    skipBehavior: "omit",
  },

  // -------------------- Integrations / JIRA --------------------
  {
    id: "integrations-jira-base-url",
    path: ["integrations", "jira", "base_url"],
    section: "Integrations / JIRA",
    question: "JIRA base URL",
    describe: "Root URL of your JIRA Cloud or Server instance. Issue links are built relative to this.",
    type: "url",
    example: "https://acme.atlassian.net",
    discussion:
      "Use the full https URL of your JIRA tenant — for Cloud this is usually 'https://<org>.atlassian.net'. " +
      "Don't include a trailing slash or a path; tools append /browse/KEY-123 themselves. If you have a " +
      "vanity domain in front of JIRA, prefer the canonical atlassian.net URL — it's less likely to break " +
      "on auth redirects.",
    default: existingOrDefault(["integrations", "jira", "base_url"]),
    validate: validateUrl,
    skipBehavior: "empty",
  },
  {
    id: "integrations-jira-project-key",
    path: ["integrations", "jira", "project_key"],
    section: "Integrations / JIRA",
    question: "Default JIRA project key",
    describe: "Used as the default project for issue creation and JQL scoping.",
    type: "string",
    example: "PLAT",
    discussion:
      "The short uppercase prefix on issue keys (the 'PLAT' in PLAT-1234). Tools that create issues will " +
      "default to this project unless overridden. If your team works across several projects, pick the one " +
      "that gets the most traffic — per-skill overrides are still possible. Leave empty if this config is " +
      "shared across teams with different projects.",
    default: existingOrDefault(["integrations", "jira", "project_key"]),
    skipBehavior: "empty",
  },

  // -------------------- Integrations / Slack --------------------
  {
    id: "integrations-slack-public-channel",
    path: ["integrations", "slack", "public_channel"],
    section: "Integrations / Slack",
    question: "Default public Slack channel",
    describe: "Channel for team-wide announcements and shareable digests.",
    type: "string",
    example: "#eng-platform",
    discussion:
      "Use the channel handle (with or without the leading '#'). This is where standup summaries, " +
      "weekly digests, and announce-style messages will land by default. Pick one that the team actually " +
      "watches — a low-traffic channel is better than a noisy one. Per-skill overrides still work.",
    default: existingOrDefault(["integrations", "slack", "public_channel"]),
    skipBehavior: "empty",
  },
  {
    id: "integrations-slack-private-channel",
    path: ["integrations", "slack", "private_channel"],
    section: "Integrations / Slack",
    question: "Default private Slack channel",
    describe: "Channel for sensitive output (drafts, manager-only notes, internal incidents).",
    type: "string",
    example: "#eng-platform-private",
    discussion:
      "Drafts, half-baked AI output, and manager-line content go here instead of the public channel. " +
      "Make sure membership matches your intended audience — this is the difference between 'leaked' " +
      "and 'private'. If you don't have a private channel yet, leave empty and tools will fall back to " +
      "DMs with the invoking user.",
    default: existingOrDefault(["integrations", "slack", "private_channel"]),
    skipBehavior: "empty",
  },
  {
    id: "integrations-slack-webhook-url",
    path: ["integrations", "slack", "webhook_url"],
    section: "Integrations / Slack",
    question: "Slack incoming webhook URL",
    describe: "Optional incoming webhook used as a low-auth fallback for posting messages.",
    type: "url",
    example: "https://hooks.slack.com/services/T000/B000/XXX",
    discussion:
      "An incoming webhook is a quick way to post without full Slack OAuth, but it's pinned to a single " +
      "channel and can't read history or threads. Prefer a real Slack MCP integration when you can; treat " +
      "the webhook as a fallback for CI-style notifications. If you set this, treat the URL as a secret — " +
      "anyone with it can post as your app.",
    default: existingOrDefault(["integrations", "slack", "webhook_url"]),
    validate: validateUrl,
    skipBehavior: "empty",
  },

  // -------------------- Integrations / Notion --------------------
  {
    id: "integrations-notion-workspace-id",
    path: ["integrations", "notion", "workspace_id"],
    section: "Integrations / Notion",
    question: "Notion workspace ID",
    describe: "Identifies which Notion workspace this config targets when you have access to several.",
    type: "string",
    example: "abcdef12-3456-7890-abcd-ef1234567890",
    discussion:
      "Most users only have one Notion workspace and can leave this empty. If you're integrated with " +
      "multiple workspaces (e.g. personal + company), set the workspace ID so tools don't accidentally " +
      "create pages in the wrong place. The ID format is a UUID; you can grab it from any page URL or " +
      "via the Notion API.",
    default: existingOrDefault(["integrations", "notion", "workspace_id"]),
    skipBehavior: "empty",
  },

  // -------------------- Integrations / GitHub --------------------
  {
    id: "integrations-github-org",
    path: ["integrations", "github", "org"],
    section: "Integrations / GitHub",
    question: "GitHub organization",
    describe: "Default GitHub org for repo lookups, search scope, and PR creation.",
    type: "string",
    example: "acme-corp",
    discussion:
      "The org slug as it appears in URLs ('github.com/<org>'). This narrows code search and is the " +
      "default scope for skills that create issues or PRs. Personal accounts: use your username. If you " +
      "switch employers or get acquired, remember to update this — it does not auto-detect.",
    default: existingOrDefault(["integrations", "github", "org"]),
    skipBehavior: "empty",
  },
  {
    id: "integrations-github-default-repo",
    path: ["integrations", "github", "default_repo"],
    section: "Integrations / GitHub",
    question: "Default GitHub repository (org/name or just name)",
    describe: "Repo used when a skill needs a target repo and none is explicitly provided.",
    type: "string",
    example: "platform-services",
    discussion:
      "Either bare ('platform-services') interpreted under integrations.github.org, or fully qualified " +
      "('acme-corp/platform-services'). This is the 'home' repo for the team — quick PRs and issue " +
      "creation default here. Skills that act across many repos (e.g. health checks) ignore this and " +
      "use their own scope.",
    default: existingOrDefault(["integrations", "github", "default_repo"]),
    skipBehavior: "empty",
  },

  // -------------------- Integrations / Google --------------------
  {
    id: "integrations-gcal-primary-calendar-id",
    path: ["integrations", "gcal", "primary_calendar_id"],
    section: "Integrations / Google",
    question: "Primary Google Calendar ID",
    describe: "Calendar used for scheduling, free/busy lookups, and meeting creation.",
    type: "string",
    example: "team-platform@company.com",
    discussion:
      "For your own calendar, this is your work email. For a shared team calendar, it's the long " +
      "@group.calendar.google.com ID found under calendar settings. Pick the calendar that should " +
      "receive new events created by jstack — usually a shared team calendar so everyone sees them, " +
      "not a personal one.",
    default: existingOrDefault(["integrations", "gcal", "primary_calendar_id"]),
    skipBehavior: "empty",
  },
  {
    id: "integrations-sheets-default-spreadsheet-id",
    path: ["integrations", "sheets", "default_spreadsheet_id"],
    section: "Integrations / Google",
    question: "Default Google Sheets spreadsheet ID",
    describe: "Default sheet for tracking metrics, rosters, or tabular dumps.",
    type: "string",
    example: "1AbCdEf...XYZ",
    discussion:
      "The long ID from the spreadsheet URL between '/d/' and '/edit'. Tools that log metrics or roster " +
      "info will use this sheet by default; per-skill overrides still work. Make sure the runtime identity " +
      "(service account or OAuth user) has edit access — read-only access will fail silently on appends.",
    default: existingOrDefault(["integrations", "sheets", "default_spreadsheet_id"]),
    skipBehavior: "empty",
  },

  // -------------------- GBrain & Knowledge --------------------
  {
    id: "gbrain-team-url",
    path: ["gbrain", "team", "url"],
    section: "GBrain & Knowledge",
    question: "Team GBrain URL",
    describe: "Endpoint for the team-shared GBrain memory store.",
    type: "url",
    example: "https://gbrain.example.com/team/platform",
    discussion:
      "GBrain is the long-term memory layer. The team URL points at a store everyone on the team " +
      "reads/writes — good for shared context, decisions, and cross-session memory. Leave empty if you " +
      "don't run GBrain or only use a personal store. Skills will gracefully degrade to in-config memory " +
      "when the URL is unset.",
    default: existingOrDefault(["gbrain", "team", "url"]),
    validate: validateUrl,
    depId: "gbrain-target-empty-url",
    skipBehavior: "empty",
  },
  {
    id: "gbrain-personal-url",
    path: ["gbrain", "personal", "url"],
    section: "GBrain & Knowledge",
    question: "Personal GBrain URL",
    describe: "Endpoint for your private GBrain memory store.",
    type: "url",
    example: "https://gbrain.example.com/users/jdoe",
    discussion:
      "Private memory: drafts, half-formed thoughts, manager-line notes that shouldn't land in the team " +
      "store. Most users want this set even if they don't set the team URL. Treat the URL as " +
      "auth-gated — anyone with it can read your memory unless your GBrain server enforces identity.",
    default: existingOrDefault(["gbrain", "personal", "url"]),
    validate: validateUrl,
    depId: "gbrain-target-empty-url",
    skipBehavior: "empty",
  },
  {
    id: "session-default-gbrain-target",
    path: ["session", "default_gbrain_target"],
    section: "GBrain & Knowledge",
    question: "Default GBrain target for new sessions",
    describe: "Whether new sessions write to team or personal GBrain unless overridden.",
    type: "select",
    options: [
      { value: "team", label: "team — share session memory with the team" },
      { value: "personal", label: "personal — keep session memory private" },
    ],
    example: "team",
    discussion:
      "If most of your work is collaborative and you want teammates to benefit from your context, pick " +
      "'team'. If you draft a lot of sensitive material (perf reviews, manager notes), pick 'personal' — " +
      "the safe default. You can always switch per-session; this only sets the boot-up choice.",
    default: existingOrDefault(["session", "default_gbrain_target"], "team"),
    skipBehavior: "omit",
  },
  {
    id: "knowledge-base-roots",
    path: ["knowledge_base", "roots"],
    section: "GBrain & Knowledge",
    question: "Knowledge base roots (paths or files, comma-separated)",
    describe: "Directories or files that retrieval should crawl as ground truth.",
    type: "list",
    example: "docs,README.md",
    discussion:
      "These are the on-disk paths the retrieval layer treats as authoritative. Start narrow ('docs', " +
      "'README.md') and grow as needed — adding the whole repo bloats indexing and dilutes results. " +
      "Paths are relative to the workspace. Combine with knowledge_base.include_globs / exclude_globs to " +
      "filter file types. If empty, retrieval has nothing to ground answers in.",
    default: existingOrDefault(["knowledge_base", "roots"], ["docs", "README.md"]),
    depId: "kb-root-missing",
    skipBehavior: "omit",
  },
  {
    id: "knowledge-base-gbrain-include",
    path: ["knowledge_base", "gbrain", "include"],
    section: "GBrain & Knowledge",
    question: "Include GBrain memory in retrieval?",
    describe: "When true, retrieval blends GBrain entries with file-based knowledge.",
    type: "boolean",
    example: "false",
    discussion:
      "Leave this off (the default) until your GBrain entries are clean and well-tagged — otherwise " +
      "retrieval picks up half-formed scratchpad notes and confidently cites them. Once your team's " +
      "memory hygiene is good, turn it on for richer answers. GBrain is a complement to listed roots, " +
      "not a replacement: keep docs/README.md in roots either way.",
    default: existingOrDefault(["knowledge_base", "gbrain", "include"], false),
    skipBehavior: "omit",
  },
  {
    id: "knowledge-storage-team-git-remote",
    path: ["knowledge_storage", "team", "git_remote"],
    section: "GBrain & Knowledge",
    question: "Team knowledge git remote",
    describe: "Remote URL of the shared team knowledge repo (clone target).",
    type: "url",
    example: "git@github.com:acme-corp/team-knowledge.git",
    discussion:
      "A dedicated repo for team-wide knowledge: runbooks, decisions, glossary. Tools clone this to " +
      "knowledge_storage.team.local_checkout and read from disk. Without a remote, intake falls back " +
      "to disk_fallback_root and notes are local-only. SSH form is recommended so push works without " +
      "extra auth setup.",
    default: existingOrDefault(["knowledge_storage", "team", "git_remote"]),
    validate: validateUrl,
    skipBehavior: "empty",
  },
  {
    id: "knowledge-storage-team-local-checkout",
    path: ["knowledge_storage", "team", "local_checkout"],
    section: "GBrain & Knowledge",
    question: "Team knowledge local checkout path",
    describe: "On-disk path where the team knowledge repo is cloned.",
    type: "path",
    example: "~/work/team-knowledge",
    discussion:
      "Usually a sibling directory to your code workspace. Add this path to knowledge_base.roots so " +
      "retrieval indexes it. If you set git_remote but leave this empty, tools won't auto-clone — they " +
      "fall back to disk_fallback_root and you lose the git roundtrip benefit. Tilde and absolute paths " +
      "both work; relative paths resolve from the workspace.",
    default: existingOrDefault(["knowledge_storage", "team", "local_checkout"]),
    depId: "ks-team-checkout-not-on-disk",
    skipBehavior: "empty",
  },
  {
    id: "knowledge-storage-personal-git-remote",
    path: ["knowledge_storage", "personal", "git_remote"],
    section: "GBrain & Knowledge",
    question: "Personal knowledge git remote",
    describe: "Remote URL of your private knowledge repo.",
    type: "url",
    example: "git@github.com:jdoe/notes.git",
    discussion:
      "A private repo for personal notes — drafts, 1:1 prep, perf review scratch. Often this lives in " +
      "a personal config overlay, not the shared jstack.config.json, so the remote URL doesn't get " +
      "checked into the team repo. If you don't have a personal notes repo yet, leave empty and use " +
      "disk_fallback_root.",
    default: existingOrDefault(["knowledge_storage", "personal", "git_remote"]),
    validate: validateUrl,
    skipBehavior: "empty",
  },
  {
    id: "knowledge-storage-personal-local-checkout",
    path: ["knowledge_storage", "personal", "local_checkout"],
    section: "GBrain & Knowledge",
    question: "Personal knowledge local checkout path",
    describe: "On-disk path where the personal knowledge repo is cloned.",
    type: "path",
    example: "~/notes",
    discussion:
      "Same shape as the team checkout, but for your personal repo. Keep it outside the team workspace " +
      "if possible so accidental indexing/sharing is harder. If you have a personal config overlay, " +
      "set it there rather than the shared file.",
    default: existingOrDefault(["knowledge_storage", "personal", "local_checkout"]),
    skipBehavior: "empty",
  },
  {
    id: "knowledge-storage-disk-fallback-root",
    path: ["knowledge_storage", "disk_fallback_root"],
    section: "GBrain & Knowledge",
    question: "Disk fallback root for unconfigured knowledge writes",
    describe: "Where intake writes markdown when no git_remote/local_checkout is configured.",
    type: "path",
    example: "/tmp/knowledgebase",
    discussion:
      "A safety net: when a skill wants to capture a note but team/personal storage isn't set up, files " +
      "land here under team/ or personal/ subdirs. Default '/tmp/knowledgebase' is fine for trying " +
      "things out, but '/tmp' is volatile on most systems — switch to a real path under your home dir " +
      "once you're past the experimentation phase.",
    default: existingOrDefault(["knowledge_storage", "disk_fallback_root"], "/tmp/knowledgebase"),
    skipBehavior: "omit",
  },

  // -------------------- Telemetry & Debug --------------------
  {
    id: "telemetry-enabled",
    path: ["telemetry", "enabled"],
    section: "Telemetry & Debug",
    question: "Enable telemetry?",
    describe: "When true, jstack emits usage and error events to telemetry.endpoint.",
    type: "boolean",
    example: "false",
    discussion:
      "Off by default. Telemetry helps surface real failure patterns and which skills get used, but " +
      "events leave your machine. Turn it on if you trust the endpoint and want to contribute signal — " +
      "or if your org runs its own telemetry sink. Pair with telemetry.endpoint; both must be set for " +
      "events to actually flow.",
    default: existingOrDefault(["telemetry", "enabled"], false),
    skipBehavior: "omit",
  },
  {
    id: "telemetry-endpoint",
    path: ["telemetry", "endpoint"],
    section: "Telemetry & Debug",
    question: "Telemetry endpoint URL",
    describe: "Where to POST batched telemetry events.",
    type: "url",
    example: "https://telemetry.example.com/v1/ingest",
    discussion:
      "An HTTPS endpoint that accepts batched JSON payloads. Has no effect unless telemetry.enabled is " +
      "true. If your org runs an internal collector, point at that to keep data inside the perimeter. " +
      "Don't point at endpoints you don't control — events may include skill names, file paths, and " +
      "error messages.",
    default: existingOrDefault(["telemetry", "endpoint"]),
    validate: validateUrl,
    skipBehavior: "empty",
  },
  {
    id: "debug-enabled",
    path: ["debug", "enabled"],
    section: "Telemetry & Debug",
    question: "Enable debug mode?",
    describe: "Master switch for verbose logging, trace output, and skill instrumentation.",
    type: "boolean",
    example: "false",
    discussion:
      "Off in normal use. When on, skills log more, MCP traffic gets traced, and warnings escalate to " +
      "errors in some checks. Useful when you're chasing a bug or building a new skill — noisy " +
      "otherwise. Combine with debug.log_level and debug.trace_skills for finer control.",
    default: existingOrDefault(["debug", "enabled"], false),
    skipBehavior: "omit",
  },
  {
    id: "debug-mock-mcp",
    path: ["debug", "mock_mcp"],
    section: "Telemetry & Debug",
    question: "Mock MCP servers (for offline / CI)?",
    describe: "When true, MCP calls return canned fixtures instead of hitting real servers.",
    type: "boolean",
    example: "false",
    discussion:
      "Useful for CI runs and offline development: no real Slack/JIRA/Notion calls happen. The trade-off " +
      "is that fixtures can lag behind real MCP behavior, so a green test suite doesn't always mean " +
      "production works. Pair with debug.mock_mcp_scenario to pick which fixture set is active.",
    default: existingOrDefault(["debug", "mock_mcp"], false),
    depId: "mcp-mock-missing",
    skipBehavior: "omit",
  },
  {
    id: "debug-mock-mcp-scenario",
    path: ["debug", "mock_mcp_scenario"],
    section: "Telemetry & Debug",
    question: "Mock MCP scenario name",
    describe: "Selects which fixture set the MCP mock layer should serve.",
    type: "string",
    example: "happy-path",
    discussion:
      "Only meaningful when debug.mock_mcp is true. Scenarios are named directories of canned responses " +
      "(e.g. 'happy-path', 'jira-down', 'slack-rate-limited'). Use scenarios to write tests that exercise " +
      "specific failure modes deterministically. Empty string falls back to the default scenario.",
    default: existingOrDefault(["debug", "mock_mcp_scenario"]),
    skipBehavior: "empty",
  },

  // -------------------- Routines --------------------
  {
    id: "routines-standup-enabled",
    path: ["routines", "standup", "enabled"],
    section: "Routines",
    question: "Enable standup routine?",
    describe: "When true, the standup chain runs on routines.standup.cron.",
    type: "boolean",
    example: "false",
    discussion:
      "Off by default so cron doesn't fire on a half-configured machine. Turn on once your Slack and " +
      "JIRA integrations work and you've reviewed the chain ('recon', 'announcements'). The schedule " +
      "respects team.timezone for cron interpretation. Enabling this on a personal laptop fires only " +
      "while the laptop is awake — for reliability, run it on a server.",
    default: existingOrDefault(["routines", "standup", "enabled"], false),
    skipBehavior: "omit",
  },
  {
    id: "routines-standup-cron",
    path: ["routines", "standup", "cron"],
    section: "Routines",
    question: "Standup cron expression",
    describe: "Cron schedule (in team.timezone) for the standup routine.",
    type: "string",
    example: "0 9 * * 1-5",
    discussion:
      "Standard 5-field cron. Default '0 9 * * 1-5' = 9:00 weekdays. Pick a time slightly before the " +
      "actual standup so the digest has had time to land in Slack. Avoid times that collide with " +
      "calendar updates or sprint cron jobs — the routine has no internal queueing.",
    default: existingOrDefault(["routines", "standup", "cron"], "0 9 * * 1-5"),
    skipBehavior: "omit",
  },
  {
    id: "routines-weekly-digest-enabled",
    path: ["routines", "weekly_digest", "enabled"],
    section: "Routines",
    question: "Enable weekly digest routine?",
    describe: "When true, the weekly digest chain runs on routines.weekly_digest.cron.",
    type: "boolean",
    example: "false",
    discussion:
      "The weekly digest aggregates the past week into a Slack/Notion post. Off by default — turn on " +
      "once you've vetted the chain output once or twice manually so you're not surprised by a public " +
      "post. As with standup, run on a stable host (not a laptop that sleeps) for reliability.",
    default: existingOrDefault(["routines", "weekly_digest", "enabled"], false),
    skipBehavior: "omit",
  },
  {
    id: "routines-weekly-digest-cron",
    path: ["routines", "weekly_digest", "cron"],
    section: "Routines",
    question: "Weekly digest cron expression",
    describe: "Cron schedule (in team.timezone) for the weekly digest routine.",
    type: "string",
    example: "0 16 * * 5",
    discussion:
      "Default '0 16 * * 5' = 4pm Friday. Late-Friday timing gives the team a wrap-up read before the " +
      "weekend; some teams prefer Monday morning instead ('0 9 * * 1'). Stay consistent — readers learn " +
      "to expect digests on a known cadence, and shifting it weekly breaks that habit.",
    default: existingOrDefault(["routines", "weekly_digest", "cron"], "0 16 * * 5"),
    skipBehavior: "omit",
  },

  // -------------------- Cross-plugins --------------------
  {
    id: "cross-plugins-gbrain-enabled",
    path: ["cross_plugins", "gbrain", "enabled"],
    section: "Cross-plugins",
    question: "Enable gbrain cross-plugin skills?",
    describe: "When true, gbrain:* skills (plan-review, code-review, qa, etc.) become available.",
    type: "boolean",
    example: "false",
    discussion:
      "Off by default because the gbrain plugin isn't installed everywhere. Turn on only when your host " +
      "actually exposes the gbrain:* skills — otherwise jstack doctor will warn about unresolved skills. " +
      "If you're not sure whether your host has them, run 'jstack doctor --json' and look for gbrain " +
      "skill resolution warnings.",
    default: existingOrDefault(["cross_plugins", "gbrain", "enabled"], false),
    depId: "cross-plugins-gbrain-empty-skills",
    skipBehavior: "omit",
  },
];

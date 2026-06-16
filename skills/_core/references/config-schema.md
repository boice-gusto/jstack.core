# Config schema reference

Complete reference for `jstack.config.json`. Every key, its type, what reads it, and the default value.

Source of truth: `config/defaults.json` (defaults) and `config/schema.json` (validation).

## onboarding

Optional **workspace readiness** metadata (separate from per-integration flags under `notion_defaults.*`).

| Key | Type | Default | Used by |
|-----|------|---------|---------|
| `onboarding.complete` | bool | `false` | Team-defined “setup is done”; skills may read for UX only |
| `onboarding.wizard_last_run` | string | `""` | Opaque id or ISO date from last `jstack setup` / wizard |
| `onboarding.required_integrations` | string[] | `[]` | Logical ids checked by `scripts/validate-config.ts`: `jira`, `slack`, `notion`, `github`, `gcal`, `sheets`, `gbrain_team`, `gbrain_personal`. Empty list = no check. Warnings by default; set **`JSTACK_STRICT_INTEGRATIONS=1`** to fail CI when a listed integration is still empty |
| `onboarding.notes` | string | (see `defaults.json`) | Human reminder; not read by tooling |

## team

| Key | Type | Default | Used by |
|-----|------|---------|---------|
| `team.name` | string | `""` | All skills — display name in output |
| `team.timezone` | string | `"UTC"` | Scheduling, time formatting |
| `team.business_hours.start` | string | `"09:00"` | Standup timing, notification windows |
| `team.business_hours.end` | string | `"17:00"` | Same |
| `team.business_hours.days` | string[] | `["mon".."fri"]` | Same |
| `team.members` | object[] | `[]` | Roster, approvals, 1:1 Notion wiring, @mentions |
| `team.canonical_group` | object | see `defaults.json` | Optional Slack user group or Google Group + `mode`; see `skills/team/references/team-canonical-identity.md` |

### team.canonical_group shape

| Key | Type | Purpose |
|-----|------|---------|
| `mode` | string | `none` \| `manual_list` \| `slack_user_group` \| `google_group` |
| `slack_user_group_id` | string | Slack API user group id when `mode` is `slack_user_group` |
| `slack_handle` | string | Human-visible handle (e.g. subteam mention) when known |
| `google_group_email` | string | Primary group email when `mode` is `google_group` |
| `display_name` | string | Optional label for reports / wizard output |

### team.members shape

Each entry includes a stable top-level **`id`** (slug) for maps and skill logs, plus nested buckets for integrations. Prefer this shape in new configs; legacy flat fields (`name`, `level`, `github` string, etc.) may still appear in old files — skills should read nested paths first, then fall back to flat keys when present.

```json
[
  {
    "id": "alice",
    "metadata": {
      "name": "Alice",
      "role": "IC",
      "level": "L5",
      "title": "Senior Engineer"
    },
    "github": { "login": "alice-dev" },
    "email": { "primary": "alice@company.com" },
    "jira": { "account_id": "557058:xxx" },
    "notion": {
      "one_on_one_parent_page_id": "",
      "template_page_id": "",
      "person_hub_page_id": ""
    },
    "slack": { "handle": "@alice", "user_id": "U01234567" },
    "misc": {}
  }
]
```

| Block | Typical keys | Purpose |
|-------|----------------|---------|
| **`metadata`** | `name`, `role`, `level`, `title`, … | Display and org context (extend as needed). |
| **`github`** | `login` | GitHub username for PRs, blame, roster match. |
| **`email`** | `primary` | Work email; optional extra keys if your org needs them. |
| **`jira`** | `account_id` | Jira Cloud account id (profile/API); optional `display_name`. |
| **`notion`** | see below | 1:1 and hub page ids. |
| **`slack`** | `handle`, `user_id` | Mention handle and API user id. |
| **`misc`** | freeform | Team-specific tags; wizard may set `note`; add keys by hand. |

- **`notion.one_on_one_parent_page_id`:** Notion page id (from URL) for this person’s 1:1 section under `parent_pages.one_on_ones` (or org-equivalent).
- **`notion.template_page_id`:** Optional per-person gallery template to duplicate for prep/after; if empty, use `one_on_one_cycle.notion.default_template_page_key` → `notion_defaults.template_pages`.
- **`notion.person_hub_page_id`:** Optional link under `team_people` for shared roster.

Full wizard and discovery notes: `skills/team/references/team-canonical-identity.md`.

## sprint

| Key | Type | Default | Used by |
|-----|------|---------|---------|
| `sprint.cadence_weeks` | number | `2` | Sprint planning, close, velocity |
| `sprint.current` | string | `""` | Sprint skills — current sprint name/id |
| `sprint.ceremonies` | string[] | `["planning", "retro"]` | Sprint chain, routines |
| `sprint.capacity_metric` | string | `"story_points"` | Planning, velocity calculation |
| `sprint.velocity_window` | number | `3` | How many past sprints to average |

## approval_chains

| Key | Type | Default | Used by |
|-----|------|---------|---------|
| `approval_chains.template` | string | `""` | Which predefined template is active |
| `approval_chains.chains` | object | `{}` | Per-action approval sequences |

See `_core/references/approval-chains.md` for templates and resolution rules.

## knowledge_base

Declarative **where to look** for org answers: local paths, doc URLs, GitHub repos, plus optional GBrain merge. Used by `jstack:knowledge-search`.

| Key | Type | Default | Used by |
|-----|------|---------|---------|
| `knowledge_base.roots` | string[] | `["docs","README.md"]` | Workspace paths to read |
| `knowledge_base.include_globs` / `exclude_globs` | string[] | see `defaults.json` | Filter files under roots |
| `knowledge_base.doc_urls` | object[] | `[]` | Public docs; `{ label, url, note? }` |
| `knowledge_base.github` | object | `{ "repos": [], ... }` | `owner/repo` list + issue search toggle |
| `knowledge_base.retrieval.system_prompt` | string | (see defaults) | Citation and synthesis rules |
| `knowledge_base.retrieval.per_source` | object[] | `[]` | Finer prompts matched by path substring |
| `knowledge_base.gbrain.include` | bool | `false` | Also query GBrain for the same Q |

Details: `skills/knowledge/search/references/config-shape.md`.

## knowledge_storage

| Key | Type | Default | Purpose |
|-----|------|---------|---------|
| `knowledge_storage.disk_fallback_root` | string | `/tmp/knowledgebase` | Markdown when `local_checkout` empty: `{root}/team/...` or `{root}/personal/...` |
| `knowledge_storage.team.git_remote` | string | `""` | Shared team KB repo URL |
| `knowledge_storage.team.local_checkout` | string | `""` | Workspace-relative clone path; add to `knowledge_base.roots` |
| `knowledge_storage.personal.git_remote` | string | `""` | Personal KB repo (often private overlay) |
| `knowledge_storage.personal.local_checkout` | string | `""` | Personal clone path |

Details: `skills/knowledge/search/references/config-shape.md`.

## integrations

| Key | Type | Default | Used by |
|-----|------|---------|---------|
| `integrations.jira.base_url` | string | `""` | All Jira skills |
| `integrations.jira.project_key` | string | `""` | Ticket creation, queries |
| `integrations.jira.board_id` | string | `""` | Sprint board operations |
| `integrations.slack.public_channel` | string | `""` | Announcements, standup posts |
| `integrations.slack.private_channel` | string | `""` | Internal team comms |
| `integrations.slack.webhook_url` | string | `""` | Outbound notifications |
| `integrations.notion.workspace_id` | string | `""` | All Notion skills |
| `integrations.notion.databases` | object | `{}` | Database-specific operations |
| `integrations.github.org` | string | `""` | PR, issue, repo operations |
| `integrations.github.default_repo` | string | `""` | Default when repo not specified |
| `integrations.gcal.primary_calendar_id` | string | `""` | Meeting skills |
| `integrations.sheets.default_spreadsheet_id` | string | `""` | Reporting skills |
| `integrations.share_html.*` | object | see `defaults.json` | Hosted HTML publish + report shell / CDN profile / branding |
| `integrations.google_drive.transcripts_folder_id` | string | `""` | Transcript ingest; Drive MCP + `integration-guide.md` |
| `integrations.transcripts.*` | object | see `defaults.json` | Source toggles (granola, notion, zoom), Notion DB id, Zoom folder |

## policies

| Key | Type | Default | Used by |
|-----|------|---------|---------|
| `policies.review.required_approvals` | number | `1` | Review policy |
| `policies.review.counsel_roles` | string[] | `["ceo","designer","engineer","qa"]` | Which personas to apply |
| `policies.announcements.approval_required` | bool | `true` | Announcement workflow |
| `policies.announcements.channels` | string[] | `[]` | Target channels |
| `policies.incidents.severity_levels` | string[] | `["sev4".."sev1"]` | Incident classification |
| `policies.incidents.escalation` | object | `{}` | Per-severity escalation paths |
| `policies.sdlc.stages` | string[] | `["plan","build","test","release"]` | Gate enforcement |
| `policies.sdlc.gates` | object | `{}` | Per-stage entry/exit criteria |

## tones

Runtime overrides for `prompts/tones/*.md`. Any key here merges on top of the markdown file defaults.

| Key | Type | Used by |
|-----|------|---------|
| `tones.executive` | object | Executive tone overrides |
| `tones.internal` | object | Internal tone overrides |
| `tones.formal` | object | Formal tone overrides |

## personas

Runtime overrides for `prompts/personas/*.md`.

| Key | Type | Used by |
|-----|------|---------|
| `personas.engineer` | object | Staff engineer persona overrides |
| `personas.designer` | object | Designer persona overrides |
| `personas.ceo` | object | CEO/exec persona overrides |
| `personas.qa` | object | QA persona overrides |

## gbrain (endpoints + provenance)

| Key | Type | Default | Used by |
|-----|------|---------|---------|
| `gbrain.team.url` / `gbrain.personal.url` | string | `""` | GBrain base URLs; trust in sibling `trust_policy` |
| `gbrain.provenance.config_label` | string | `""` | Stamped on GBrain writes (e.g. which profile: `work`, `home`) |
| `gbrain.provenance.entry_fields` | string[] | (see `defaults.json`) | Which keys to include in the entry envelope |
| `gbrain.provenance.resolve_slack_from_team_members` | bool | `true` | Match current user to `team.members` for `slack_handle` / ids |
| `gbrain.provenance.identity` | object | `slack_user_id`, `slack_handle`, `display_name` | Manual overrides if resolution fails |

Full envelope spec: `skills/knowledge/references/gbrain-entry-provenance.md`.

## session

| Key | Type | Default | Used by |
|-----|------|---------|---------|
| `session.default_gbrain_target` | string | `"team"` | GBrain routing |
| `session.current_session_id` | string | `""` | Opaque id for this jstack session; **stamp on GBrain entries** with provenance |
| `session.auto_end` | bool | `false` | Session lifecycle |
| `session.metrics_on_end` | bool | `true` | End-of-session telemetry |
| `session.diary_auto_prompt` | bool | `false` | Diary skill trigger |

## routines

| Key | Type | Default | Used by |
|-----|------|---------|---------|
| `routines.standup.enabled` | bool | `false` | Cron standup chain |
| `routines.standup.cron` | string | `"0 9 * * 1-5"` | Schedule |
| `routines.standup.chain` | string[] | `["recon","announcements"]` | Skill sequence |
| `routines.weekly_digest.*` | — | — | Same pattern |
| `routines.sprint_close.*` | — | — | Same pattern |
| `routines.health_check.*` | — | — | Same pattern |

## team_context

Optional **paths** to team-maintained markdown (no org-specific content in base jstack — you author the files). Used by standup, brag, impact-prep, weekly-digest, oncall-summary, find-sme, silo-scan, and related skills.

| Key | Type | Default | Used by |
|-----|------|---------|---------|
| `team_context.base_path` | string | `""` | Resolve relative paths for team_context files |
| `team_context.files.slack_channels` | string | `""` | Filename under `base_path` (e.g. `slack-channels.md`) |
| `team_context.files.jira_incidents` | string | `""` | Same |
| `team_context.files.pagerduty` | string | `""` | Same |
| `team_context.files.observability` | string | `""` | Same |
| `team_context.files.github` | string | `""` | Same |
| `team_context.files.escalation` | string | `""` | Same |

Stub templates: `templates/config/team-context/*.md.example`. See `integration-guide.md` for an illustrative JSON shape.

## levels_and_expectations

Your org’s ladder / behaviors (paths and links only — not shipped in-repo).

| Key | Type | Default | Used by |
|-----|------|---------|---------|
| `levels_and_expectations.markdown_path` | string | `""` | brag, impact-prep, eval — `Read` when set |
| `levels_and_expectations.canonical_url` | string | `""` | Human “source of truth” link |

Example template: `templates/config/levels-expectations.example.md`.

## org_context

Optional **org-wide** markdown slices and integration hints: ethics, handbook, HR-safe public guidance, coaching, self-review / critical-review rubrics, plus optional Notion page ids and Google Drive folder ids. Used by self-eval, advice, coaching-adjacent flows, and any skill that must ground in org policy **without** hardcoding URLs.

Full injection contract: `skills/_core/references/org-context.md`. **Standard setup and copy-paste templates:** `templates/config/org-context/README.md`.

| Key | Type | Default | Used by |
|-----|------|---------|---------|
| `org_context.local.base_path` | string | `""` | Resolve filenames under `local.files` |
| `org_context.local.files.org_structure` | string | `""` | Filename under `base_path` |
| `org_context.local.files.ethics` | string | `""` | Same |
| `org_context.local.files.engineering_handbook` | string | `""` | Same |
| `org_context.local.files.hr_public` | string | `""` | Same |
| `org_context.local.files.coaching` | string | `""` | Same |
| `org_context.local.files.self_review_rubric` | string | `""` | Same |
| `org_context.local.files.critical_review_rubric` | string | `""` | Same |
| `org_context.notion_pages` | object | `{}` | Map slice id → Notion page/db id when using Notion MCP |
| `org_context.google_drive_folders` | object | `{}` | Map slice id → Drive folder or file id |
| `org_context.people.prefer_team_members` | bool | `true` | Resolve people from `team.members` before tools |
| `org_context.mcp_labels.documents` | string[] | `[]` | Host labels for doc-oriented MCP servers |
| `org_context.mcp_labels.people` | string[] | `[]` | Host labels for people-oriented MCP servers |

### `skill_defaults.*.org_context_slices`

| Key | Type | Purpose |
|-----|------|---------|
| `skill_defaults.<id>.org_context_slices` | string[] | List of `org_context.local.files` keys to load; include token `levels` to also load `levels_and_expectations.markdown_path`. |

## kickoff_workflows

Machine-readable **morning (or other) kickoff** steps for `jstack-morning-kickoff`. Narrative playbooks stay in `prompts/chains/`; this block is executable. See `chaining-guide.md`.

| Key | Type | Default | Used by |
|-----|------|---------|---------|
| `kickoff_workflows.morning.path` | string | `""` | Path to YAML/JSON step list |
| `kickoff_workflows.definitions` | object[] | `[]` | Inline named workflows (optional) |
| `kickoff_workflows.state_path` | string | `""` | Optional resume file (e.g. under `.jstack/state/`) |

Example file: `templates/config/kickoff/morning.example.yaml`. Step objects use **logical skill ids** (`name` from target `SKILL.md` frontmatter), optional `prompt`, `required`, `on_fail`: `stop` \| `continue` \| `ask`.

## impact

Impact framing for **eval**, **brag**, and **impact-prep** (data shapes only — no employer rubrics in-repo).

| Key | Type | Default | Used by |
|-----|------|---------|---------|
| `impact.framework` | string | `nine_box` (skill default if omitted) | `nine_box`, `stack_rank_team`, `stack_rank_org`, `dimensions`, `custom` |
| `impact.custom_rubric_path` | string | `""` | User-owned markdown rubric |
| `org_priorities_file` | string | `""` | Optional ordered initiatives for org scope |

## brag

| Key | Type | Default | Used by |
|-----|------|---------|---------|
| `brag.default_mode` | string | `daily` | `daily` \| `weekly` |
| `brag.dimensions_file` | string | `""` | Impact dimensions markdown |
| `brag.level` | string | `""` | Display label only (e.g. IC scope) |
| `brag.google_doc_id` | string | `""` | Optional publish target |

## impact_prep

| Key | Type | Default | Used by |
|-----|------|---------|---------|
| `impact_prep.rubrics_file` | string | `""` | Optional scoring tables (user-owned) |

## standup

| Key | Type | Default | Used by |
|-----|------|---------|---------|
| `standup.side_work_thresholds` | object | `{}` | When to include “side” channels (e.g. message counts) |
| `standup.jira_comments` | bool | `false` | Draft per-ticket comments with standup |

## weekly_digest

| Key | Type | Default | Used by |
|-----|------|---------|---------|
| `weekly_digest.window_days` | number | `14` in `defaults.json` | Lookback window; override per team |
| `weekly_digest.notion_parent_page_id` | string | `""` | Optional Notion parent |
| `weekly_digest.dual_audience` | bool | `false` | Extra customer-facing subsection |

## silo_scan

| Key | Type | Default | Used by |
|-----|------|---------|---------|
| `silo_scan.confidence_threshold` | number | `0.6` in `defaults.json` | Min score to surface overlap |
| `silo_scan.comment_marker` | string | `""` | Dedup marker for suggested comments |
| `silo_scan.jira_lookback_days` | number | `120` | Search window |

## engineering_health

| Key | Type | Default | Used by |
|-----|------|---------|---------|
| `engineering_health.stale_pr_days` | number | `3` in `defaults.json` | Stale PR threshold |

## code_review

| Key | Type | Default | Used by |
|-----|------|---------|---------|
| `code_review.*` | — | — | GitHub team slug, queue filters — keep in `integrations.github` where possible; use this block for skill-only overrides |

All values above are **placeholders for your config** — base jstack does not embed real channel IDs, project keys, or internal URLs in this reference.

## one_on_one_cycle

| Key | Type | Default | Used by |
|-----|------|---------|---------|
| `one_on_one_cycle.transcript_sources` | string[] | `[]` | Workspace-relative dirs or globs where past transcripts live (read-only); agent resolves files the user can access |
| `one_on_one_cycle.primary_storage` | string | `"notion"` | `"notion"` or `"lattice"` — intent only; Lattice requires MCP tools |
| `one_on_one_cycle.lattice` | object | see `defaults.json` | When `enabled` and MCP label matches, prefer Lattice 1:1 flows |
| `one_on_one_cycle.notion` | object | see `defaults.json` | Fallback parent keys into `notion_defaults.parent_pages` |
| `one_on_one_cycle.ai_attribution` | object | — | Footer appended to all AI-drafted 1:1 prep/after bodies |
| `one_on_one_cycle.prepare_vs_after` | object | — | Title suffixes and whether to cite transcript paths in the page body |

Details: `skills/meetings/one-on-one-transcript/references/config-shape.md`

## skills

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `skills.machine_readable.enabled` | boolean | `true` | When `false`, automation must not auto-inject `--output=json` / `--output=yaml` on skill runs; users may still ask for structured output in chat. |
| `skills.machine_readable.require_schema_ref` | boolean | `false` | When `true`, JSON structured output should include a top-level `$schema` URI matching the skill schema’s `$id`. |

Other keys under **`skills`** remain available for per-skill overrides (arbitrary objects), consistent with `schema.json` `additionalProperties`.

See [`output-formats.md`](./output-formats.md).

## Other sections

| Section | Purpose | Details |
|---------|---------|---------|
| `onboarding` | Optional setup completeness + `required_integrations` gates | See **onboarding** above; `validate-config` |
| `sprint` | Cadence, ceremonies, velocity | See **sprint** above |
| `approval_chains` | Review routing templates | See **approval_chains** above |
| `knowledge_base` / `knowledge_storage` | Search roots + Git fallback paths | See **knowledge_base** / **knowledge_storage** above |
| `mcp_servers` | MCP server registry | See `_core/references/integration-guide.md` |
| `gbrain` | Team/personal URLs + `provenance` (session/config/Slack on writes) | `gbrain-patterns.md`, `gbrain-entry-provenance.md` |
| `jira_rules` | Jira enforcement rules | Required fields, transitions, naming |
| `notion_defaults` | Notion defaults | `parent_pages`, `post_targets`, `private_vault`, `team_notion`, `template_pages`, `database_ids`, tags, auto-backlink — see [`skills/notion/references/notion-vault-and-routing.md`](../../notion/references/notion-vault-and-routing.md) |
| `channels.routing` | Channel routing rules | Map action types to channels |
| `cross_plugins` | gstack + superpowers + **gbrain** | Enabled flags and skill lists; **`cross_plugins.gbrain.enabled`** requires non-empty **`skills[]`** (validate-config + `jstack doctor` warn when empty) |
| `workflows` | Workflow runner config | Output format, artifacts dir |
| `telemetry` | Opt-in metrics | Endpoint, batch size, flush interval |
| `evals` | Eval gates | Token budgets, latency thresholds |
| `debug` | Debug mode | **`debug.enabled`** (boolean) is the canonical debug/trace toggle — do not rely on a duplicate top-level `debug: true`. **`debug.mock_mcp`** (default `false`): when `true`, use the stdio MCP fixture for deterministic tool responses in tests; **`debug.mock_mcp_scenario`** optional string selects a folder under `mcp-mock/scenarios` (empty = `default`). See [`mcp-mock-testing.md`](./mcp-mock-testing.md). Also: `log_level`, `trace_skills`, `trace_chains`. |
| `skills` | Per-skill config + machine-readable policy | See **skills** above; arbitrary per-skill overrides allowed |
| `skill_defaults` | Default skill params | Merged into every skill invocation; optional `org_context_slices` per skill — see **org_context** |
| `org_context` | Handbook, ethics, HR-safe docs, rubrics, MCP hints | `org-context.md`, self-eval, advice |

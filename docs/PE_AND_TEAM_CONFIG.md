# PE and team management configuration

People-engineering and team-management skills consume **structured config** only — core does not ship real team names or project keys.

## Keys (`jstack.config.json`)

| Key | Type | Required for PE reports | Description |
|-----|------|-------------------------|-------------|
| `pe.configured` | boolean | Yes (must be `true`) | Set by `jstack setup --pe` or manually after filling PE fields. |
| `pe.teams` | string[] | Yes | Opaque team slugs or ids (your org’s convention). |
| `pe.projects` | string[] | Optional | Named initiatives or product areas. |
| `pe.jira_project_keys` | string[] | Often | Jira keys for throughput / sprint reports. |
| `pe.notion_parent_keys` | string[] | Optional | Keys into `notion_defaults.parent_pages` for PE hubs (e.g. `pe_index`, `private_root`). |
| `pe.reporting_window_days` | number | Optional | Default lookback (default from `defaults.json`: 14). |

## Notion — private vault vs team hub

People engineering and orchestration skills should post to the correct **Notion parent** using config, not ad hoc URLs.

| Config block | Role |
|--------------|------|
| `notion_defaults.private_vault` | Canonical **private** management tree; `root_parent_page_key` usually `private_root`. |
| `notion_defaults.team_notion` | Canonical **team** tree; `root_parent_page_key` usually `team_hub`. |
| `notion_defaults.parent_pages` | Page ids for each logical folder (e.g. `private_transcripts`, `team_metrics`). |
| `notion_defaults.post_targets` | Maps artifact kinds (`transcript`, `sprint`, `standup`, …) to a `parent_pages` key. |
| `notion_defaults.template_pages` | Gallery template page ids for duplicate flows (1:1, standup, …). |
| `notion_defaults.database_ids` | Optional databases for projects, sprints, 1:1 logs, etc. |

After a setup wizard or manual creation, set **`setup_complete`** under `private_vault` / `team_notion` when ids are populated. Reference: [`skills/notion/references/notion-vault-and-routing.md`](../skills/notion/references/notion-vault-and-routing.md). Page shape for evals: [`skills/notion/references/notion-page-format-rules.md`](../skills/notion/references/notion-page-format-rules.md).

Merge order for skill runs: **CLI / `$ARGUMENTS`** → `skill_defaults` → `jstack.config.json` → prompt user if required keys missing.

## Org context (handbook, ethics, HR-safe docs, rubrics)

People-facing skills (self-eval, advice, coaching-style prep) should ground in **`org_context`**: local markdown under **`org_context.local.base_path`** + **`org_context.local.files`** (slice ids: **ethics**, **engineering_handbook**, **hr_public** for non-sensitive FAQs only, **coaching**, **self_review_rubric**, **critical_review_rubric**, **org_structure**), plus optional **Notion** / **Google Drive** maps and **`mcp_labels`**. The canonical IC/EM ladder is **`levels_and_expectations`**; include the token **`levels`** in **`skill_defaults.<skill>.org_context_slices`** to load it.

**Quick start:** copy templates from [`templates/config/org-context/`](../templates/config/org-context/README.md), set `base_path` and filenames in `jstack.config.json`, then tune **`skill_defaults`**.

Canonical reference: [`skills/_core/references/org-context.md`](../skills/_core/references/org-context.md).

## Team roster, 1:1 pages, and canonical group

Structured people data lives under **`team`**. Setup wizards should fill this when creating Notion trees and 1:1 sections.

| Key | Purpose |
|-----|---------|
| `team.members` | Array of people: stable **`id`**, nested **`metadata`** (name, role, level, title), **`github`**, **`email`**, **`jira`**, **`notion`** (1:1 parent id, optional template id, optional person hub id), **`slack`**, **`misc`**. See `skills/_core/references/config-schema.md` → team.members. |
| `team.canonical_group` | How to refer to the **whole team** in tools: **`mode`** (`none`, `manual_list`, `slack_user_group`, `google_group`) plus optional **`slack_user_group_id`**, **`slack_handle`**, **`google_group_email`**, **`display_name`**. |

1:1 **default** duplicate source: **`one_on_one_cycle.notion.default_template_page_key`** → `notion_defaults.template_pages`. Per-person overrides: **`team.members[].notion.template_page_id`** (nested under each member’s **`notion`** object).

Full discovery (Slack user group vs Google Group) and wizard contract: [`skills/team/references/team-canonical-identity.md`](../skills/team/references/team-canonical-identity.md).

## JSON payloads

Versioned schemas live under [`schemas/pe/`](../schemas/pe/). Skills should **validate** snapshots before rendering HTML or Notion.

## Setup

```bash
jstack setup --pe
```

Or set keys manually, then set `pe.configured: true`.

See also [`config-schema.md`](../skills/_core/references/config-schema.md) and [`integration-guide.md`](../skills/_core/references/integration-guide.md).

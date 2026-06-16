# Notion private vault + team hub — config routing

Use this when **creating**, **reconfiguring**, or **posting** to Notion so pages land in the right place and future skills resolve parents **without hardcoding**.

## Two surfaces

| Surface | Purpose | Typical `parent_pages` keys |
|--------|---------|-----------------------------|
| **Private vault** | Manager-only scratchpad, transcripts, personal project/sprint notes, private PE | `private_*` keys below |
| **Team Notion** | Shared team hub, people index, metrics, team notes, ceremonies | `team_*`, `team_hub` |

Skills and setup flows should read **`notion_defaults.private_vault`**, **`notion_defaults.team_notion`**, **`notion_defaults.parent_pages`**, **`notion_defaults.post_targets`**, and **`notion_defaults.database_ids`** together.

## `parent_pages` keys (convention)

All values are **Notion page IDs** (from URLs), never invented. Empty string means “not configured yet.”

**Shared / existing**

| Key | Use |
|-----|-----|
| `team_hub` | Default parent for team-visible standups, reports, broad team pages |
| `pe_index` | Private PE / performance index (org policy) |
| `one_on_ones` | 1:1 prep/after pages when not using `pe_index` |

**Private vault tree** (nested pages under `private_root` in Notion; config still uses flat keys for lookups)

| Key | Use |
|-----|-----|
| `private_root` | Top of the private management vault |
| `private_scratchpad` | Quick captures, inbox |
| `private_notes` | Working notes, decision log (private) |
| `private_data` | Links, embeds, raw tables |
| `private_transcripts` | Meeting transcripts, ingest targets, AI summaries bound to transcripts |
| `private_projects` | Private project pages or link to a **database** whose id is in `database_ids.projects_private` |
| `private_sprints` | Private sprint retros / planning scratch |

**Team hub tree**

| Key | Use |
|-----|-----|
| `team_people` | Roster / person hub pages |
| `team_metrics` | Team metrics pages or linked database |
| `team_notes` | Shared team working notes (not private) |

Add more keys only when a skill needs a stable name; document them here and in `config/defaults.json`.

## `post_targets` — dynamic posting

`notion_defaults.post_targets` maps an **artifact kind** to a **`parent_pages` key** (string). Skills resolve:

`parent_id = notion_defaults.parent_pages[notion_defaults.post_targets[<kind>]]`

If the key is missing or the resolved id is empty, **stop** and ask the user to run setup or paste a URL — do not invent ids.

Default artifact kinds (extend in config as needed):

| Kind | Default target key | Notes |
|------|-------------------|--------|
| `scratchpad` | `private_scratchpad` | |
| `transcript` | `private_transcripts` | Raw or imported transcript pages |
| `transcript_summary` | `private_transcripts` | AI summary tied to a transcript |
| `meeting_notes` | `private_notes` | Generic private notes |
| `project` | `private_projects` | Page or DB row parent |
| `sprint` | `private_sprints` | |
| `one_on_one_prep` | `one_on_ones` | Override with `one_on_one_cycle.notion` when applicable |
| `one_on_one_after` | `one_on_ones` | |
| `pe_note` | `pe_index` | |
| `standup` | `team_hub` | Team-visible |
| `team_report` | `team_hub` | |
| `team_metrics_snapshot` | `team_metrics` | |
| `team_wiki_note` | `team_notes` | |

Override per org by editing `jstack.config.json` only.

## `private_vault` and `team_notion` blocks

```json
"private_vault": {
  "root_parent_page_key": "private_root",
  "setup_complete": false
},
"team_notion": {
  "root_parent_page_key": "team_hub",
  "setup_complete": false
}
```

- **`root_parent_page_key`**: which `parent_pages` entry is the **canonical root** for that surface (for setup wizards and validation).
- **`setup_complete`**: set `true` after the user (or setup skill) has created the tree and filled ids — optional guard for doctor/validate.

## Templates and databases

- **Gallery / duplicate:** store golden page ids in `notion_defaults.template_pages` (`standup`, `team_report`, `performance`, `one_on_one`, …). See [notion-template-strategy.md](./notion-template-strategy.md).
- **Databases:** store ids in `notion_defaults.database_ids` (e.g. `projects`, `projects_private`, `sprints`, `one_on_one_log`). Keys are team-defined but must match what skills expect; document new keys here.

## Setup wizard contract

1. Ask intake questions (team name, private vs team roots, 1:1 pattern, DB vs pages).
2. User creates Notion pages (or API) and pastes URLs / ids.
3. Write **`notion_defaults.parent_pages`**, **`post_targets`** (if non-default), **`template_pages`**, **`database_ids`**, and set **`setup_complete`** flags.
4. Point **`pe.notion_parent_keys`** at any PE-related `parent_pages` keys for PE reports. See [PE_AND_TEAM_CONFIG.md](../../../docs/PE_AND_TEAM_CONFIG.md).
5. **Roster + 1:1 wiring:** For each person in scope, add an object to **`team.members`** with stable **`id`**, nested **`metadata`** (`name`, `role`, `level`, `title`), **`email`**, **`slack`**, **`github`**, **`jira`**, **`misc`** as needed. Set **`team.canonical_group.mode`** (and Slack / Google ids when applicable) per [team-canonical-identity.md](../../team/references/team-canonical-identity.md).
6. **Per-person Notion:** Create a subpage (or linked page) under **`parent_pages.one_on_ones`** for each direct report; duplicate from **`template_pages.one_on_one`** (or a per-person template). Paste ids into **`team.members[].notion.one_on_one_parent_page_id`** and optional **`template_page_id`**. Optionally add a **person hub** under **`team_people`** → **`person_hub_page_id`**.
7. Set **`one_on_one_cycle.notion.default_template_page_key`** (usually `one_on_one`) so skills know which `template_pages` key to use when **`template_page_id`** is empty.

## Related

- [notion-page-format-rules.md](./notion-page-format-rules.md) — formatting and eval checklist
- [notion-template-strategy.md](./notion-template-strategy.md)
- [team-canonical-identity.md](../../team/references/team-canonical-identity.md) — roster + Slack / Google group modes
- [integration-guide.md](../../_core/references/integration-guide.md)

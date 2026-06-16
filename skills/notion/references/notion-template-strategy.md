# Notion templates — gallery vs API vs jstack JSON

Use this when choosing how to create **standup**, **team report**, **performance**, or **1:1** pages.

**Where pages land:** configure **`notion_defaults.parent_pages`**, **`post_targets`**, **`private_vault`**, and **`team_notion`** per [notion-vault-and-routing.md](./notion-vault-and-routing.md). After setup, store template page ids here and database ids in **`database_ids`**.

## Pattern A — Duplicate from a template page (org “golden” page)

1. In Notion, create or pick a page from the **template gallery** (or your team’s master page).
2. Store its **`page_id`** in `jstack.config.json` under `notion_defaults.template_pages.<kind>` (e.g. `standup`, `team_report`, `performance`, `one_on_one`).
3. Use the Notion API **duplicate page** (or equivalent) when your integration version supports it; otherwise **one-time manual duplicate** and store the **parent page** or **database_id** for new rows in config.
4. After duplication, fill **properties** and **body** via MCP or manual steps per the matching skill.

## Pattern B — jstack `templates/notion/*.json`

Use when the API cannot mirror gallery layout or you want **version-controlled** property names and section lists. Skills map JSON to Notion blocks and database properties.

## Pattern C — Hybrid

Duplicate once for structure; automation only updates **properties** and **section content** on each run.

## Config keys (illustrative)

```json
{
  "notion_defaults": {
    "database_ids": {},
    "template_pages": {
      "standup": "",
      "team_report": "",
      "performance": "",
      "one_on_one": ""
    },
    "parent_pages": {
      "team_hub": "",
      "pe_index": ""
    }
  }
}
```

Never commit workspace secrets. IDs only; tokens live in the host environment.

## Official docs

Re-check **Notion API** release notes for `duplicate`, database templates, and `template` parameters — behavior changes over time.

## OpenAI `.curated` Notion skills (reference only)

Upstream prompts under [openai/skills `skills/.curated`](https://github.com/openai/skills/tree/main/skills/.curated) overlap jstack in places. Prefer **jstack** sub-skills and config; use curated folders as **optional** reading (license check before vendoring):

| Upstream folder | jstack home |
|-----------------|-------------|
| [`notion-knowledge-capture`](https://github.com/openai/skills/tree/main/skills/.curated/notion-knowledge-capture) | [`notion/setup`](../setup/SKILL.md), router [`SKILL.md`](../SKILL.md) |
| [`notion-meeting-intelligence`](https://github.com/openai/skills/tree/main/skills/.curated/notion-meeting-intelligence) | [`notion/standup`](../standup/SKILL.md), [`notion/one-on-one`](../one-on-one/SKILL.md), meetings skills |
| [`notion-research-documentation`](https://github.com/openai/skills/tree/main/skills/.curated/notion-research-documentation) | Router [`SKILL.md`](../SKILL.md) + [`reports`](../../reports/SKILL.md) |
| [`notion-spec-to-implementation`](https://github.com/openai/skills/tree/main/skills/.curated/notion-spec-to-implementation) | Intake / Jira / engineering skills |

Catalog row: [`SKILL_SOURCES.md`](../../../docs/SKILL_SOURCES.md) (OpenAI — `.curated` table).

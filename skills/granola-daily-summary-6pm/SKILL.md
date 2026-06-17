---
name: jstack-granola-daily-summary-6pm
description: "Scheduled variant of daily Granola/meeting summary (6pm cadence)."
category: workflows
gbrain_destination: team
data_class: internal
when_to_use: "Automated or scheduled daily summary workflow."
effort: low
disallowed-tools: AskUserQuestion
---

<!-- Chain Contract -->
<!-- end Chain Contract -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md
Run the **`jstack-granola-daily-summary`** skill for today.

Pass the user's configured Notion parent page via `--parent-page`. If the
env var `GRANOLA_NOTION_PARENT_PAGE_ID` is set, use it:
```
jstack-granola-daily-summary --parent-page $GRANOLA_NOTION_PARENT_PAGE_ID
```
If the env var is not set, the skill will prompt the user for their page ID.

It will:
1. Pull today's meetings from Granola (America/Los_Angeles date).
2. Generate a concise summary + action items / decisions for each meeting.
3. Create (or update if it already exists) a child page titled `Daily Summary — YYYY-MM-DD` under the user's Notion parent page.
4. Report back the Notion page URL and a one-line stat (N meetings · X action items · Y decisions).

Prerequisites:
- A **Granola** (or equivalent meeting) MCP server must be connected in the host config.
- A **Notion** MCP server must be authorized with access to the target page. If auth has expired, surface the error clearly so the user can re-auth via /mcp (or the host's MCP UI).
- The user must provide their Notion parent page ID (via `--parent-page` arg or `GRANOLA_NOTION_PARENT_PAGE_ID` env var).

Follow the skill exactly. Do not invent new behavior.

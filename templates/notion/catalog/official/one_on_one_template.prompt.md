# Prompt: generate a 1:1 cycle template page

You are filling in a Notion page that will be **duplicated** for each scheduled 1:1 between a manager and a direct report. It serves two phases: **Prep** (before the meeting) and **After** (after the meeting).

## Inputs available at expansion time

The `jstack-notion-setup` skill will substitute these placeholders before sending the content to `notion-create-pages`:

- `{{team_name}}` — from `team.name`
- `{{team_canonical_display_name}}` — from `team.canonical_group.display_name`
- `{{primary_member_id}}` — from `team.members[0].id` (typically the manager themselves)
- `{{cycle_cadence}}` — from `one_on_one_cycle.cadence` (e.g. "weekly", "biweekly")
- `{{prepare_suffix}}` — from `one_on_one_cycle.prepare_vs_after.prepare_title_suffix` (default `Prep`)
- `{{after_suffix}}` — from `one_on_one_cycle.prepare_vs_after.after_title_suffix` (default `After`)

## Generation instructions for the agent

Produce a single Notion-flavored Markdown page with these sections, in order, customized to the inputs above:

1. **Title placeholder line** — `# 1:1 — _{{Their Name}}_, _YYYY-MM-DD_`
2. **Frontmatter block** — bullets for: Date, Cadence ({{cycle_cadence}}), Manager ({{primary_member_id}}), Direct report (placeholder), Recording link.
3. **Prep section** ({{prepare_suffix}}) — collapsible toggle / heading with bullets covering: their wins since last 1:1, blockers/risks, decisions needed from manager, manager's items to raise, career-context reminders.
4. **Agenda** — numbered list, 3 items as placeholders.
5. **Discussion notes** — bullets, free-form.
6. **Decisions** — checkbox list with the convention `✅ <decision> — <owner>, <date>`.
7. **Action items** — todo list with the convention `[ ] <action> — @owner — due <date>`.
8. **{{after_suffix}} reflection (manager-only)** — a callout block with one short paragraph prompt: "What did I learn about how to support them better?"
9. **Followups / parking lot** — bullets.
10. **Footer** — italic line: `_Duplicated from `template_pages.one_on_one`. Cycle: {{cycle_cadence}}. Manager: {{primary_member_id}}._`

## Constraints

- Use Notion-flavored Markdown only (no HTML).
- Use H2 (`##`) for top-level sections except the page title (which is H1).
- Use bullet/checkbox/numbered conventions consistent with `skills/notion/references/notion-page-format-rules.md`.
- DO NOT include placeholder PII or invented names — leave `_<placeholder>_` italic spans where a name/date goes.
- DO NOT include the manager's pay, performance, or personal feedback content — those live in `pe_index`, not here.

## Why this is a `.prompt.md` and not a static `.md`

The structure depends on org config (cadence, suffixes) and the agent should be able to adapt phrasing for different org cultures (manual review tone vs collaborative tone). Static markdown couldn't pivot. If your org wants identical output every setup, swap this template's `content_kind` to `static` and replace this file with a `.md` of the rendered output.

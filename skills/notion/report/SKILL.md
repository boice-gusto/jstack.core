---
name: jstack-notion-report
description: Create a long-form report page or DB row in Notion. Set Status to Draft until user reviews.
category: notion
disable-model-invocation: true
effort: high
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Create a long-form report page or database row in Notion from the user's content, setting Status to Draft until the user reviews it.
- **Out of scope:** Marking the page Published without explicit user approval.

## Domain rules — notion-report

### Absolute rules

1. **Resolve the parent page or database strictly from config or a pasted URL.** Read
   `jstack.config.json`'s `notion` section for the target id; if none is configured and no URL was
   given, stop and ask — never guess an id that "looks right" or reuse "whatever was used last
   time" from memory.
2. **Read the target location before writing to it.** When writing into an existing database,
   fetch its schema/properties first; a write that assumes property names and types without
   checking can silently create malformed rows or fail partway through.
3. **Never overwrite an existing page without first fetching and diffing its current content.** An
   overwrite that skipped the read step can destroy content nobody asked to change, with no way to
   tell what was lost.
4. **Every created or updated report starts in Draft** (or the equivalent non-published status from
   config) — promoting to Published is a separate, explicit action the user takes, never something
   this skill does on its own.
5. **Report the resulting page URL in every summary.** Without it, the user can't verify the write
   landed in the right place or undo it if it didn't.
6. **Confirm scope before writing** — personal, team, or org-wide database — when the request or
   config implies a narrower scope than the resolved target actually is, stop and confirm rather
   than writing to the broader one.
7. **A missing required id is a stop condition, not a fallback trigger.** Falling back to "the most
   recently used page" when the real target is unknown is exactly the kind of silent guess this
   skill exists to avoid.

### Thresholds

| Signal | Threshold | Basis |
|---|---|---|
| Parent/database resolution | 100% from config or an explicit pasted URL — 0% guessed | Guessed ids write to the wrong place undetected |
| Pre-write read | 100% of updates preceded by a fetch of current content | Skipping the read makes an overwrite irreversible and unaudited |
| Initial status on create | Draft (or config's non-published equivalent) on 100% of new pages | Publishing is the user's decision, not this skill's default |
| Missing id | Stop-and-ask on 100% of occurrences — 0% invented | An invented id is indistinguishable from a correct one until it's too late |

### Named anti-patterns

| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Guessing a database id from memory | Writes land in the wrong destination with no error thrown | Require an explicit id from config or the current request |
| Overwriting without reading first | Destroys existing content invisibly, with no diff to recover from | Fetch and diff before every write to an existing page |
| Publishing a new report immediately | Removes the user's review step entirely | Default every create to Draft; let the user promote explicitly |
| Writing to a shared/org-wide database when personal scope was implied | Report ends up more visible than intended | Confirm scope explicitly before writing when it's ambiguous |

### Worked example

- *Weak:* "Created the report in Notion."
- *Sharp:* "Target resolved from `jstack.config.json` → `notion.report_database_id`. Read the
  database schema first: Title, Status, Owner, Date properties match this report's fields. Fetched
  the target location before writing — nothing existed there yet (new row, not an overwrite).
  Created with Status = Draft. Page: `<url>`. Promote to Published manually when ready."

### What this skill must not do

- Does not decide when to promote Draft to Published — that stays the user's call.
- Does not manage workspace membership, permissions, or public-web sharing settings.
- Does not choose between report/ADR/team-note sub-skills — that routing happens at the Notion
  orchestrator, one level up.

## Config and references
- `jstack.config.json` — team ids, integrations, `skill_defaults`, `jira_rules`, `notion`, `gbrain`. Never hardcode.
- Questions (open-ended, one at a time): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/question-patterns.md`
- Discrete choices (when the host supports AskUserQuestion or equivalent): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/ask-user-question-patterns.md`
- Integrations: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/integration-guide.md`
- Chaining: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/chaining-guide.md`

## Intake
1. Parse `$ARGUMENTS` — note whether the user **pasted** data or is asking you to **query** a system.
2. If a required id is missing, ask **one** focused question; otherwise use config defaults (label assumptions as `[assumption]`).
3. If the request bundles multiple unrelated goals, handle the first and offer to continue.

## Procedure
### Step 1 — Load config
Read relevant keys from `jstack.config.json`. If the integration is missing or unhealthy, say so and point to `jstack setup` / `jstack doctor` instead of faking data.

### Step 2 — Plan the safe path
Resolve the parent page or database from `notion_defaults` — never guess an id. Read a page before overwriting its body. Create as a draft and let the user promote it; do not publish on their behalf. If the target is unset in config, say so instead of writing somewhere plausible.

### Step 3 — Execute
Long-form report or DB row. Set Status to Draft until user reviews.
- For exports to PDF/HTML, that is out of scope — suggest manual export.

### Step 4 — Validate
Re-fetch the page and confirm the target parent, the title, and the properties you set. Verify you did not overwrite pre-existing content, and that it is still a draft unless the user asked to publish.

### Step 5 — Summarize and hand off
State what changed, what to verify, and suggest **one** next jstack skill if the work naturally continues.

## Output shape
Use a domain-appropriate heading, then:
- **Summary** (2–4 sentences)
- **Details** (bullets, table, or structured fields)
- **Next steps** with owner + timeline if known
- **Limitations** (partial data, no write access, etc.)
- For eval-gated skills, end with `result_ok: true` or `result_ok: false` + reason

## Failure modes

| Symptom | Recovery |
|---------|----------|
| Missing config / integration | Point to `jstack setup` or `jstack doctor`; do not continue with invented ids. |
| Auth / 403 / expired token | Stop; tell user to refresh credentials. Never print secrets. |
| Ambiguous goal | One clarifying question; if still unclear, present options A/B. |
| Database not found | Confirm `database_id` in config or ask for a pasted Notion URL. |
| Property type mismatch | Show expected vs actual type; suggest manual Notion fix or config update. |

## Chaining
Complete the work here. If a natural follow-up exists (e.g. `jstack-notion-planning` then `jstack-notion-sprint`), add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

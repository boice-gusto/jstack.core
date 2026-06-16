---
name: jstack-notion-article
description: Create a Notion article (blog/eng journal) with title, audience tag, and Draft status until approved.
category: notion
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Create an article page (blog, eng journal) with audience tag and Draft status. Do not mark Published without user approval.
- **Out of scope:** Multi-page content or CMS publishing pipelines.

## Domain rules — Notion
- Use `templates/notion/*.json` and property maps from team conventions. Never invent a `database_id` — require config or pasted URL.
- ADR vs report vs team-note differ; pick the sub-skill that matches. Keep parent/child page relationships explicit.
- Return **Notion page URL** in the summary for every create/update.
- No workspace-wide member or public-web changes without a dedicated sub-step the user approves.

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
Prefer read-only first, then idempotent updates, then irreversible changes — each gated by org norms.

### Step 3 — Execute
Article (blog/eng journal): title, summary, audience (internal|external) at top.
- Do not mark Published without user go-ahead.

### Step 4 — Validate
Correct surface, no stray side effects, tone matches `prompts/tones/` if publishing text.

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
Complete the work here. If a natural follow-up exists (e.g. `jstack:jira-intake` then `jstack:jira-create`), add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

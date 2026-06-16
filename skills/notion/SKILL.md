---
name: jstack-notion
description: Route Notion requests to the right sub-skill (adr, article, sprint, report, etc.). Ask one question if ambiguous.
category: notion
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Route Notion requests to the most specific sub-skill. Do not write pages directly from the orchestrator.
- **Out of scope:** Workspace membership, public sharing, or export settings.

## Domain rules — Notion
- Use `templates/notion/*.json` and property maps from team conventions. Never invent a `database_id` — require config or pasted URL.
- Resolve parents via **`notion_defaults.post_targets`** and **`notion_defaults.parent_pages`** (private vault vs team hub). See `skills/notion/references/notion-vault-and-routing.md`.
- Apply body/property conventions in `skills/notion/references/notion-page-format-rules.md` so evals and templates stay aligned.
- ADR vs report vs team-note differ; pick the sub-skill that matches. Keep parent/child page relationships explicit.
- Return **Notion page URL** in the summary for every create/update.
- No workspace-wide member or public-web changes without a dedicated sub-step the user approves.

## Sub-skills (pick the most specific)
**Under `skills/notion/`:** update, planning, sprint, project, report, adr, article, knowledge-base, team-note

If the user is vague, ask **one** question to disambiguate, then route to the child skill. Do not execute every sub-skill in one turn unless the user asked for a chain.

## Config and references
- `jstack.config.json` — team ids, integrations, `skill_defaults`, `jira_rules`, `notion`, `gbrain`. Never hardcode.
- Notion template patterns (gallery vs JSON vs hybrid): `${CLAUDE_PLUGIN_ROOT}/skills/notion/references/notion-template-strategy.md` (includes **OpenAI `.curated` notion-*** cross-links).
- Private vault + team routing + `post_targets`: `${CLAUDE_PLUGIN_ROOT}/skills/notion/references/notion-vault-and-routing.md`
- Page format / eval checklist: `${CLAUDE_PLUGIN_ROOT}/skills/notion/references/notion-page-format-rules.md`
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
Route to the most specific child skill under `skills/notion/`. If the user's intent is clear, emit `suggested_next: <child-skill>` and stop. If ambiguous, ask one question to disambiguate before routing.

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
This is a **domain orchestrator** — route to the most specific child skill. Do not inline every sub-flow. If the user's task maps to one child, say `suggested_next: <child-skill>` and stop.

## User request

$ARGUMENTS

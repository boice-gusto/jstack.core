---
name: jstack-jira
description: Route Jira requests to the right sub-skill (get, create, update, intake, transition, notify, append). Ask one question if ambiguous.
when_to_use: Also when the user mentions tickets, issues, JQL, triage, filing bugs, sprint backlog, status transitions, or commenting on an issue.
category: jira
effort: low
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Route the user's Jira request to the most specific sub-skill. Do not execute Jira operations directly from the orchestrator — each op has its own guardrails.
- **Out of scope:** Create/delete Jira projects, bulk org reassignment, or production writes without confirmation.

## Domain rules — Jira
- All Jira work respects `jira_rules` in config and `templates/jira/*.json`. Project key, issue type, and transitions come from **config or user** — never from memory.
- This is a router — it doesn't read or write Jira itself. `get` is read-only; `create`, `update`, `append`, `transition`, `notify` are writes. See the chosen sub-skill's own Domain rules for its specific read/write and confirmation behavior.

## Sub-skills (pick the most specific)
**Under `skills/jira/`:** get, create, update, intake, transition, notify, append

If the user is vague, ask **one** question to disambiguate, then route to the child skill. Do not execute every sub-skill in one turn unless the user asked for a chain.

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
Search before you create — a duplicate ticket is worse than a missing one. Read the issue's current status and its legal transitions before transitioning; do not assume a workflow. Never invent an issue key, field value, or transition id — fetch metadata or ask. For any bulk change, show the count, the field diff, and a sample of affected keys, then wait for confirmation.

### Step 3 — Execute
Route to the most specific child skill under `skills/jira/`. If the user's intent is clear, emit `suggested_next: <child-skill>` and stop. If ambiguous, ask one question to disambiguate before routing.

### Step 4 — Validate
Re-read the issue after writing: the status, the fields you set, and the links you added are what you intended, and nothing else changed. Confirm you created exactly one ticket, not a duplicate.

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
| Jira API rate limit / 429 | Back off; suggest narrowing JQL or retrying in 60s. |
| Issue not found (404) | Confirm key and project; suggest `jstack-jira-get` with filter. |
| Required field missing for transition | Collect the field before retrying the transition. |

## Chaining
This is a **domain orchestrator** — route to the most specific child skill. Do not inline every sub-flow. If the user's task maps to one child, say `suggested_next: <child-skill>` and stop.

## User request

$ARGUMENTS

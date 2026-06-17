---
name: jstack-jira-update
description: Update fields or add comments on an existing Jira issue. Confirm before sensitive field changes.
category: jira
disable-model-invocation: true
arguments: [ticket_id]
argument-hint: [PROJ-123]
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Update fields or post comments on an existing issue. Confirm before changing sensitive fields (security level, customer).
- **Out of scope:** Transitions (use `jira/transition`), creating new issues, or bulk edits.

## Domain rules — Jira
- All Jira work respects `jira_rules` in config and `templates/jira/*.json`. Project key, issue type, and transitions come from **config or user** — never from memory.
- `get` is read-only. `create`, `update`, `append`, `transition`, `notify` are writes — confirm when the org requires approval, batch when possible, return Jira **key + URL** in every summary.
- Dup-check before create: suggest search on `jstack-jira-get` if the summary matches a likely existing issue.
- MCP / API errors: one-line user-facing message + whether it is retryable. Keep raw JSON out of chat.

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
Support field-level changes. For sensitive fields (security level, customer), confirm once if policy requires.
- **Comments:** respect internal vs public visibility per project settings. State assumption if unknown.
- Output: summarize what changed in plain English for the user to paste to Slack.

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
| Jira API rate limit / 429 | Back off; suggest narrowing JQL or retrying in 60s. |
| Issue not found (404) | Confirm key and project; suggest `jstack-jira-get` with filter. |
| Required field missing for transition | Collect the field before retrying the transition. |

## Chaining
Complete the work here. If a natural follow-up exists (e.g. `jstack:jira-intake` then `jstack:jira-create`), add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

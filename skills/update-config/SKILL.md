---
name: jstack-update-config
description: Edit jstack.config.json with validation against config/schema.json. Show diff and rollback one-liner. Not for first-time setup — use jstack:onboarding.
when_to_use: Not for a brand-new project with no config yet — that is jstack:onboarding's job.
category: setup
disable-model-invocation: true
effort: low
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Edit `jstack.config.json` with schema validation, diff output, and a rollback one-liner.
- **Out of scope:** Writing secrets into config — redirect to env/secret store.

## Domain rules — config editing
- Validate edits against `config/schema.json` when schema is available.
- **Team + personal:** editing `jstack.config.json` usually affects **shared** keys; personal GBrain and identity belong in `jstack.personal.json` (see `config/personal.example.json` and `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/config-team-vs-personal.md`).
- Show diff: what changed, why, and a rollback one-liner.
- Never write secrets into config — if the user tries, redirect to env/secret store.

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
Show a diff of the exact keys changing, and get confirmation before writing. Validate the result before saving. Never write a secret, and never silently widen a scope the user did not ask to widen.

### Step 3 — Execute
Edits to `jstack.config.json` (and, if the user asks, `jstack.personal.json` path): validate against `config/schema.json` when possible.
- If the user is only setting `gbrain.personal` or personal `provenance`, prefer the personal file so the team repo stays shareable.
- Diff-style output: what changed, why, and rollback one-liner.

### Step 4 — Validate
Re-read the config and confirm only the intended keys changed and the file still parses. Confirm no secret was written.

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
| User pastes token in chat | Tell them to move to env/secret store and rotate. Never log it. |

## Chaining
Complete the work here. If a natural follow-up exists, add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

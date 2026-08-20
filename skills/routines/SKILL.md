---
name: jstack-routines
description: Route to the right routine sub-skill (standup, weekly-digest, sprint-close, health-check, custom, morning-kickoff).
category: routines
effort: low
disallowed-tools: AskUserQuestion
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Route to the right routine sub-skill (standup, weekly-digest, sprint-close, health-check, morning-kickoff, custom). Resolve the routine id against `config/defaults.json` `routines` and `config/schedules/<id>.json` before running; if the two disagree, say so.
- **Out of scope:** Creating or editing a routine definition (`jstack:workflow-builder`), and firing integrations for a routine whose `enabled` is false.

## Domain rules — routines
- Scheduled skill chains from `config/schedules/` and the routines block in config. Use `jstack schedule` CLI.
- Idempotent: a failed mid-way routine must be re-runnable; record what already completed.
- Output is often a Slack block — keep under channel norms (length, @here rules).

## Sub-skills (pick the most specific)
**Under `skills/routines/`:** standup, weekly-digest, sprint-close, health-check, custom, morning-kickoff

This router and every child under `skills/routines/` carry `disallowed-tools: AskUserQuestion` — routines run unattended (cron/schedule invocations) as well as interactively, so blocking on a question is not always possible. If the user's intent is vague in an interactive turn, ask **one** question to disambiguate. If there is no user to ask (a scheduled/unattended run), resolve the routine id against `config/defaults.json` `routines` and the most recently configured/enabled child, state the pick as `[assumption]`, and route rather than stalling the run. Do not execute every sub-skill in one turn unless the user asked for a chain.

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
This runs unattended: never block on an interactive prompt. Every step must be idempotent, because a retry or an overlapping run will happen. Report a partial failure as a partial failure — a scheduled job that fails silently goes unnoticed for weeks.

### Step 3 — Execute
Route to the most specific child skill under `skills/routines/`. If the user's intent is clear, emit `suggested_next: <child-skill>` and stop. If ambiguous and a user is present to ask, ask one question to disambiguate before routing. If this is an unattended/scheduled invocation with no user to ask, resolve against config (`routines` block in `config/defaults.json` plus `config/schedules/<id>.json`), state the resolved routine as `[assumption]`, and route — never block a cron run waiting on input.

### Step 4 — Validate
Confirm the run completed without needing interactive input, that a re-run would be safe, and that any partial failure is reported as such with the failing step named.

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
| Schedule JSON invalid | Return the validation error and a minimal valid example. |
| Routine failed mid-way | Report which steps succeeded and which failed; suggest re-run. |

## Chaining
This is a **domain orchestrator** — route to the most specific child skill. Do not inline every sub-flow. If the user's task maps to one child, say `suggested_next: <child-skill>` and stop.

## User request

$ARGUMENTS

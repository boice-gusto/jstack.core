---
name: jstack-custom
description: Execute a custom routine from its config/schedules/<id>.json definition plus the routines block in config/defaults.json. If schedule JSON is invalid, return a fix, not a fake result.
category: routines
disable-model-invocation: true
disallowed-tools: AskUserQuestion
effort: low
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Execute a custom routine from its `config/schedules/<id>.json` definition, resolving every step to a real skill before starting.
- **Out of scope:** Inventing a step the definition does not contain, and returning a plausible result when the definition is invalid — return the fix instead.

## Domain rules — routines
- Scheduled skill chains from `config/schedules/` and the routines block in config. Use `jstack schedule` CLI.
- Idempotent: a failed mid-way routine must be re-runnable; record what already completed.
- Output is often a Slack block — keep under channel norms (length, @here rules).

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
Resolve the routine id against the `routines` block in `config/defaults.json` and its matching `config/schedules/<id>.json` definition — that JSON file, not a `config/routines` directory (it does not exist). If the two disagree (e.g. enabled in one but not the other) or the schedule JSON is invalid, return the discrepancy or validation error and a minimal valid example — never a fake result.

`jstack schedule` now has a full CLI surface for this, not just `list`/`enable`/`disable`:
- `jstack schedule setup [id]` — wizard: prefill a well-known routine's cadence/enabled state, or create a brand-new custom routine (id, cadence, chain of skill slugs — each validated against `skill-catalog.json`).
- `jstack schedule config [id]` — view a routine's full config, or edit `--set-cron`/`--set-chain` non-interactively.
- `jstack schedule start <id>` / `stop <id>` — primary verbs for `enable`/`disable` (kept as aliases).
- `jstack schedule run <id>` — the actual executor: shells out to an unattended `claude -p` turn that works through the routine's chain, records a run-history entry (`.jstack/schedule-history/<id>.json`, last ~20 runs), and reports only the process exit outcome — never a semantic "the routine succeeded". Supports `--dry-run`.
- `jstack schedule report [id]` — honest status: next scheduled fire (computed from the cron, not a claim that anything is actually running) and, only if `jstack schedule run` has ever been invoked for this routine, the last-run outcome. If it has never been run this way, `report` says so plainly rather than implying background execution.

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
Complete the work here. If a natural follow-up exists (e.g. `jstack-standup` then `jstack-meetings-post-slack`), add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

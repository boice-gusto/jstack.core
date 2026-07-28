---
name: jstack-workflow-viewer
description: Diff two workflow runs: timing, flakiness, visual diff summary. Do not assert pixel equality as pass/fail.
category: workflows
argument-hint: [run-id-1] [run-id-2]
effort: medium
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Summarize what a recorded run actually did: steps taken, assertions met, and the artifacts produced.
- **Out of scope:** Re-running the workflow or editing the definition. Never report a pass for an assertion with no supporting artifact.

## Domain rules — browser workflows
- Build, record, run, and view `jstack workflow` CRUD. Preview/diff before production mutate.
- Secrets: form fills must use env; never print passwords in workflow YAML or chat.
- Same flow definition for CI and local — call out which base URL the user is targeting.

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
Preview before any destructive UI action and require confirmation. Wait on observable state, never on a fixed delay. Capture an artifact (screenshot, trace, or log) as evidence; without one, do not claim the run passed.

### Step 3 — Execute
Diff two runs: timing, flakiness, visual diff summary when artifacts exist.
- Do not assert pixel equality as pass/fail if threshold-based.

### Step 4 — Validate
Confirm an artifact exists for every claimed assertion. Without the artifact, downgrade the result to unverified rather than reporting a pass.

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
| Browser driver not available | Document requirements; do not block on GUI if headless was requested. |
| Assertion failure | Abort with screenshot ref and suggest selector fix. |

## Chaining
Complete the work here. If a natural follow-up exists (e.g. `jstack-workflows-builder` then `jstack-workflow-runner`), add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

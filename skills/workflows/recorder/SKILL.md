---
name: jstack-workflow-recorder
description: Record user browser actions into a workflow definition. Scrub captured secrets before saving and add stability notes for generated selectors before promoting to CI.
category: workflows
disable-model-invocation: true
effort: medium
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Capture a live interaction as a replayable workflow definition, naming each step by role or label rather than a brittle selector.
- **Out of scope:** Executing the recording, and hand-tuning it afterwards (`jstack:workflows-builder`). Never record against production data or capture a credential-entry step.

## Domain rules — browser workflows
- Build, record, run, and view `jstack workflow` CRUD. Preview/diff before production mutate.
- Secrets: `fill` values that are secrets name an env var; never write a credential into the JSON definition or print one in chat.
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
A recording captures whatever was on screen: tokens, session cookies, customer names in test data. Scrub before saving, not at review time. Flag auto-generated selectors as brittle instead of promoting the recording straight to CI.

### Step 3 — Execute
Record user actions → definition. Scrub captured secrets before saving, add stability notes for generated-looking selectors, and mark the result unvalidated — a recording proves the steps happened once, not that they replay.

### Step 4 — Validate
Confirm no secret survived into the saved definition and that every selector is either stable or explicitly flagged. State that the recording is unvalidated until it replays.

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
| Step fails or a `wait` selector never appears | Abort at that step, name it, and suggest the selector fix — do not continue and report the later steps as passing. |
| Runner is the stub (`runWorkflowStub`) | It returns `ok: true` with no artifact by design. Report `unverified` and say a real driver is not wired; never present it as a pass. |
| Definition rejected by `WorkflowDefinitionSchema` | Name the offending field — usually a `kind` outside the six allowed values, or an invented `assertions` block — and fix the definition, not the schema. |

## Chaining
Complete the work here. If a natural follow-up exists (e.g. `jstack-workflows-builder` then `jstack-workflow-execute`), add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

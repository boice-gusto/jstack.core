---
name: jstack-workflow-runner
description: Execute a saved workflow with jstack workflow run and report each step's outcome against captured evidence. The shipped executor is a stub, so outcomes are unverified rather than passing.
category: workflows
argument-hint: "[workflow-name]"
disable-model-invocation: true
effort: low
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Drive a recorded flow and report each step's outcome with its captured evidence. The shipped executor is `runWorkflowStub`, so the honest outcome is `unverified`, not a pass.
- **Out of scope:** Authoring or recording the flow, and reporting a pass the runner did not actually produce.

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
Preview before any destructive UI action and require confirmation. Wait on observable state, never on a fixed delay. Capture an artifact (screenshot, trace, or log) as evidence; without one, do not claim the run passed — and the shipped runner is a stub that produces none, so `unverified` is the honest ceiling until a real driver is wired.

### Step 3 — Execute
Run with `jstack workflow run`. The shipped executor is `runWorkflowStub`, which returns `ok: true` with one log line and produces no screenshot and no report file — so report the outcome as `unverified` and never as a pass until a real driver is wired.

### Step 4 — Validate
Confirm an artifact exists for every claimed step outcome. Without one, downgrade the result to unverified rather than reporting a pass.

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
Complete the work here. If a natural follow-up exists (e.g. `jstack-workflows-builder` then `jstack-workflow-runner`), add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

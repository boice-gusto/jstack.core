---
name: jstack-workflows
description: Route workflow requests to builder, runner, recorder, or viewer.
when_to_use: Also for Playwright-style flows, browser automation JSON definitions under `config/workflows/`, recording steps, running jstack workflow, or comparing two runs.
category: workflows
effort: low
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Route a browser-workflow request to the right sub-skill (builder, recorder, runner, viewer, execute, workflow-wizard). Authoring a definition and running one are separate sub-skills — do not run as a side effect of building.
- **Out of scope:** Production mutations without an explicit preview-then-confirm, and storing credentials in a workflow definition — form fills read from env.

## Domain rules — browser workflows
- Build, record, run, and view `jstack workflow` CRUD. Preview/diff before production mutate.
- Secrets: `fill` values that are secrets name an env var; never write a credential into the JSON definition or print one in chat.
- Same flow definition for CI and local — call out which base URL the user is targeting.

## Sub-skills (pick the most specific)
**Under `skills/workflows/`:** builder, runner, recorder, viewer, execute, workflow-wizard

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
Preview before any destructive UI action and require confirmation. Wait on observable state, never on a fixed delay. Capture an artifact (screenshot, trace, or log) as evidence; without one, do not claim the run passed — and the shipped runner is a stub that produces none, so `unverified` is the honest ceiling until a real driver is wired.

### Step 3 — Execute
Route to the most specific child skill under `skills/workflows/`. If the user's intent is clear, emit `suggested_next: <child-skill>` and stop. If ambiguous, ask one question to disambiguate before routing.

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
This is a **domain orchestrator** — route to the most specific child skill. Do not inline every sub-flow. If the user's task maps to one child, say `suggested_next: <child-skill>` and stop.

## User request

$ARGUMENTS

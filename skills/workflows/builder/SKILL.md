---
name: jstack-workflows-builder
description: "Build a BROWSER workflow definition as JSON at `config/workflows/<id>.json`: start URL and ordered steps drawn from the six kinds the schema allows (goto, click, fill, wait, screenshot, ai). No credentials in the file. Not for skill-chain, routine, or policy design — that is `jstack-workflow-builder` (singular), a different skill one letter away."
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
Author a browser workflow definition — start URL and ordered steps — as JSON at `config/workflows/<id>.json`, so it can be executed unattended via `jstack:workflow-execute`. The schema has no assertion kind, so a check is a `wait` on a selector that only appears in the desired state.
- **Out of scope:** Running the workflow (`jstack:workflows-execute`) and recording one from live interaction (`jstack:workflows-recorder`). Never place a credential in the definition file.

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

Before writing any definition, run the design interview:

!cat ${CLAUDE_PLUGIN_ROOT}/skills/_core/references/workflow-design-interview.md

For a browser definition specifically, the questions config cannot answer are: what starts the flow, what observable on-page state means it succeeded (that state becomes a `wait` selector, since the schema has no assertion kind), which fills read from env, and what this flow must explicitly not touch. Post the understanding lock before drafting, not after.

## Procedure
### Step 1 — Load config
Read relevant keys from `jstack.config.json`. If the integration is missing or unhealthy, say so and point to `jstack setup` / `jstack doctor` instead of faking data.

### Step 2 — Plan the safe path
Nothing executes here, so the safety question is what this file will do when someone else runs it unattended months from now. Every `click` and `fill` needs a preceding `wait` on its own selector — a step that races the page is the defect that only ever reproduces in CI. Secrets are env references, never literals, because this file gets committed.

### Step 3 — Execute
Write a JSON definition to `config/workflows/<id>.json` matching `WorkflowDefinitionSchema` (`cli/src/types/workflow.ts`): `id`, `name`, `start_url`, `steps[]`, where each step is `{id, kind, selector?, value?, url?, notes?}`.
- `kind` is one of `goto`, `click`, `fill`, `wait`, `screenshot`, `ai`. There is **no assertion kind** — express a check as a `wait` on a selector that only exists in the desired state, plus a `screenshot` for evidence.
- No credentials in the file: a `fill` whose value is a secret is written as `env:VAR_NAME`, never a literal — the executor resolves it from the environment at run time.

### Step 4 — Validate
Confirm the definition parses against `WorkflowDefinitionSchema`, that every `kind` is one of the six the schema accepts, that every `click`/`fill` is preceded by a `wait`, and that no value is a credential literal. Do not claim the flow works — nothing was run.

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
| Browser driver not available | The spawned agent has no browser-automation tool configured (e.g. no Playwright MCP); it must say so and stop, not fabricate a run. |
| Step fails or a `wait` selector never appears | Abort at that step, name it, and suggest the selector fix — do not continue and report the later steps as passing. |
| `jstack workflow run` reports `ok: false` | Read the log for which step the agent stopped on; treat it as a real failure, not a stub artifact. |
| Definition rejected by `WorkflowDefinitionSchema` | Name the offending field — usually a `kind` outside the six allowed values, or an invented `assertions` block — and fix the definition, not the schema. |

## Chaining
Complete the work here. If a natural follow-up exists (e.g. `jstack-workflows-builder` then `jstack-workflow-execute`), add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

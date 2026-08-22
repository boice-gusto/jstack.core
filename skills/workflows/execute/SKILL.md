---
name: jstack-workflow-execute
description: "Run a saved workflow via CLI: preview, then execute with --yes through a spawned agent driving a browser-automation tool (e.g. Playwright MCP)."
when_to_use: After a workflow exists in config/workflows; user wants to run it from the agent or confirm CLI behavior.
category: workflows
argument-hint: "[workflow-name]"
data_class: internal
disable-model-invocation: true
effort: low
gbrain_destination: inherit
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Run a saved `config/workflows/*.json` flow through the `jstack workflow` CLI: preview, confirm, then execute, capturing an artifact per step.
- **Out of scope:** Editing the flow definition, and claiming a browser ran when the agent had no browser-automation tool available.

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
Preview before any destructive UI action and require confirmation. Wait on observable state, never on a fixed delay. Capture an artifact (screenshot, trace, or log) as evidence; without one, report `unverified` rather than a pass. `jstack workflow run` drives a real browser through a spawned agent's browser-automation tool (e.g. Playwright MCP) — if the host has none configured, the agent must say so and stop rather than fabricate a result.

### Step 3 — Execute
Load the saved `config/workflows/<id>.json`, print the step list as a preview, get explicit confirmation, then run it via `jstack workflow run <id> --yes`, which spawns an agent to drive the steps through whatever browser-automation tool it has (e.g. Playwright MCP). Report the real `ok`/log the command returns; if no browser-automation tool is configured, that's what the agent will say, so report `unverified` and name the missing driver rather than claiming the browser ran.

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
| Browser driver not available | The spawned agent has no browser-automation tool configured (e.g. no Playwright MCP); it must say so and stop, not fabricate a run. |
| Step fails or a `wait` selector never appears | Abort at that step, name it, and suggest the selector fix — do not continue and report the later steps as passing. |
| `jstack workflow run` reports `ok: false` | Read the log for which step the agent stopped on; treat it as a real failure, not a stub artifact. |
| Definition rejected by `WorkflowDefinitionSchema` | Name the offending field — usually a `kind` outside the six allowed values, or an invented `assertions` block — and fix the definition, not the schema. |

## Chaining
Complete the work here. If a natural follow-up exists (e.g. `jstack-workflows-builder` then `jstack-workflow-execute`), add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

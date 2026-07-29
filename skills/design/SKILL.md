---
name: jstack-design
description: "Route a design request to the right sub-skill: Figma handoff (design-to-implementation contract) or a self-contained single-page HTML artifact. Not for writing component code."
category: design
effort: low
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Route a design request to the right sub-skill: `figma-handoff` for a design-to-implementation contract (tokens, variants, state coverage, accessibility), or `visual-single-page-html` for a self-contained artifact a reader opens directly.
- **Out of scope:** Writing the component code, and editing the Figma file itself.

## Sub-skills (pick the most specific)
**Under `skills/design/`:** figma-handoff, visual-single-page-html

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
Read current state before changing it. Prefer the reversible action; when an action is irreversible, show what will change and get explicit confirmation first. If a required id or path is missing from config, stop and ask — never substitute a guess.

### Step 3 — Execute
Route to the most specific child skill under `skills/design/`. If the user's intent is clear, emit `suggested_next: <child-skill>` and stop. If ambiguous, ask one question to disambiguate before routing.

### Step 4 — Validate
Before reporting done: confirm the change landed where intended, that nothing outside the stated scope was touched, and that every id, path, and figure you emitted came from config or the conversation rather than from inference. Name anything you could not verify.

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

## Chaining
This is a **domain orchestrator** — route to the most specific child skill. Do not inline every sub-flow. If the user's task maps to one child, say `suggested_next: <child-skill>` and stop.

## User request

$ARGUMENTS

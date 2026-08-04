---
name: jstack-figma-handoff
description: Load jstack Figma workflow guidance before design-to-code or MCP Figma work; chain to figma-use when the host provides it.
category: design
data_class: internal
effort: low
gbrain_destination: none
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Turn a Figma design into an implementable handoff: named components and variants, token references, state coverage, and the accessibility contract each state must meet.
- **Out of scope:** Writing the component code (`jstack:review-code-review` for the diff, frontend-specialist for implementation), and editing the Figma file itself.

## Domain rules — design
- Two very different outputs live here. `figma-handoff` produces an implementation CONTRACT (named components and variants, token references, state coverage, the accessibility criterion each state must meet). `visual-single-page-html` produces a self-contained ARTIFACT a reader opens directly. Pick by deliverable, not by topic.
- Never claim pixel parity without a screenshot reference; say `[no screenshot available]` rather than asserting visual accuracy from a description.
- Accessibility is a named criterion, not an adjective — cite the WCAG rule and the measured value (`#999 on #fff is 2.85:1`), never "contrast looks low".
- A single-page artifact pins its CDN scripts with SRI and embeds no real customer or employee data. Use synthetic values in examples.

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
Walk the Figma frame component by component: name each component and its variants, map its fill/typography/spacing values to token names (flag anything off-token as an override rather than silently absorbing it), and enumerate the interaction states it must support (default, hover, focus, disabled, error, etc.). For each state, cite the specific accessibility criterion it must meet — the WCAG rule plus the measured value where a screenshot exists (e.g. `#999 on #fff is 2.85:1`) — and write `[no screenshot available]` rather than asserting pixel parity from the description alone.

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
Complete the work here. If a natural follow-up exists, add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

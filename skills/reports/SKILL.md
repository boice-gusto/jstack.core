---
name: jstack-reports
description: Route report requests to the right sub-skill (team, engineer, manager, project, self, eval).
category: reports
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Route report requests to the right sub-skill (team, engineer, manager, project, self, eval).

## Domain rules — reports
- Fill `templates/reports/*` with data from config, tools, and user-supplied facts only — never invent velocity, incidents, or goals.
- Match tone from `prompts/tones/` and audience from `prompts/personas/`.
- For rollups, strip IC names when policy requires. Eval reports are sensitive — growth framing, not performance-review legal claims.

## Sub-skills (pick the most specific)
**Under `skills/reports/`:** team-report, engineer-report, manager-report, project-report, self-report, eval-report, share-html-publish (hosted HTML via MCP / JSON-RPC), report-design (semantic colors, type, radius → CSS variables for static shells)

**Design / interactive HTML (`skills/design/`):** **visual-single-page-html** — one-file React + CDN stack (Tailwind tokens, Chart.js + D3 hooks, selectable shadcn-compatible themes, design-theory-aligned IA incl. disciplined report outlines + Markdown typography). Use before hand-writing bespoke SPA shells outside `jstack report render`.

- **Local HTML preview:** `jstack report render --data <payload.json> --out <report.html>` merges JSON into `templates/reports/shells/default.html` (Tailwind CDN + branding). See **`report-design`** and `_core/references/html-spa-design.md`.

If the user is vague, ask **one** question to disambiguate, then route to the child skill. Do not execute every sub-skill in one turn unless the user asked for a chain.

## Config and references
- `jstack.config.json` — team ids, integrations, `skill_defaults`, `jira_rules`, `notion`, `gbrain`. Never hardcode.
- Questions (open-ended, one at a time): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/question-patterns.md`
- Discrete choices (when the host supports AskUserQuestion or equivalent): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/ask-user-question-patterns.md`
- Integrations: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/integration-guide.md`
- HTML / branding tokens: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/html-spa-design.md`
- Chaining: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/chaining-guide.md`

## Intake
1. Parse `$ARGUMENTS` — note whether the user **pasted** data or is asking you to **query** a system.
2. If a required id is missing, ask **one** focused question; otherwise use config defaults (label assumptions as `[assumption]`).
3. If the request bundles multiple unrelated goals, handle the first and offer to continue.

## Procedure
### Step 1 — Load config
Read relevant keys from `jstack.config.json`. If the integration is missing or unhealthy, say so and point to `jstack setup` / `jstack doctor` instead of faking data.

### Step 2 — Plan the safe path
Prefer read-only first, then idempotent updates, then irreversible changes — each gated by org norms.

### Step 3 — Execute
Route to the most specific child skill under `skills/reports/`. If the user's intent is clear, emit `suggested_next: <child-skill>` and stop. If ambiguous, ask one question to disambiguate before routing.

### Step 4 — Validate
Correct surface, no stray side effects, tone matches `prompts/tones/` if publishing text.

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
| Missing data for a metric | Leave cell blank with `[no data]`; do not invent numbers. |
| Tone mismatch | Offer 2 tone options from `prompts/tones/` in one question. |

## Chaining
This is a **domain orchestrator** — route to the most specific child skill. Do not inline every sub-flow. If the user's task maps to one child, say `suggested_next: <child-skill>` and stop.

## User request

$ARGUMENTS

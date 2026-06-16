---
name: jstack-knowledge-shortcuts
description: Bridge to gstack/superpowers skills for planning and QA. Link to prompts/shortcuts/, do not duplicate.
category: knowledge
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Bridge to gstack/superpowers skills for planning and QA. Link to prompts/shortcuts/, do not duplicate.

## Domain rules — knowledge
- **Lookup vs store:** `jstack:knowledge-search` answers from configured sources (`knowledge_base` in config). Intake/process store into gbrain/Notion. See `skills/knowledge/references/gbrain-patterns.md`.
- Intake raw notes → process (tag, dedupe, link) → route to gbrain/Notion per config.
- No invented hierarchy: if a page id is missing, return markdown the user can paste.
- Deduplication: merge duplicates; keep the oldest decision link as canonical.

## Config and references
- `jstack.config.json` — team ids, integrations, `skill_defaults`, `jira_rules`, `notion`, `gbrain`. Never hardcode.
- Questions (open-ended, one at a time): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/question-patterns.md`
- Discrete choices (when the host supports AskUserQuestion or equivalent): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/ask-user-question-patterns.md`
- Integrations: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/integration-guide.md`
- Chaining: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/chaining-guide.md`

## Composites
Named aliases (`jstack:ceo-brainstorm`, `jstack:executive-research-brief`, …) combine `!cat` of persona + tone with gstack or superpowers targets. Read `${CLAUDE_PLUGIN_ROOT}/prompts/shortcuts/composites.md`. Thin wrappers: `skills/shortcuts/*`.

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
Bridge to gstack/superpowers. Output which external skill to run, not a copy of that skill's body. Link to `prompts/shortcuts/gstack-bridge.md`, `prompts/shortcuts/superpowers-bridge.md`, and `prompts/shortcuts/composites.md` (persona + tone + target skill, e.g. `jstack:ceo-brainstorm`). Prefer `skills/shortcuts/` wrapper skills when the user uses a named alias.

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
| Duplicate entry detected | Show the existing canonical and ask: merge, update, or skip. |

## Chaining
Complete the work here. If a natural follow-up exists (e.g. `jstack:jira-intake` then `jstack:jira-create`), add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

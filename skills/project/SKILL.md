---
name: jstack-project
description: Cross-surface project status (Notion/Jira): RAG health, 3 risks, 3 asks, milestone table.
category: project
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Cross-surface project health from Notion, Jira, and user-supplied updates. Output: RAG status, 3 risks, 3 asks, milestone table.
- **Out of scope:** Updating Jira or Notion directly — produce a read-only snapshot.

## Domain rules — project status
- Cross-surface: pull from Notion project page, Jira board, and user-supplied updates.
- RAG health: Red = blocked / at risk, Amber = dependency or scope risk, Green = on track. Label the signal source.
- 3 risks + 3 asks to leadership (or "none" if clean). Milestone table with dates and status per row.
- If Jira board is not linked, accept user paste or config epic keys.

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

For methodology, examples, and templates for this skill, read:
!cat ${CLAUDE_PLUGIN_ROOT}/skills/project/references/deep-dive.md

### Step 2 — Plan the safe path
Prefer read-only first, then idempotent updates, then irreversible changes — each gated by org norms.

### Step 3 — Execute
Pull data from Notion project page and Jira board (or accept user paste if integrations are missing).
- Build: RAG status line, milestone table (name, date, status), 3 risks with owner, 3 asks to leadership.
- If Jira is unavailable, accept epic keys or a pasted sprint view.
- Output is read-only — do not update Notion or Jira from this skill.

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
| Jira board not linked | Accept epic keys or user paste; note the data gap in output. |
| Stale Notion page | Show last-updated date; suggest refresh before sharing externally. |

## Chaining
Complete the work here. If a natural follow-up exists (e.g. `jstack:jira-intake` then `jstack:jira-create`), add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

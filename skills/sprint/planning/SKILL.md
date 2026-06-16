---
name: jstack-sprint-planning
description: Sprint planning: capacity, commit vs goal, spill from last sprint with root causes.
category: sprint
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Route sprint requests to the right sub-skill (planning, mid-sprint re-plan). Provide capacity and goal context.
- **Out of scope:** Moving Jira issues between sprints without user confirmation.

## Domain rules — sprint
- Do not silently drop committed work: show spill reasons (dependency, new critical work, scope).
- If historical velocity data is missing, use T-shirt estimates with a conversion note.
- **Starting a new sprint:** Confirm with the user whether **incomplete work** moves as **bulk transition** to the new sprint, stays in the backlog, or splits (some carry, some defer). If the org **clones** a board / sprint shell, call that out as a separate Jira admin or MCP step and record the new sprint id in config or the summary. Cloud vs Data Center Jira differ — read tool schemas before `createSprint` / `moveIssues`.

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
!cat ${CLAUDE_PLUGIN_ROOT}/skills/sprint/planning/references/deep-dive.md

### Step 2 — Plan the safe path
Prefer read-only first, then idempotent updates, then irreversible changes — each gated by org norms.

### Step 3 — Execute
Capacity (holidays, on-call) + commit vs goal. Show spill from last sprint with root causes.
- Jira: suggest sprint scope as list of issue keys, not a silent bulk edit.
- `suggested_next:` `jstack:reports` or Notion sprint page update when user uses both.

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
| No velocity data available | Use T-shirt estimates with a conversion note; do not invent points. |
| Sprint scope exceeds capacity | Show the gap and suggest which items to defer. |

## Chaining
Complete the work here. If a natural follow-up exists (e.g. `jstack:jira-intake` then `jstack:jira-create`), add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

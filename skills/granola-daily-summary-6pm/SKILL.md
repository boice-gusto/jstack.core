---
name: jstack-granola-daily-summary-6pm
description: Scheduled variant of daily Granola/meeting summary (6pm cadence).
when_to_use: Automated or scheduled daily summary workflow.
category: meetings
data_class: internal
disallowed-tools: AskUserQuestion
effort: low
gbrain_destination: team
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Scheduled end-of-day variant of the Granola daily summary, run unattended on a cron trigger.
- **Out of scope:** Blocking on an interactive prompt — there is no human present — and posting the digest anywhere.

## Domain rules — meetings
- Privacy: mark sensitive transcript segments; offer redacted summary for public channels.
- Action items need **owner + due**; if owner unknown, `unassigned` + suggested ping.
- Not a calendar authority — suggest invite text, do not send unless a tool explicitly does.

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
Confirm attribution before recording a decision as someone's — misattributing a commitment is the costly error here. Keep personal notes out of team stores. Distinguish what was decided from what was merely discussed.

### Step 3 — Execute
Parse the day's captured notes or Granola export into Decisions (with who decided), Open Questions, and Action Items (each with owner + due; use `unassigned` plus a suggested ping when the owner isn't stated). Because this runs unattended with no one to ask, resolve ambiguity with the most conservative reading and flag it rather than guessing silently or stalling. Mark any sensitive or HR-adjacent segment so a redacted version can be produced, and stop at producing the digest — do not post it anywhere.

### Step 4 — Validate
Confirm each decision has an owner, each action has a date, and attribution matches what was actually said. Confirm personal content did not land in a shared store.

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
| No transcript / empty paste | Ask user to provide notes or audio file path. |
| PII in public summary | Redact and flag before posting; offer redacted vs full versions. |

## Chaining
Complete the work here. If a natural follow-up exists (e.g. `jstack-meetings-granola` then `jstack-meetings-action-items`), add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

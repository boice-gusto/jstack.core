---
name: jstack-meetings-transcribe
description: Convert meeting audio/video to text via approved transcription patterns. Mark [inaudible] and redact PII for public summaries.
category: meetings
effort: medium
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->
<!-- chains-to: jstack:meetings-action-items -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Convert meeting audio or video into text using approved transcription patterns, marking `[inaudible]` segments and redacting PII before any public summary.
- **Out of scope:** Extracting action items or highlights — hand off to the appropriate downstream skill.

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
AV → text via org-approved provider patterns. Mark `[inaudible]` and add timestamps if asked.
- **PII/HR:** redact in public summary even if present in transcript.

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

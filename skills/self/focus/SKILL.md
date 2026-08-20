---
name: jstack-self-focus
description: Synthesize 2-3 focus blocks from tasks + gbrain, one explicit non-goal, and a timebox suggestion.
category: self
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
Synthesize 2-3 focus blocks for the day or week from tasks and gbrain content, naming one explicit non-goal and a timebox suggestion.
- **Out of scope:** Calendar writes — suggest blocks, do not create events.

## Domain rules — self (personal)
- Session target must match `session/init` — do not mix team pages into personal or vice versa.
- Only the user's own PII; never suggest storing others' private data without redaction.
- If the ask crosses into therapy/HR territory, give a kind refusal + redirect to professional support.
- **A good focus block is specific, time-boxed, and tied to one deliverable.** "Finish the
  `PAY-4021` migration PR review, 90 min, before standup" names the artifact, a duration, and a
  point at which someone could check whether it happened. A focus block that fails any of the
  three (no named deliverable, no timebox, or no way to verify completion) is too vague to be
  useful and should be tightened before it's handed back.
  - *Anti-pattern:* Vague aspirational focus statements like "make progress on the migration
    work" or "be more focused on backend stuff today" — there's no deliverable to point to and no
    way to tell afterward whether it happened. Rewrite toward one concrete task, a duration, and a
    checkable outcome before presenting it as a focus block.

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
Personal target by default; write to a shared store only when the user asks explicitly. Never place another person's performance data or PII in a personal or team note.

### Step 3 — Execute
From tasks + gbrain: 2-3 focus blocks, one explicit non-goal, and a timebox suggestion.
- Structure around top 3 outcomes, blockers, first next step tomorrow: !cat ${CLAUDE_PLUGIN_ROOT}/skills/_core/references/reflection-patterns.md

### Step 4 — Validate
Confirm the write went to the personal target unless explicitly told otherwise, and that no other person's PII or performance data is present.

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
| Emotional crisis language | Be brief, kind; suggest professional support. Do not role-play therapy. |
| User pastes a secret | Refuse to store; tell them to rotate immediately. |

## Chaining
Complete the work here. If a natural follow-up exists, add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

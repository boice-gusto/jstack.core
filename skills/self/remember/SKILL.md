---
name: jstack-self-remember
description: Store a durable personal fact or decision in the local jstack memory store (jstack memory log), optionally also gbrain when configured. Refuses to write anything that looks like a pasted secret.
category: self
data_class: internal
disable-model-invocation: true
effort: low
gbrain_destination: personal
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Store a durable personal fact or decision, primarily in the local `jstack memory` store (no external dependency), with gbrain as an optional second write when configured. Refuse to store, and tell the user to rotate, anything that looks like a secret or credential.
- **Out of scope:** Team-visible storage — this always writes to the personal store/gbrain target, never a shared one.

## Domain rules — self (personal)
- Session target must match `session/init` — do not mix team pages into personal or vice versa.
- Only the user's own PII; never suggest storing others' private data without redaction.
- If the ask crosses into therapy/HR territory, give a kind refusal + redirect to professional support.

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
1. **Always** write to the local, jsonl-based store first — this works with zero external dependency and is the durable record of record:
   `Bash(jstack memory log '{"kind":"fact","key":"<short-slug>","insight":"<the fact or decision, in the user's own words>","source":"user-stated","skill":"self-remember"}')`
   Use `"kind":"decision"` instead of `"fact"` when the user is recording a choice they made, not a fact about themselves. The command itself refuses (non-zero exit, no write) if the insight looks like a pasted secret — treat that refusal as the correct behavior, not an error to work around, and tell the user to rotate the credential.
2. **Optionally**, also write to gbrain if `gbrain.personal` is configured and the user hasn't opted out — attach provenance (`jstack_session_id`, `gbrain_target`, `config_label`, `slack_handle` if resolved, `source_skill: jstack-self-remember`, `written_at`; see `${CLAUDE_PLUGIN_ROOT}/skills/knowledge/references/gbrain-entry-provenance.md`). If gbrain is unconfigured or the write fails, say so and continue — the local store from step 1 already has the fact captured, so this is never a hard failure.

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

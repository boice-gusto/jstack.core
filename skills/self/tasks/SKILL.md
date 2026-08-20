---
name: jstack-self-tasks
description: Roll up personal tasks from Jira + gbrain TODOs. Deduplicate and return top 5 with a parking lot.
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
Roll up personal tasks from Jira and gbrain TODOs into one deduplicated list, returning the top 5 with a parking lot for the rest.
- **Out of scope:** Creating or updating Jira tickets — use the Jira skills for writes.

## Domain rules — self (personal)
- Session target must match `session/init` — do not mix team pages into personal or vice versa.
- Only the user's own PII; never suggest storing others' private data without redaction.
- If the ask crosses into therapy/HR territory, give a kind refusal + redirect to professional support.
- **Reconcile Jira and gbrain by surfacing, never by silently merging away a mismatch.** Match
  items across the two sources on content (same task described differently), not just on exact
  string equality, and when a task exists in only one source, keep it — flag it as
  `jira-only` or `gbrain-only` in the output rather than either dropping it or duplicating it
  under both labels. This skill never writes ticket state (per its own out-of-scope note), so
  reconciliation is display-only: it changes what the rollup shows the user, never what either
  source contains.
  - *Anti-pattern:* Silently dropping a task that appears in gbrain but has no matching Jira
    ticket (or vice versa) because it "didn't dedupe cleanly" — that hides a real discrepancy
    (a TODO nobody ticketed, or a ticket nobody logged) instead of surfacing it. Always show the
    single-source item with its source labeled, even in the parking lot.

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
Roll-up of Jira + gbrain TODOs. Deduplicate. If overload, return top 5 and a parking lot.

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

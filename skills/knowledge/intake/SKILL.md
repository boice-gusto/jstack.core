---
name: jstack-knowledge-intake
description: Ingest raw text into a structured record (title, body, tags). Flag PII/secrets before storage. User says "save this," "capture this," "log this decision," "note this down," or pastes raw text/a decision and wants it turned into a structured, storable record — not when they're asking a question that should be answered from existing knowledge (that's knowledge/search).
category: knowledge
data_class: internal
disable-model-invocation: true
effort: medium
gbrain_destination: inherit
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->
<!-- chains-to: jstack:knowledge-process -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Turn raw pasted or captured text into one structured record — title, body, tags, source, and as-of time — flagging PII or secrets before anything is stored.
- **Out of scope:** Judging whether the knowledge is correct, and merging it against existing entries — dedupe and merge belong to `jstack:knowledge-process`. Never persist without confirmation.

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

## Intake
1. Parse `$ARGUMENTS` — note whether the user **pasted** data or is asking you to **query** a system.
2. If a required id is missing, ask **one** focused question; otherwise use config defaults (label assumptions as `[assumption]`).
3. If the request bundles multiple unrelated goals, handle the first and offer to continue.

## Procedure
### Step 1 — Load config
Read relevant keys from `jstack.config.json`. If the integration is missing or unhealthy, say so and point to `jstack setup` / `jstack doctor` instead of faking data.

### Step 2 — Plan the safe path
Search for near-duplicates before writing anything new — unresolved duplicates make later retrieval untrustworthy. Carry source and as-of time on every entry. Ask before persisting, and honour the session's team-vs-personal target rather than defaulting to shared.

### Step 3 — Execute
Raw text → title + body + tags. Flag PII/secret before storage.
- gbrain target: team vs personal from session; see `gbrain-patterns.md`.

**Worked example — PII/secret flag:**
Pasted text: "Decision: rotate the payments webhook secret. New value is `whsec_8f2K...`. Contact
Priya (priya@example.com, cell 555-0142) if it breaks."
- *Wrong:* Storing the record as-is with the secret and phone number inline because "it's context
  for the decision."
- *Right:* Store the decision ("rotate the payments webhook secret") and the contact channel
  ("owner: Priya, via Slack") as the record; strip the literal secret value and the personal phone
  number before persisting, and tell the user: "I removed the secret value and the phone number
  before saving — the secret should be rotated (not reused) since it was pasted in plaintext, and
  Priya's number should be reached through a directory lookup instead of stored verbatim." Do not
  persist until the user confirms the redacted version is what they want stored.

### Step 4 — Validate
Confirm the entry is findable by the query a future reader would actually use, that provenance is attached, and that no duplicate was left unresolved. Confirm it went to the intended team-vs-personal target.

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
Complete the work here. If a natural follow-up exists (e.g. `jstack-knowledge-intake` then `jstack-knowledge-process`), add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

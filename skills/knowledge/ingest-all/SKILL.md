---
name: jstack-ingest-all
description: Run configured ingest_all skill+prompt chain for new artifacts; finish with GBrain when configured.
when_to_use: User wants batch ingest of new transcripts/exports using the ordered ingest_all array in config.
category: knowledge
data_class: internal
disable-model-invocation: true
effort: low
gbrain_destination: inherit
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Run the configured bulk ingest across `ingest_all` sources, reporting per-source counts and every item skipped with its reason.
- **Out of scope:** Ingesting a source absent from config, and silently dropping items that failed to parse.

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
- `jstack:meetings/transcripts-ingest` is the common predecessor for new transcript files landing in Drive — it classifies and routes them before this skill's ordered `ingest_all` walk picks the resulting artifacts up as one of its configured sources. `ingest-all` does not itself watch Drive; a source entry in config still has to name the skill+prompt chain to run.

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
Walk the ordered `ingest_all` array from config, running each source's configured skill+prompt chain in turn — never a source absent from that array. For each artifact: tag, dedupe, and link before routing it to gbrain/Notion per config, keeping a per-source running count of items ingested versus skipped with the specific reason for every skip. Finish with the GBrain write when `gbrain_destination` calls for it.

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
- Common predecessor: `jstack:meetings/transcripts-ingest` for new transcript files — it typically hands off into this skill's `ingest_all` walk rather than the other way around. Do not invoke `transcripts-ingest` from here; it is the entry point, not a step this skill triggers.

## User request

$ARGUMENTS

---
name: jstack-ingest-all
description: Run configured ingest_all skill+prompt chain for new artifacts; finish with GBrain when configured.
category: knowledge
gbrain_destination: team
data_class: internal
when_to_use: User wants batch ingest of new transcripts/exports using the ordered ingest_all array in config.
---

<!-- Chain Contract -->
<!-- inputs: user_request, ingest_all_config, jstack_config -->
<!-- outputs: chain_results, gbrain_artifacts optional -->
<!-- chains-to: per-entry skills in ingest_all, meetings/transcripts-ingest -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for

Execute the merged config array **`ingest_all`**: each entry `{ "skill": "jstack:…", "prompt": "…" }` in order for **new** items (transcripts, exports, dumps). Final steps may persist summaries per **`gbrain`** / session provenance. Align output with **`response-artifacts.md`**.

## Out of scope

- Defining new integration credentials (use **`jstack setup`**).
- Running unrelated skills not listed in `ingest_all`.

## Domain rules — ingest chains

- **Order matters:** Run entries strictly in array order.
- **New-only:** Use the same “new file” discovery as **`meetings/transcripts-ingest`** where applicable.
- **Approvals:** In restrictive hosts, obtain user approval before each mutating sub-skill.

## Config and references

- `ingest_all` — ordered steps in merged config.
- `session.default_gbrain_target`, `gbrain.*` — see `jstack.core/docs/PE_AND_TEAM_CONFIG.md` and gbrain references when persisting.
- `${CLAUDE_PLUGIN_ROOT}/skills/meetings/transcripts-ingest/SKILL.md` for discovery of new work.
- `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/response-artifacts.md`
- `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/gbrain-persistence-metadata.md` (if persisting)
- `${CLAUDE_PLUGIN_ROOT}/docs/SKILL_SOURCES.md` (copy vs link policy for bundled trees)

## Intake

1. Load merged config; if **`ingest_all`** is empty, report that and point to templates under `config/workflows/` or `defaults.json` patterns.
2. Confirm whether the run is **dry summary** or **full execute**.

## Procedure

### Step 1 — Load and validate

Read `ingest_all`; if malformed, stop with schema hint (array of objects with `skill` + `prompt`).

### Step 2 — Discover new work

Use Drive manifest / user paste (see **transcripts-ingest**) to find **new** artifacts.

### Step 3 — Run chain

For each step, build handoff text from **`prompt`**, then invoke the named skill (or instruct the user to run it) in order.

### Step 4 — GBrain and artifacts

If configured, end with gbrain-appropriate summary and **## Links** for any published URLs or doc paths.

## Output shape

- **Summary** — What was new, which steps ran, and completion status.
- **Per-step** — Skill id, one-line outcome, links if any.
- **result_ok** — true/false for eval-gated hosts if applicable.

## Failure modes

| Symptom | Recovery |
|---------|----------|
| Empty `ingest_all` | Suggest sample entries; do not invent skills. |
| Sub-skill missing | Skip with error line or hand off to `jstack` doctor / setup. |
| Partial batch failure | Report completed steps; list failures with next action. |

## Chaining

- Start-of-chain: **`jstack-transcripts-ingest`** when the batch is transcript-heavy.
- `suggested_next:` last skill in chain or **knowledge/search** for verification queries.

## User request

$ARGUMENTS

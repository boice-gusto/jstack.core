---
name: jstack-pe-report-context
description: Validate and normalize PE / team report JSON against schemas/pe; gate skills until pe.configured is true.
category: reports
data_class: people_performance
gbrain_destination: team
when_to_use: Building or validating performance/team report context JSON before render or Notion/ HTML publish.
---

<!-- Chain Contract -->
<!-- inputs: user_request, mcp_or_tool_facts, jstack_config -->
<!-- outputs: PeReportContext json, structured_result -->
<!-- chains-to: report render, notion, reports/team, share-html -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for

Build or validate a **`PeReportContext`** JSON object (`schemas/pe/report-context-v1.schema.json`) using **tools and user-supplied facts only**. **Do not** invent performance metrics, dates, or peer quotes. If **`pe.configured`** is not `true`, **stop** and direct the user to **`jstack setup --pe`**.

## Out of scope

- HR decisions, calibration outcomes, or legal interpretations.
- Filling in missing 1:1 content without a real source.

## Domain rules — PE data

- **No fabrication:** Every numeric or qualitative field must map to a cited source (API, file, or explicit user paste). Label estimates as `[estimate]`.
- **Schema first:** Validators must run against **`report-context-v1`**; reject or mark invalid sections instead of “fixing” data silently.
- **Privacy:** This skill uses `data_class: people_performance` and **`gbrain_destination: team`** per metadata — do not post individual ratings to the wrong gbrain target.

## Config and references

- `pe.*` in `jstack.config.json` — gate on **`pe.configured`**
- Skill args: `team_ref=`, `window_days=` (override config when documented)
- `${CLAUDE_PLUGIN_ROOT}/docs/PE_AND_TEAM_CONFIG.md`
- `${CLAUDE_PLUGIN_ROOT}/schemas/pe/report-context-v1.schema.json`
- `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/response-artifacts.md`
- `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/gbrain-persistence-metadata.md`

## Intake

1. Confirm `pe.configured` from merged config; if false, stop with setup link.
2. Collect **window** and **team_ref** from args or one question each.

## Procedure

### Step 1 — Config gate

Load merged config; if **`pe.configured`** is not `true`, stop and tell the user to run **`jstack setup --pe`**.

### Step 2 — Gather facts

Gather facts **only** via MCP/API/approved files and user pastes. Map fields to the schema; leave unknowns null or omit per schema rules, **never** guess.

### Step 3 — Emit JSON

Output JSON matching **`report-context-v1`**. If validation fails, output errors and partial JSON only if the user can fix it.

### Step 4 — Hand off

Chain to **report render** / **Notion** / **HTML** skills with the JSON payload when the user wants publication.

## Output shape

- **Valid JSON** — Single fenced `json` block for **`PeReportContext`**, or a list of **validation errors** with line hints.
- **Provenance** — Short bullet list of which sources were used.
- **No inline narrative** in place of required fields; use the schema’s structure.

## Failure modes

| Symptom | Recovery |
|---------|----------|
| `pe.configured` false | Single message: run `jstack setup --pe` — do not continue. |
| API empty | Say so; ask for user paste or different window. |
| Schema mismatch | Return validator errors; do not coerce types silently. |

## Chaining

- `suggested_next:` **`jstack-notion-team-note`**, **report render** path, or **`jstack-report-share-html-publish`** depending on user ask.

## User request

$ARGUMENTS

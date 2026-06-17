---
name: jstack-transcripts-ingest
description: Ingest new transcript files from Google Drive (or paste) into meetings pipeline; classify source and route to child skills.
category: meetings
gbrain_destination: team
data_class: internal
when_to_use: New meeting transcripts arrived in Drive or user pastes a file; route to highlights, transcribe, or action-items flows.
effort: low
disable-model-invocation: true
---

<!-- Chain Contract -->
<!-- inputs: user_request, drive_manifest, jstack_config -->
<!-- outputs: routed_transcript_refs, structured_result -->
<!-- chains-to: meetings/granola-highlights, meetings/transcribe, meetings/action-items -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for

Discover **new** transcript files (or a user-pasted artifact), classify the **source** (Granola, Notion export, Zoom, etc.), update any local **manifest** / processed markers per org policy, and **route** to the right **`meetings/*`** child skill. Finish with **## Links** for created Notion, Jira, or Slack URLs.

## Out of scope

- Legal hold or HR policy decisions; follow org guidance in `jstack.gusto` **`references/org-context`** when present.
- Full transcription from raw audio without a configured provider (hand off to **`meetings/transcribe`** with honest limits).

## Domain rules — transcripts

- **New-only:** Prefer listing files not already in the manifest before reprocessing.
- **Classification:** Use filename, folder, and `integrations.transcripts` hints; label uncertain sources as `[assumption]`.
- **No secrets:** Do not paste full transcript bodies into public channels; link to stored locations.

## Config and references

- `integrations.google_drive.transcripts_folder_id`
- `integrations.transcripts` and related keys in merged `jstack.config.json`
- Child routes: `${CLAUDE_PLUGIN_ROOT}/skills/meetings/granola-highlights/SKILL.md`, `.../transcribe/`, `.../action-items/`
- Artifacts: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/response-artifacts.md`
- Chaining: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/chaining-guide.md`

## Intake

1. Determine **source** of new work: Drive poll vs paste vs path on disk.
2. If multiple files, process in stable order (e.g. oldest first) and cap batch size if the user asks.

## Procedure

### Step 1 — List or accept input

List **new** files not in manifest, or accept a single pasted/uploaded file reference from the user.

### Step 2 — Classify

Classify: **granola** | **notion** | **zoom** | **other** using filename and folder metadata.

### Step 3 — Route

Invoke the appropriate child skill handoff (Granola highlights path vs raw transcribe vs action-items extraction). Preserve **session provenance** for gbrain when configured.

### Step 4 — Manifest and links

Update manifest / processed markers under org policy. Emit **## Links** for any created Notion/Jira/Slack URLs.

## Output shape

- **Summary** — Count of files ingested, classification, and where they were routed.
- **Routing table** — One row per file: path or id, source class, target skill.
- **Links** — Under **## Links** per `response-artifacts.md`.

## Failure modes

| Symptom | Recovery |
|---------|----------|
| Drive integration missing | Ask for paste or file path; suggest `jstack setup` / doctor. |
| Ambiguous source | One question or default to safest child with `[assumption]`. |
| Duplicate in manifest | Skip or ask user for override. |

## Chaining

- `suggested_next:` **`jstack-granola-highlights`**, **`jstack-transcribe`**, or **`jstack-action-items`** as appropriate; one primary handoff.

## User request

$ARGUMENTS

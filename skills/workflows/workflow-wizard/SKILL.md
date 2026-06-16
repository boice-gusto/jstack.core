---
name: jstack-workflow-wizard
description: Multi-step choices to define a browser workflow; emits jstack workflow CLI commands.
category: workflows
gbrain_destination: inherit
data_class: internal
when_to_use: User wants to create or adjust a stored workflow and needs copy-pastable jstack workflow CLI steps.
---

<!-- Chain Contract -->
<!-- inputs: user_request, ask_user_questions optional -->
<!-- outputs: cli_commands, structured_result -->
<!-- chains-to: jstack workflow create/edit, workflows/execute -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for

Guide the user through **id**, **start URL**, and optional **name** using discrete choices (when the host supports AskUserQuestion or equivalent). Finish with copy-pastable **`jstack workflow`** shell commands. **No** live Playwright in this skill: recording and execution depend on the **workflow** CLI and engine (`cli/src/lib/workflow-engine.ts`); **`run` without `--yes`** previews, **`--yes` runs the stub** until a real driver is wired.

## Out of scope

- Generating `config/workflows/<id>.json` bytes inside chat without user approval — use CLI `create` / `edit` or file templates.
- Running against production with `--yes` without an explicit user confirmation step in the transcript.

## Domain rules — wizard

- **Slug id:** `id` is filesystem-safe, no spaces (matches `config/workflows/<id>.json`).
- **HTTPS start_url:** Reject non-`https` for external starts unless the user documents a local dev exception as `[assumption]`.
- **Links:** **## Links** only when a real file path, PR, or share URL exists (`response-artifacts.md`).

## Config and references

- `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/response-artifacts.md`
- `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/ask-user-question-patterns.md` (if using discrete choices)
- `${CLAUDE_PLUGIN_ROOT}/skills/workflows/runner/SKILL.md` — runbook and safety
- `${CLAUDE_PLUGIN_ROOT}/skills/workflows/execute/SKILL.md` — `run` / stub behavior
- Team roster, 1:1 Notion wiring, and **`team.canonical_group.mode`** (Slack user group vs Google Group vs manual): `${CLAUDE_PLUGIN_ROOT}/skills/team/references/team-canonical-identity.md` and `${CLAUDE_PLUGIN_ROOT}/skills/notion/setup/SKILL.md` — use when the user is combining **org setup** with workflows.
- CLI source of truth: `jstack.core/cli/src/commands/workflow.ts` (list, show, run, create, edit, export, import)

## Intake

1. If **id** or **url** is already in `$ARGUMENTS`, skip redundant questions.
2. If the user needs **deletion** or import, use `jstack workflow --help` patterns (import/export) instead of this wizard.

## Procedure

1. Ask: workflow **id** (slug, no spaces).
2. Ask: **start_url** (https).
3. Optional: friendly **name**.
4. Emit commands for the user to run in their shell:
   - `jstack workflow create <id> --url <start_url>`
   - If editing: `jstack workflow edit <id> --url … --name …`
5. For export/share: `jstack workflow export <id> --out /tmp/<id>.json` (path user-adjustable)
6. End with **## Links** only when a path or URL exists; otherwise “no links — local file only” is fine.
7. **suggested_next:** **`jstack-workflow-execute`** for preview run (`run` without `--yes` first)

## Output shape

- **Emitted commands** — Fenced `bash` block, ready to copy.
- **Checklist** — create → (optional) edit → show → run without `--yes` → run with `--yes` when user accepts stub/real behavior.

## Failure modes

| Symptom | Recovery |
|---------|----------|
| Host can’t ask questions | Output all commands with `<id>` and `<start_url>` placeholders. |
| User wants recording | Point to product recorder path if present in their build; do not claim Playwright is bundled unless `doctor` / docs say so. |

## Chaining

- After commands are run, `suggested_next: jstack-workflow-execute` with workflow id in the handoff line.

## User request

$ARGUMENTS

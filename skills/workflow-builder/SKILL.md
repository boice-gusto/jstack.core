---
name: jstack-workflow-builder
description: Design or update multi-step team workflows (chains, routines, policies, approvals) from sprint, comms, SDLC, and incident patterns. Produces chain markdown and config-ready snippets — use after install to customize the plugin without editing skills by hand. Not for one-off Jira tickets.
category: workflow-builder
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: draft_chain_markdown, config_diff_snippet, routine_spec -->
<!-- chains-to: jstack:update-config -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for

**Compose** end-to-end flows: which `jstack:*` skills run in order, what config keys are required, and where they live (`prompts/chains/`, `jstack.config.json` routines, `approval_chains`, `policies`).

- **In scope:** New `prompts/chains/<name>.md`, updates to `routines` or `approval_chains`, mapping domains (sprint, comms, sdlc, incident) to existing skills, offering templates from `templates/config/`.
- **Out of scope:** implementing application code, executing integrations without user intent, or replacing `jstack:skill-creator` for single-skill `SKILL.md` authoring.

## Domain rules

- Read current config before designing (cadence, channels, approvers) — `skills/_core/references/config-schema.md`.
- If required keys are empty, follow `skills/_core/references/config-wizard.md` (templates for sprint, SDLC, incidents live under `templates/config/`).
- Approval-bound actions must resolve `approval_chains` per `skills/_core/references/approval-chains.md`.

## Config and references

- Domain map: `skills/workflow-builder/references/domain-map.md`
- Questions: `skills/_core/references/question-patterns.md`; discrete choices: `skills/_core/references/ask-user-question-patterns.md`
- Chaining conventions: `skills/_core/references/chaining-guide.md`
- Config wizard: `skills/_core/references/config-wizard.md`
- Example chains: `prompts/chains/*.md`

## Intake

1. Parse `$ARGUMENTS` — new workflow name, or edit existing chain/routine.
2. Ask **one** clarifying question if missing: (a) primary domain: sprint / comms / sdlc / incident / mixed, or (b) existing chain file to extend.
3. If user wants a **template bundle**, offer `startup` | `scaleup` | `enterprise` from `templates/config/*.json` as a starting point, then customize.

## Procedure

### Step 1 — Inventory

- List which skills participate (use `jstack:` ids in the doc; note `routines` short names if different).
- List config keys the flow needs (`sprint.*`, `approval_chains`, `policies.*`, `integrations.*`).

### Step 2 — Draft chain markdown

- Path: `prompts/chains/<kebab-name>.md`.
- Include: **Flow** line, **Steps** (numbered, skill per step), **Handoff rules** (user confirm, no fabricated metrics), **Config hook** JSON example (optional, like existing chains).

### Step 3 — Optional routine

- If scheduled: propose `routines.<name>.*` with `cron` and `chain: []` consistent with `config/defaults.json` examples.

### Step 4 — Config diff (snippet only)

- Output a **JSON merge snippet** the user can apply via `jstack:update-config` — not a full file replacement unless they asked for `templates/config/<profile>.json` seed.

### Step 5 — Validate

- Every step must map to a real `jstack:*` skill in this repo or be explicitly marked `[external / custom]`.
- No posting to Slack/email from this skill — drafts only; execution stays with the target skills.

## Output shape

- **Chain (markdown)** — Full `[DRAFT]` block for `prompts/chains/…` or file write instructions.
- **Config snippet** — Valid JSON fragment for `jstack.config.json` merge.
- **Checklist** — Config keys to fill; integrations required.
- `result_ok: true` | `result_ok: false` + reason

## Failure modes

| Symptom | Recovery |
|--------|----------|
| User describes a one-skill action | Point to the specific `jstack:*` skill, not a chain. |
| Unknown skill name | Grep or list `skills/**/SKILL.md` `name:` fields; do not invent `jstack:*` ids. |
| Config would conflict with `policies` | Call out conflict; user resolves via `jstack:update-config` with review. |
| User wants to edit a generated `SKILL.md` body | `jstack:skill-creator` + `SKIP` / generator docs; not this skill. |

## Chaining

- `suggested_next: jstack:update-config` with the merge snippet in the handoff when ready to persist.

## User request

$ARGUMENTS

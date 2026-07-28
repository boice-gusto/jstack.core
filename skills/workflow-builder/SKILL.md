---
name: jstack-workflow-builder
description: Design or update multi-step team workflows (chains, routines, policies, approvals) from sprint, comms, SDLC, and incident patterns. Produces chain markdown and config-ready snippets — use after install to customize the plugin without editing skills by hand. Not for one-off Jira tickets.
category: workflow-builder
effort: high
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

### Thresholds — when a request needs a chain vs a single skill

| Signal | Gate |
|---|---|
| Request names one skill and one action | No chain — point directly to that `jstack:*` skill |
| Request spans ≥2 skills with a fixed order and a handoff between them | Draft a chain in `prompts/chains/<name>.md` |
| Request recurs on a schedule (daily standup, weekly report) | Chain **and** a `routines.<name>` entry with `cron` |
| Any step posts or writes without the user in the loop | Blocked until an `approval_chains` entry covers it |

### Named anti-patterns

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| Inventing a `jstack:*` skill id not in the catalog | Produces a chain that fails at execution time | Verify every step against `name:` fields in `skills/**/SKILL.md` before drafting (Step 5 already requires this — treat it as load-bearing) |
| Designing an approval chain without checking existing `policies` | Creates two conflicting authorities for the same action | Read current `policies` and `approval_chains` first; call out conflicts explicitly |
| Having a chain step call Slack/email directly instead of delegating to the target skill | Bypasses that skill's own safety rails (confirmation, redaction, `disable-model-invocation`) | Chain steps name the skill to invoke; execution logic stays inside that skill |
| Proposing a full config file replacement when a merge snippet would do | Overwrites unrelated config the user already set | Emit a JSON merge snippet unless the user explicitly asked to seed from a `templates/config/<profile>.json` |

### Worked example

- *Weak chain:* "Step 1: do sprint planning. Step 2: tell the team."
- *Sharp chain:* "**Flow:** weekly sprint kickoff. **Steps:** 1. `jstack:sprint-planning` (produces backlog + capacity). 2. `jstack:jira-intake` for each committed item (owner, story points from step 1). 3. `jstack:notion-sprint` to publish the sprint page. **Handoff rules:** user confirms the committed list between steps 1 and 2; no fabricated velocity numbers — pull from `sprint.velocity_history` or ask. **Config hook:** `{\"routines\": {\"sprint_kickoff\": {\"cron\": \"0 9 * * 1\", \"chain\": [\"sprint-planning\", \"jira-intake\", \"notion-sprint\"]}}}`"

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

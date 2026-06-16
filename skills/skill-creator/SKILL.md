---
name: jstack-skill-creator
description: Create or revise jstack plugin skills (SKILL.md) using repo conventions, Anthropic-aligned directives, and config-first rules. Use when adding capabilities, forking a skill, or fixing discovery/failure coverage — not for running product workflows.
category: skill-creator
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config, target_skill_path? -->
<!-- outputs: draft_skill_or_diff, checklist_result -->
<!-- chains-to: jstack:update-config (if persisting new defaults only) -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for

**Create or modify** a `SKILL.md` (and optional `references/`, `examples/`) in this plugin so other agents can run the capability safely after install.

- **In scope:** Naming, frontmatter, chain contract, procedure shape, failure modes, splitting long content into `references/`, and reminding authors about `apply_detailed_skills.py` and the `SKIP` set.
- **Out of scope:** Executing the domain workflow the skill describes (e.g. “run sprint planning” → use `jstack:sprint-planning`); pasting secrets; generating skills outside `skills/`.

## Domain rules — authoring

- Follow directives-style writing per `${CLAUDE_PLUGIN_ROOT}/skills/skill-creator/references/anthropic-alignment.md`.
- Jstack layout and variables: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/skill-conventions.md` and `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/markdown-authoring-guide.md`.
- Org-specific values (sprint length, approvers, channels) belong in `jstack.config.json` and `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/config-schema.md` — not in prose.

## Config and references

- Preamble: `prompts/setup/preamble.md`
- Questions: `skills/_core/references/question-patterns.md`; discrete choices (AskUserQuestion or equivalent): `skills/_core/references/ask-user-question-patterns.md`
- Config / wizard: `skills/_core/references/config-wizard.md`, `skills/_core/references/config-schema.md`
- Checklist: `skills/skill-creator/references/jstack-skill-checklist.md`
- Anthropic-style principles: `skills/skill-creator/references/anthropic-alignment.md`

## Intake

1. Parse `$ARGUMENTS` — new skill, edit existing, or split a bloated `SKILL.md`.
2. If the user names a path under `skills/`, treat it as the target. Otherwise ask **one** question: "New skill path (e.g. `skills/my-domain/SKILL.md`) or existing file to edit?"
3. If the goal is a **hand-maintained** skill, say explicitly: add `skills/<name>/SKILL.md` to `SKIP` in `scripts/apply_detailed_skills.py` so the Python regenerator does not clobber it.

## Procedure

### Step 1 — Plan

- Propose `name: jstack-<kebab>`, one-line purpose, and `category` (folder name).
- List which integrations or config keys the skill will read.
- If the same domain exists, prefer **extending** a child under `skills/<domain>/` over duplicating a top-level skill.

### Step 2 — Draft `SKILL.md`

- Frontmatter: description must include **when to invoke** and, if useful, **when not to** (per meta-skill style).
- Body: chain contract, preamble `!cat`, then clear **Instructions** (numbered or phased), **Output shape**, **Failure modes** (table or bullets).
- Reference long tables from `_core/best-practices/…` or local `references/` instead of inlining.

### Step 3 — Validate

- Walk through `jstack-skill-checklist.md` and report pass/fail per line.
- Confirm no `SKIP` needed except for intentional hand-maintained files.

### Step 4 — Regenerator warning

- If the target is **not** in `SKIP`, running `python3 scripts/apply_detailed_skills.py` from repo root will **overwrite the body** with generated content. Either add the path to `SKIP` or accept merging manual edits with the data module later.

### Step 5 — Hand off

- If the user needs default config keys for the new skill, suggest `jstack:update-config` with dot paths, not ad-hoc config in chat.
- Suggested one-liner: `suggested_next: jstack:workflow-builder` (if the user is defining a multi-skill flow next).

## Output shape

- **Summary** — What was created or changed.
- **Files** — List paths (new or updated).
- **Checklist** — Result of `jstack-skill-checklist.md`.
- **Note** — Whether the file must be added to `SKIP` in `apply_detailed_skills.py`.
- `result_ok: true` or `result_ok: false` + reason

## Failure modes

| Symptom | Recovery |
|--------|----------|
| User wants a skill but scope is a chain across many systems | Use `jstack:workflow-builder` to define `prompts/chains/` and config, then smaller per-domain skills. |
| Generated skill is overwritten by `apply_detailed_skills.py` | Add `skills/<path>/SKILL.md` to `SKIP` or move content into `apply_detailed_skills_data.py` intentionally. |
| Description too vague for discovery | Rewrite `description` with triggers and exclusions; see `anthropic-alignment.md`. |
| Secret pasted for “example” | Refuse; point to `examples/` with synthetic data only. |

## Sub-skills

- **`jstack:skill-creator/improve-claude-md`** — Audit and improve the project's CLAUDE.md based on commits, session transcripts, and working-tree state. Read-only by default; emits a unified diff. Use when CLAUDE.md feels stale or when you have been correcting Claude on the same thing repeatedly.

## Chaining

- Prefer `jstack:workflow-builder` for multi-skill operability and chain files.
- Use `jstack:update-config` for persisting new `skill_defaults` or config keys.

## User request

$ARGUMENTS

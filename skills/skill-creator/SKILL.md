---
name: jstack-skill-creator
description: Create or revise jstack plugin skills (SKILL.md) using repo conventions, Anthropic-aligned directives, and config-first rules. Use when adding capabilities, forking a skill, or fixing discovery/failure coverage — not for running product workflows.
category: skill-creator
effort: high
disable-model-invocation: true
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
- **Out of scope:** Generating the initial directory skeleton (`SKILL.md` stub, `references/`, `evals/`) for a brand-new skill or plugin — see `jstack:scaffold` for that; this skill authors or revises the actual body content once the skeleton exists.

## Domain rules — authoring

- Follow directives-style writing per `${CLAUDE_PLUGIN_ROOT}/skills/skill-creator/references/anthropic-alignment.md`.
- Jstack layout and variables: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/skill-conventions.md` and `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/markdown-authoring-guide.md`.
- Org-specific values (sprint length, approvers, channels) belong in `jstack.config.json` and `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/config-schema.md` — not in prose.

### Thresholds / gate

| Signal | Threshold | Source |
|---|---|---|
| Frontmatter value shape | Must be an inline scalar; a YAML block list (`- item` lines) is silently dropped by the line-based parser | `scripts/apply_detailed_skills.py` `read_front_matter`; see `CLAUDE.md` "Frontmatter values must be inline scalars" |
| Hand-maintained skill | Must be added to `SKIP` in `scripts/apply_detailed_skills.py` before the first hand-edit, or the next regeneration overwrites the body | `CLAUDE.md` "Skill authoring" |
| `description` / `when_to_use` length | ≤1,536 chars each before `/doctor` reports skill-listing budget overflow | `CLAUDE.md` "Skill context budget" |
| Chain reference validity | Every `<!-- chains-to: jstack:<slug> -->` must resolve to a live skill in the catalog. Use the `<slug>` form in prose — a concrete example token here would itself have to resolve | `bun run validate-chains` |

### Named anti-patterns

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| Writing a multi-line YAML list in frontmatter (e.g. `allowed-tools:` as `- foo` / `- bar`) | `read_front_matter` is line-based; the list silently vanishes and the key round-trips empty — no error, just missing data | Write inline scalars: `allowed-tools: mcp__a__b, mcp__c__d` |
| Hand-editing a generated (non-`SKIP`) skill body | The next `apply_detailed_skills.py` run overwrites the edit with no warning | Add the path to `SKIP`, or move the content into `apply_detailed_skills_data.py` / a `scripts/skill_deep/` module instead |
| Vague `description` with no exclusion clause | Defeats model-invocation discovery — Claude can't tell when *not* to trigger the skill | Name concrete triggers and at least one explicit "not for X" case |
| Declaring `allowed-tools: mcp__*` in jstack.core | Hardcodes one org's server name into a generic skill; jstack.core is integration-agnostic by design | Route through `mcp_servers` / `integrations` in `jstack.config.json`; reserve `allowed-tools` for org overlays |
| Shipping a new skill with no `skill-catalog.json` entry | Skill exists on disk but is invisible to docs/routing tooling that reads the generated catalog | Run `bun run docs:generate` (or `jstack docs generate`) after adding a skill |

### Worked example

- *Weak description:* `description: Helps with meetings.`
- *Sharp description:* `description: Paired 1:1 prep and after-meeting notes from configured transcript sources; prefer Lattice MCP when enabled, else Notion private PE or 1:1 parent pages; always append AI attribution.` — names the trigger, the data source, the routing logic, and a hard behavioral rule (copied from `skills/meetings/one-on-one-transcript/SKILL.md`), which is exactly what makes a skill discoverable and predictable.

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
- **`jstack:skill-creator/retro`** — Read back the local `jstack memory` store, recent eval reports, and declined-edit history; produce a self-improvement retro naming what recurred often enough to promote into a real fix versus what's still a one-off note. Use when the user asks "what have we learned" or "do a retro on our skills."

## Chaining

- Prefer `jstack:workflow-builder` for multi-skill operability and chain files.
- Use `jstack:update-config` for persisting new `skill_defaults` or config keys.

## User request

$ARGUMENTS

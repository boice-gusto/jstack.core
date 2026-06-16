---
name: jstack-skill-finder
description: Map vague user goals to specific jstack skills; prefer CLI skills index and domain routers.
category: knowledge
gbrain_destination: inherit
data_class: non_sensitive
when_to_use: User asks how to do something or which jstack skill to use; keep answers to 1–3 skills with rationale.
---

<!-- Chain Contract -->
<!-- inputs: user_goal, optional jstack_config -->
<!-- outputs: skill_recommendations, structured_result -->
<!-- chains-to: any named jstack:* skill after user picks -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for

**Route** “how do I …?” questions to the right **`jstack:*`** (or `jstack` CLI) entry **without** loading every `SKILL.md` in the tree. Prefer the **router** skills in each domain (knowledge, meetings, jira, …) and the **`jstack skills`** CLI when a shell is available.

## Out of scope

- Executing arbitrary tools on behalf of the user without a chosen skill.
- Promising features not in the current plugin bundle; say “not in this build” and suggest setup or another repo.

## Domain rules — discovery

- **1–3 skills max** with one-line **why** each.
- **CLI first** when available: `jstack skills index --json`, then `jstack skills show <name>`.
- **Gusto:** If `jstack.gusto` is present, read **`references/skill-routing.md`** in that pack when org-specific routing applies.

## Config and references

- `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/skill-discovery.md`
- `${CLAUDE_PLUGIN_ROOT}/docs/SKILL_SOURCES.md`
- Chaining: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/chaining-guide.md`
- Optional org overlay: `jstack.gusto` **`references/skill-routing.md`**

## Intake

1. Paraphrase the user goal in one line.
2. If the goal is multi-part, list sub-goals and pick the **first** for routing, offer to continue.

## Procedure

### Step 1 — Read discovery contract

Read **`skill-discovery.md`** for hierarchy and anti-patterns.

### Step 2 — CLI (if available)

Suggest: `jstack skills index --json` and `jstack skills show` for the best match.

### Step 3 — Gusto (if present)

When the request sounds org-specific (HR, Jira project keys, Gusto), consult gusto **`references/skill-routing.md`**.

### Step 4 — Answer

Output **1–3** skills with short rationale. Do not run unrelated skills.

## Output shape

- **Top pick** — Skill id and one-sentence reason.
- **Alternates** — Up to two more, optional.
- **How to start** — One concrete next command or `Skill` name.

## Failure modes

| Symptom | Recovery |
|---------|----------|
| CLI unavailable | Rely on `skill-discovery` and static routers only. |
| Goal still vague | One clarifying question; then 2 options A/B. |

## Chaining

- End with: `suggested_next: <chosen-skill-id>` and a one-line handoff. Do not auto-run chains without user consent.

## User request

$ARGUMENTS

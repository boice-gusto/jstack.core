---
name: jstack-ceo-brainstorm
description: "Alias jstack:ceo-brainstorm — CEO persona + executive tone, then superpowers:brainstorming. Use when the user wants exec-lens ideation."
category: knowledge
effort: high
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->
<!-- chains-to: superpowers:brainstorming (via Skill tool when available) -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for

Composite entry for **leadership-framed brainstorming**. Loads CEO persona and executive tone, then delegates to **`superpowers:brainstorming`** with the user’s topic. Documented as **`jstack:ceo-brainstorm`**.

- **Out of scope:** Implementing ideas, filing tickets, or replacing the full superpowers skill content (link only).

## Config and references

- Questions: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/question-patterns.md`; discrete choices: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/ask-user-question-patterns.md`
- Full recipe table: `${CLAUDE_PLUGIN_ROOT}/prompts/shortcuts/composites.md`
- Persona: `!cat ${CLAUDE_PLUGIN_ROOT}/prompts/personas/ceo.md`
- Tone: `!cat ${CLAUDE_PLUGIN_ROOT}/prompts/tones/executive.md`
- Plain superpowers list: `${CLAUDE_PLUGIN_ROOT}/prompts/shortcuts/superpowers-bridge.md`

## Procedure

1. `!cat` CEO persona and executive tone (two `!cat` lines above).
2. Invoke `Skill(skill: "superpowers:brainstorming")` with **`$ARGUMENTS`** as the brainstorming topic.
3. Shape the final output per persona: lead with the **decision ask**, then **three bullets** of context, **options A/B** when tradeoffs exist.
4. Add `suggested_next:` one of `jstack:prioritize`, `superpowers:writing-plans` (when available), or `jstack:notion-planning` if the user wants to commit the best ideas.

## Failure modes

| Symptom | Recovery |
|---------|----------|
| superpowers plugin not installed | Summarize the recipe from `composites.md` and run a minimal brainstorm using persona + tone inline. |
| Empty `$ARGUMENTS` | Ask one question: what problem or opportunity to explore. |

## Output shape

- **Decision ask** (one sentence) as the first paragraph after persona context.
- **Context** (three short bullets) then **options** when tradeoffs exist.
- **`suggested_next:`** one line (see Chaining) when a follow-up skill is clear.

## Chaining

- Primary delegate: `superpowers:brainstorming` (via Skill tool per Procedure).
- After results: set `suggested_next:` to one of `jstack:prioritize`, `superpowers:writing-plans` (when available), or `jstack:notion-planning` per user intent.

## User request

$ARGUMENTS

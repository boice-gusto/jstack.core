---
name: jstack-ceo-brainstorm
description: "Alias jstack:ceo-brainstorm — CEO persona + executive tone, then superpowers:brainstorming. Use when the user wants exec-lens ideation."
category: shortcuts
effort: high
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->
<!-- Delegates to superpowers:brainstorming, an external plugin skill, not a jstack catalog entry -- see ## Chaining below. No chains-to comment here since validate-chains only resolves jstack:<slug> tokens. -->

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

## Domain rules — composites

1. **Persona and tone must change the output, not just decorate the top of it.** If the CEO persona and executive tone are `!cat`'d but the final answer reads identically to a generic brainstorm, the composite added nothing — the decision-ask-first shape in Output shape is the check.
2. **Do not re-implement `superpowers:brainstorming`'s own facilitation logic here.** This skill's only job is persona + tone + delegation; duplicating the brainstorming procedure inline creates two copies of the same logic that drift apart over time.
3. **CEO framing is a communication lens, not new authority.** Persona-shaped output must not assert company facts, decisions, or approvals that weren't actually given — the persona changes *how* something is said, never *what* is asserted as true.

### Named anti-patterns

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| Copying `superpowers:brainstorming`'s steps into this file | Creates a second copy of the same logic that goes stale independently | Delegate via `Skill(skill: "superpowers:brainstorming")`; keep this file to persona + shaping only |
| Using "CEO says" framing to assert an actual company decision | Persona is a tone lens the user asked for, not a real executive's sign-off | Keep recommendations labeled as the model's synthesis, not a real person's statement |
| Skipping the decision-ask-first shape because the delegate already produced good ideas | Defeats the reason this composite exists — leadership framing means lead with the ask | Reformat the delegate's output per Output shape before returning it |

### Worked example

- *Weak:* `superpowers:brainstorming`'s raw output pasted back verbatim, no persona shaping, decision buried in paragraph four.
- *Sharp:* "**Decision ask:** Are we cutting the Q3 roadmap by one feature to hit the date, or slipping two weeks? **Context:** [three bullets synthesized from the brainstorm]. **Option A / Option B:** [from Output shape]."

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

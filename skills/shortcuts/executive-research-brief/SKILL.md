---
name: jstack-executive-research-brief
description: "Alias jstack:executive-research-brief — CEO lens + executive tone, then jstack competitive research for leadership."
category: knowledge
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->
<!-- chains-to: jstack:research-competitive -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for

Composite entry for a **short competitive / market brief** aimed at executives. Loads CEO persona and executive tone, then runs the same work as **`jstack-research-competitive`** with tighter length and “so what” emphasis. Documented as **`jstack:executive-research-brief`**.

- **Out of scope:** Primary research, customer calls, or legal review of external claims.

## Config and references

- Questions: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/question-patterns.md`; discrete choices: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/ask-user-question-patterns.md`
- Recipe: `${CLAUDE_PLUGIN_ROOT}/prompts/shortcuts/composites.md`
- Persona: `!cat ${CLAUDE_PLUGIN_ROOT}/prompts/personas/ceo.md`
- Tone: `!cat ${CLAUDE_PLUGIN_ROOT}/prompts/tones/executive.md`
- Target skill body: `${CLAUDE_PLUGIN_ROOT}/skills/research/competitive/SKILL.md` and `references/deep-dive.md` there.

## Procedure

1. `!cat` CEO persona and executive tone.
2. Execute the **jstack competitive research** workflow: read `skills/research/competitive/SKILL.md` and its deep-dive reference; apply **`$ARGUMENTS`** as the research question.
3. Cap **Implications** at about one page; every claim must have **source + date**; label opinion as `[judgment]`.
4. End with **one** decision or alignment ask suitable for exec readers.
5. `suggested_next:` `jstack:notion-article`, `jstack:review-project-review`, or `jstack:prioritize` as appropriate.

## Failure modes

| Symptom | Recovery |
|---------|----------|
| Integrations unavailable | Use user-pasted sources only; state gaps clearly. |
| Question too broad | Ask one scoping question (segment, region, or competitor set). |

## Output shape

- **Executive one-pager** cap: *Implications* and recommendations fit roughly one page.
- **Sources** — every non-obvious claim: **source + date**; label opinion `[judgment]`.
- **Closing** — one **decision or alignment ask**; optional `suggested_next:`

## Chaining

- Competes with full **`jstack-research-competitive`**: this shortcut adds CEO + executive tone first; `suggested_next:` often `jstack:notion-article`, `jstack:review-project-review`, or `jstack:prioritize`.

## User request

$ARGUMENTS

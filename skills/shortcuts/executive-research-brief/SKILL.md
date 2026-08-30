---
name: jstack-executive-research-brief
description: "Alias jstack:executive-research-brief — CEO lens + executive tone, then jstack competitive research for leadership."
category: shortcuts
effort: high
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

## Domain rules — executive-research-brief

1. **"About one page" means something checkable.** Treat the cap as roughly 400–500 words of Implications + recommendation — if the draft is clearly longer, cut before adding more sourcing, not after.
2. **Every non-obvious claim carries a source and a date**, matching the Output shape rule already stated — a claim with a source but no date (or vice versa) doesn't meet the bar; the reader needs to judge freshness, not just provenance.
3. **Opinion is always labeled `[judgment]`, even under executive tone.** Confident, decisive language is a tone requirement; asserting an unlabeled opinion as fact is not the same thing as writing with confidence.
4. **One decision ask, not a menu.** This shortcut's format exists specifically so leadership doesn't have to parse three options; if the request needs real optionality, that's `jstack:advice`'s decision-brief format, not this one.

### Gate — ready to send vs revise

| Signal | Verdict |
|---|---|
| Every non-obvious claim has both a source and a date | Approve |
| Draft is clearly over ~500 words of Implications/recommendation | Revise — cut before sending |
| Any opinion sentence lacks a `[judgment]` label | Revise — label or cut it |
| More than one decision ask present | Revise — route the extra options to `jstack:advice` |

### Named anti-patterns

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| Citing a competitor claim with no date | "Competitor shipped feature Y" without a date can't be checked for freshness — markets move | Attach the date the source was published or the date you accessed it |
| Padding past one page as "thoroughness" | Defeats the entire purpose of an executive brief — the length cap is the product | Cut supporting detail before cutting the decision ask or sourcing |
| Blending `[judgment]` opinion into an unlabeled sourced claim in the same sentence | Reader can't tell what's checkable and what's the model's read | Split into a sourced clause and a separately labeled `[judgment]` clause |
| Presenting multiple options when the user asked for a brief, not a decision doc | Confuses this shortcut's format with `jstack:advice`'s decision-brief format | Give one decision ask; route to `jstack:advice` if real optionality is needed |

### Worked example

- *Weak:* "Competitors are moving fast in this space and we should probably think about responding."
- *Sharp:* "[Competitor] shipped [feature] on [date] per [source] — third public launch in this category in 90 days. `[judgment]`: this suggests the category is consolidating faster than our current roadmap assumes. **Decision ask:** approve pulling [our feature] forward one sprint, or accept the gap through Q3."

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

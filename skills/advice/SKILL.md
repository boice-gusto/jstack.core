---
name: jstack-advice
description: Strategic and design counsel—stakeholder-aware options, tradeoffs, and a clear recommendation. Use for leadership/EM/product/design dilemmas, prioritization of principles, 1:1 or exec prep, or when the user wants named perspectives (not generic brainstorming). Grounds in team KB and gbrain when configured; never invents org policy.
category: advice
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config, optional gbrain/Notion context -->
<!-- outputs: structured_result (see Output formats below) -->
<!-- Note: this skill is often terminal; hand off to notion/article or knowledge-intake when the user wants a written artifact. -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for

- **In scope:** One-way or two-way **decisions** (what to do next), **reframes** of a problem, **stakeholder maps**, **principle tradeoffs** (speed vs quality, build vs buy), **1:1 / exec / board prep** (what to say, what to ask, what not to open).
- **Out of scope:** Writing production code, running integrations on the user’s behalf, legal or medical advice, or **replacing** HR/therapy. If the user needs a **stored doc**, hand off after producing an outline (see [Handoffs](#handoffs)).

## Config and context (read before answering)

- **Question UX:** Open-ended clarifiers: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/question-patterns.md`. Discrete choices when the host supports AskUserQuestion or equivalent: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/ask-user-question-patterns.md`.
- **`jstack.config.json`**
  - If `gbrain` is present, treat **team** vs **personal** context per `${CLAUDE_PLUGIN_ROOT}/skills/knowledge/references/gbrain-patterns.md`. **Do not** guess URLs; use what config exposes. If the user’s session was initialized with a default gbrain target (`session.default_gbrain_target` in defaults), respect that for “where would this be filed.”
  - **Org policy and coaching norms:** load optional slices per `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/org-context.md` (e.g. `skill_defaults.advice.org_context_slices` for `ethics`, `coaching`, `engineering_handbook`). Never invent HR policy; cite config or tool-backed text only.
  - If team Notion/Slack/Jira is referenced in the question but **not** in config, follow `question-patterns.md` once, then point to `integration-guide.md` and `jstack doctor`—**do not** simulate API results.
- **gbrain and KB**
  - If tools can reach gbrain/Notion, **pull** relevant pages or search results **before** advising. If you cannot, say what you are missing and give advice with explicit **assumptions** labeled `[assumption]`.
- **Preamble bridges**
  - Cross-plugin: `prompts/shortcuts/gstack-bridge.md` / `superpowers-bridge.md` when the user is combining stacks.

## Intake: parse `$ARGUMENTS` and the thread

1. **Classify the ask**
   - **Decision** — “Should we A or B (or hybrid)?”
   - **Narrative** — “What should I say to X about Y?”
   - **Principles** — “How do we think about Z as a team?”
   - **Review** — “Poke holes in this plan” (if multi-persona, consider `jstack:review-counsel` or `jstack:review-project` instead; still usable here if the user asked for a single “advice” pass).

2. **Fill gaps with at most one question** (if several dimensions are missing, pick the **highest leverage** one first)
   - **Audience** — Who will hear or use this? (peer EM, C-level, design partner, **self** reflection)
   - **Decision or outcome** — What is **true in the world** when this is “done” (e.g. “we committed to a date and owner,” not “we feel better”)
   - **Constraints** — Time, headcount, budget, compliance, **reversibility** (one-way door vs two-way)
   - **Risks they already accept** — e.g. “ok missing this sprint”
   - If the user **already** gave all of the above, **do not** ask; proceed.

3. **Anti-patterns**
   - Do not default to a **three-paragraph essay** if they asked for a **single slide** or **Slack post**; match **length** to their implied medium (if unclear, offer **short** default + “say `long` for memo-style” in one line).

## How to think (internal checklist)

Work through in order; **omit** sections in the final answer that add no value.

1. **Restate the problem** in one neutral sentence (no snark, no mind-reading).
2. **Name constraints** the user may have left implicit (time, people, **political** cost).
3. **Options** — Always **2–3** real options, including a **“do less”** or **“defer”** option when the decision is scope-related. Each option: **1–2 sentence** summary, **pros / cons / who loses**.
4. **Recommendation** — One clear pick with **one sentence why**; if confidence is not high, say **what you would need to know** to raise confidence (specific data, stakeholder, or experiment).
5. **Risks and unknowns** — Bullet list; distinguish **factual** unknowns (missing data) from **strategic** unknowns (competitor move).
6. **Next actions** — **Who does what** by when (even if the “who” is the user and “when” is “before Friday”). If a **follow-up doc** is needed, point to [Handoffs](#handoffs).
7. **If gbrain or KB applies** — Cite the **principle** or **past decision** in one line (“aligns with ADR-12 on public IDs”); if nothing exists, **do not** invent; say “no recorded decision; recommend writing one via `jstack:adr` or knowledge path.”

## Output formats (pick one; state which at the top)

### A — Decision brief (default)

```markdown
## Context
<one sentence>

## Options
1. **<name>** — <one line>  
   - Upside: …  
   - Downside: …  
2. **<name>** — …
3. **(optional)** <defer / do less>

## Recommendation
**<option>** because <1–2 sentences>.

## Risks / unknowns
- …

## Next steps
- …
```

### B — Stakeholder script (1:1, exec, difficult conversation)

```markdown
## Objective (60s)
<what you want from the meeting>

## Opening (optional, 1–2 lines)
<neutral framing>

## Points to make (3 bullets max)
- …

## Questions to ask
- …

## Landmines to avoid
- …

## If they say X, respond with Y (short)
| Pushback | Response |
|----------|----------|
| … | … |
```

### C — Design / product principle tradeoff (when the ask is “how should we think about…”)

- **Principles in tension** (name two)
- **Heuristic** — When to lean each way; **1 example** of applying it to their case
- **What would change our mind** — measurable signal or timebox

## Handoffs (nested workflows)

- **Notion / published writeup** — After an outline, user can run `jstack-notion-article` (`skills/notion/article/SKILL.md`) with your **section headings** and **key bullets**; give them a **copy-paste block** at the end under `## Draft outline for Notion`.
- **Knowledge capture** — If the result **is** a new team decision, suggest `jstack:knowledge-intake` + `jstack:knowledge-process` with a one-line summary to file.
- **Jira** — If the “advice” is really “turn this into tickets,” recommend `jstack:jira-intake` or `jstack:jira-create` with fields; you **do not** open Jira in this skill.

## Failure modes and recovery

| Situation | What to do |
|-----------|------------|
| No `jstack.config.json` or team context | Direct to `/jstack:setup` or `jstack setup`; give **generic** principles-only advice and label it `[principles only—configure team context for tailored advice]`. |
| User asks for **facts** you cannot verify (revenue, headcount, legal) | Do not invent; state what role should supply the fact. |
| **Emotional** crisis language | Be brief, kind, suggest human support; do not role-play therapy. |
| **Multi-persona deep review** with formal roles | Suggest `jstack:review-counsel` and `prompts/personas/*` for full pass; this skill can still do a **single** unified recommendation. |
| **gbrain** configured but unreachable | Fall back to stated assumptions; list **exact** fields or URLs the user should paste next time. |

## Micro-examples (style only; do not copy as live advice)

- **User:** “We’re split on shipping a half-done API vs delaying a week.”  
  **Shape:** three options (ship behind flag, delay, cut scope) + recommendation + one risk on customer trust.
- **User:** “How do I tell my EM I’m overloaded without sounding weak?”  
  **Shape:** stakeholder script B + one question to ask them + landmine “don’t list every task without a proposal.”

## User request

$ARGUMENTS

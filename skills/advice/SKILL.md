---
name: jstack-advice
description: Strategic and design counsel—stakeholder-aware options, tradeoffs, and a clear recommendation. Use for leadership/EM/product/design dilemmas, prioritization of principles, 1:1 or exec prep, or when the user wants named perspectives (not generic brainstorming). Grounds in team KB and gbrain when configured; never invents org policy.
category: advice
effort: high
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

| Anti-pattern | Why it's wrong | Instead |
|---|---|---|
| Wrong-medium length — a three-paragraph essay when they asked for a slide or a Slack post | Advice the recipient cannot use in the place they need it is not advice | Match length to the implied medium. If unclear, give the short version and offer `long` for memo-style in one line |
| Options without a recommendation | Hands the decision back to the person who asked for help; neutrality here is abdication, not rigour | Recommend one, say why, and state what would change your mind |
| Both-sides hedging when the evidence favours one side | Reads as balanced while withholding the actual judgement | Name the asymmetry. Hedge on confidence, never on the recommendation |
| False three-way split | Inventing a third option to look thorough makes the real trade-off harder to see | Present only options someone would genuinely choose; two is a complete set when it is |
| Mind-reading motive | Attributing intent you cannot observe invites the recipient to argue about your read of them rather than the decision | Describe the observable situation and its consequences |
| Advice the recipient cannot act on | Recommending something outside their authority or budget wastes the exchange | Scope to what this person can actually decide, or name who must decide it |
| Buried recommendation | If it appears after the analysis, a scanning reader never reaches it | Lead with the recommendation, then the reasoning |
| Confidence unwarranted by evidence | Overstated certainty is what gets quoted back when it turns out wrong | State the confidence level and the assumption it rests on |

## How to think (internal checklist)

Work through in order; **omit** sections in the final answer that add no value.

1. **Restate the problem** in one neutral sentence (no snark, no mind-reading).
2. **Name constraints** the user may have left implicit (time, people, **political** cost).
3. **Options** — Always **2–3** real options, including a **“do less”** or **“defer”** option when the decision is scope-related. Each option: **1–2 sentence** summary, **pros / cons / who loses**.
4. **Recommendation** — One clear pick with **one sentence why**; if confidence is not high, say **what you would need to know** to raise confidence (specific data, stakeholder, or experiment).
5. **Risks and unknowns** — Bullet list; distinguish **factual** unknowns (missing data) from **strategic** unknowns (competitor move).
6. **Next actions** — **Who does what** by when (even if the “who” is the user and “when” is “before Friday”). If a **follow-up doc** is needed, point to [Handoffs](#handoffs).
7. **If gbrain or KB applies** — Cite the **principle** or **past decision** in one line (“aligns with ADR-12 on public IDs”); if nothing exists, **do not** invent; say “no recorded decision; recommend writing one via `jstack:adr` or knowledge path.”

## Output formats

If the user did not specify a format and the ask is not obviously one type, use **AskUserQuestion** after classifying the ask (Step 1 of Intake):

```
question: "Which output format fits best?"
header: "Format"
options:
  - label: "Decision brief"
    description: "Default. Options, recommendation, risks, next steps."
    preview: |
      ## Context
      [One sentence framing the decision]

      ## Options
      1. **[Name]** — [1 line]
         - Upside: …
         - Downside: …
      2. **[Name]** — …
      3. (optional) Defer / do less

      ## Recommendation
      **[Option]** because [1–2 sentences].

      ## Risks / unknowns
      - …

      ## Next steps
      - …
  - label: "Stakeholder script"
    description: "For 1:1s, exec conversations, or difficult asks."
    preview: |
      ## Objective (60 sec)
      [What you want from this conversation]

      ## Opening
      [1–2 lines of neutral framing]

      ## Points to make (3 bullets max)
      - …

      ## Questions to ask
      - …

      ## Landmines to avoid
      - …

      | If they say… | Respond with… |
      |--------------|---------------|
      | … | … |
  - label: "Principle tradeoff"
    description: "For 'how should we think about X' asks. Names the tension."
    preview: |
      **Principles in tension:**
      - [Principle A] vs [Principle B]

      **Heuristic:** Lean toward A when [condition]; lean toward B when [condition].

      **Applied to your case:** [1 sentence]

      **What would change our mind:** [measurable signal or timebox]
```

## Domain rules — advice

1. **Recommend, don't just enumerate, when you have enough information to have an opinion.** Three options with no pick is a menu, not advice — if the evidence favors one path, say so with the one-sentence why (Step 4 already requires this); reserve "no pick" for genuine toss-ups where the deciding factor is the user's risk tolerance or politics, not a fact you could look up.
2. **Never manufacture a false three-way split to look balanced.** If two options are real and the third is a strawman included only for the appearance of rigor, drop the strawman — it wastes the reader's attention and quietly signals the "safe" middle was predetermined.
3. **Lead with the recommendation, not the reasoning.** A reader who stops after the first sentence should still know what you'd do; burying the pick under three paragraphs of context optimizes for the writer's thinking process, not the reader's decision speed.
4. **Distinguish a values call from a facts call before recommending.** If the blocker is missing data, say what data and who supplies it (Step 5 already asks this) — don't dress up an unresolved factual question as "it depends on your priorities."
5. **A recommendation with no stated confidence is not more useful for being confident-sounding — it's less auditable.** Say what would change your mind; a reader who later gets that information can act without re-opening the whole question.

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

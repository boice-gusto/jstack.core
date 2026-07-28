---
name: jstack-prioritize
description: Rank a list using RICE, WSJF, value/effort, or a user-provided rubric. Show scores and cutline.
category: prioritize
effort: medium
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Turn a list (from recon, user paste, or Jira filter) into a ranked order using RICE, WSJF, value/effort, or a custom rubric. Show a scored table with cutline.
- **Out of scope:** Creating tickets or executing the top item — those require linked skills.

## Domain rules — prioritize

**Absolute rules**

1. Never publish a score without first naming the framework and showing the inputs. A number with no formula behind it is not reproducible by a second reviewer — it is an opinion wearing a table.
2. RICE inputs use the standard scales only: Impact = massive 3x / high 2x / medium 1x / low 0.5x / minimal 0.25x; Confidence = high 100% / medium 80% / low 50% ([Intercom — RICE](https://www.intercom.com/blog/rice-simple-prioritization-for-product-managers/)). A confidence value outside {100, 80, 50}% signals someone picked a number to make the score come out right — reject it and ask which tier it actually is.
3. WSJF is `Cost of Delay ÷ Job Size`, where Cost of Delay = Business Value + Time Criticality + Risk Reduction/Opportunity Enablement, each scored on a relative Fibonacci-like scale (1, 2, 3, 5, 8, 13, 20) ([Scaled Agile Framework — WSJF](https://framework.scaledagile.com/wsjf/)). Job Size uses the same scale — never a different unit (hours vs points) than the value inputs, or the ratio is meaningless.
4. A ranking built entirely on estimated inputs (reach, impact, confidence, job size) must be labeled `[estimate]` in the output, not presented with the same authority as a ranking built on measured usage data. The two are not interchangeable, and hiding the difference lets a shaky guess outrank a well-evidenced item purely on formatting.
5. Criteria are set before scoring, never re-derived after seeing which item "should" win. If a scoring column's weight or scale changes after a preferred answer is visible, that is not recalibration — it is reverse-engineering a foregone conclusion (the HiPPO failure mode: authority substituting for evidence).
6. Every ranked list ends with an explicit cutline and an explicit deferred list. Silently dropping items below the line hides the trade-off; "not shown" is not the same as "considered and deferred."
7. Kano classification requires the paired importance/satisfaction question pattern, not a single "would you like this" question — a single question cannot distinguish must-be from indifferent ([Kano model](https://en.wikipedia.org/wiki/Kano_model)).

## Thresholds

| Signal | Threshold | Why |
|---|---|---|
| RICE confidence | Only 100% / 80% / 50% are valid values | Matches the standard scale; any other number is an unlabeled guess dressed as precision ([Intercom](https://www.intercom.com/blog/rice-simple-prioritization-for-product-managers/)) |
| WSJF job size | Fibonacci-like scale 1–20; a job sized >20 (or "can't size it") | Must be decomposed before scoring — an unsized job breaks the ratio for every other item on the same list ([SAFe](https://framework.scaledagile.com/wsjf/)) |
| RICE impact | Only 3x / 2x / 1x / 0.5x / 0.25x | Five fixed multipliers, not a free-text 1–10 impact guess |
| Cutline recompute | Any time total capacity or team size changes by roughly 20% or more, or the org's approval threshold for scope changes is crossed (pull the actual number from `skill_defaults.prioritize` — do not invent it) | A cutline computed against stale capacity silently promotes work that should have been re-evaluated |

## Anti-patterns

| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Scoring without naming the framework | Unreproducible — a second reviewer can't check the arithmetic or challenge an input | State RICE/WSJF/Kano/custom explicitly, with every input shown, before the score appears |
| Reach measured in raw total users | Inflates low-value-per-user features that happen to touch everyone | Define reach as the segment actually affected per period, not the whole install base |
| Confidence set from conviction, not evidence | A 100% confidence with no data behind it multiplies a guess by 1.0 and calls it certainty | Confidence maps to evidence: 100% = validated data/experiment, 80% = partial data, 50% = opinion only — no confidence claim without naming which |
| Silent cutline | Hides which items got cut and why, so the trade-off can't be challenged | Publish the deferred list alongside the ranked list every time |
| Re-scoring after seeing the "wanted" winner | HiPPO in a spreadsheet: authority overrides the framework instead of feeding into it | Freeze criteria and weights before scoring; treat a late executive opinion as one more input to the next cycle, not a script edit to this one |

## Worked example

- *Weak:* "I ranked these: mobile push notifications, then billing export, then the onboarding tweak." No formula, no inputs, no cutline — this is one person's gut order.
- *Sharp:* "RICE, standard scales: billing export scores 400 (reach 500 accounts/quarter × impact 2x × confidence 80%, based on 40 support tickets citing it, ÷ effort 0.2 person-months). Mobile push scores 90 (reach 2,000/quarter × impact 1x × confidence 50% — unvalidated hunch about engagement ÷ effort 2.5). Onboarding tweak scores 60. Cutline: ship billing export and mobile push this cycle `[estimate]` since mobile push confidence is only 50%; onboarding tweak is deferred and gets re-scored once we have activation data instead of a guess."

## What this skill must not do

- Does not create or transition tickets — output is a scored table and cutline, not a Jira mutation (hand off to `jstack:jira-intake`/`jstack:jira-create`).
- Does not invent this org's actual reach, revenue, or effort figures — pull from provided data or ask; an unlabeled invented number is worse than a stated `[assumption]`.
- Does not rank or compare people — this scores work items, never a stack-rank of who is more valuable to the team.
- Does not treat a roadmap position produced here as a delivery date commitment; sequencing is not a promise.

## Config and references
- `jstack.config.json` — team ids, integrations, `skill_defaults`, `jira_rules`, `notion`, `gbrain`. Never hardcode.
- Questions (open-ended, one at a time): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/question-patterns.md`
- Discrete choices (when the host supports AskUserQuestion or equivalent): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/ask-user-question-patterns.md`
- Integrations: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/integration-guide.md`
- Chaining: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/chaining-guide.md`

## Intake
1. Parse `$ARGUMENTS` — note whether the user **pasted** data or is asking you to **query** a system.
2. If a required id is missing, ask **one** focused question; otherwise use config defaults (label assumptions as `[assumption]`).
3. If the request bundles multiple unrelated goals, handle the first and offer to continue.

## Procedure
### Step 1 — Load config
Read relevant keys from `jstack.config.json`. If the integration is missing or unhealthy, say so and point to `jstack setup` / `jstack doctor` instead of faking data.

For methodology, examples, and templates for this skill, read:
!cat ${CLAUDE_PLUGIN_ROOT}/skills/prioritize/references/deep-dive.md

### Step 2 — Plan the safe path
State the ranking criteria before you rank, not after the order is chosen. Make the cutline explicit and say what falls below it. Do not present a ranking as objective when its inputs were estimates.

### Step 3 — Execute
Apply the configured rubric (RICE, WSJF, value/effort) or a user-provided one to each item.
- Show one scored table with all items ranked. Label subjective columns as `[judgment]`.
- Draw a cutline: items above = recommended scope, items below = parking lot.
- If two items tie, use explicit tie-break rules (revenue, risk, date); if still tied, ask one question.

### Step 4 — Validate
Confirm the criteria were stated before ranking, the cutline is explicit, and estimate-based inputs are labelled as estimates.

### Step 5 — Summarize and hand off
State what changed, what to verify, and suggest **one** next jstack skill if the work naturally continues.

## Output shape
Use a domain-appropriate heading, then:
- **Summary** (2–4 sentences)
- **Details** (bullets, table, or structured fields)
- **Next steps** with owner + timeline if known
- **Limitations** (partial data, no write access, etc.)
- For eval-gated skills, end with `result_ok: true` or `result_ok: false` + reason

## Failure modes

| Symptom | Recovery |
|---------|----------|
| Missing config / integration | Point to `jstack setup` or `jstack doctor`; do not continue with invented ids. |
| Auth / 403 / expired token | Stop; tell user to refresh credentials. Never print secrets. |
| Ambiguous goal | One clarifying question; if still unclear, present options A/B. |
| Scores are entirely subjective | Label all columns `[judgment]`; surface the rubric used. |

## Chaining
Complete the work here. If a natural follow-up exists, add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

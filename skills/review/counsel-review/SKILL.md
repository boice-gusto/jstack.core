---
name: jstack-counsel-review
description: Multi-persona review (CEO/PM/eng/QA/design) with synthesis and tensions. Not vote-counting by title.
category: review
effort: high
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md
Load the policy this domain is governed by (do not restate it from memory):
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/policies/review-policy.md
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/personas/ceo.md
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/personas/pm.md
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/personas/engineer.md
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/personas/qa.md
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/personas/designer.md
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/personas/security.md

## What this skill is for
Reconcile multiple persona lenses into one verdict, attributing each concern to the lens that raised it and stating what would change the call.
- **Out of scope:** Manufacturing consensus by dropping a dissenting lens, and issuing a verdict without naming the lenses consulted.

## Domain rules — counsel-review

### Absolute rules

1. **Never vote-count.** "4 of 5 lenses approved" is not a verdict — severity and evidence quality
   decide, not headcount.
2. **Every finding is attributed to the lens that raised it.** An unattributed "there are concerns
   about X" has already lost the information a reader needs to weigh it.
3. **A minority objection blocks the verdict when it is high-severity and well-evidenced**,
   regardless of how many other lenses stayed silent on it — silence from lenses outside their
   expertise is not disagreement with the one that spoke.
4. **Separate factual disagreement from values/priority disagreement.** "Does this lock the table
   for 40 minutes" is checkable — resolve it with evidence before it reaches the user. "Is a
   40-minute lock acceptable given the launch date" is the user's call, not this skill's to
   adjudicate by fiat.
5. **Never average two opposed positions into a synthetic middle ground nobody argued for.** If one
   lens says ship and another says block, the output states both and names the actual
   disagreement — it does not quietly produce "proceed with caution."
6. **Hold each lens against its own material before comparing.** Synthesizing from a guess at what
   a persona "would probably say" produces one voice wearing several hats, not multi-perspective
   review.
7. **State severity and confidence as two separate axes.** A finding can be high-severity and
   low-confidence at once ("if true, this blocks ship, but it's unverified") — collapsing that into
   one adjective hides exactly what a reader needs to check next.
8. **Unanimous approval from lenses shown the same shallow summary is not strong evidence.** Treat
   an unexplained 5-for-5 as a possible consensus-theater signal worth a second, deeper pass before
   reporting it as agreement.

### Thresholds

| Signal | Threshold | Source |
|---|---|---|
| Confidence band | High ≥80% (directly verified) · Medium 50–79% (plausible, unverified) · Low <50% (speculation) | judgment convention — state the band, not a bare adjective |
| Individual accuracy alone, unambiguous judgment | >99% correct with no group pressure present | [Asch conformity experiments](https://en.wikipedia.org/wiki/Asch_conformity_experiments) |
| Conformity under unanimous wrong-group pressure | 35.7% of individual trial responses conformed; 74% of participants conformed at least once across 12 trials | [Asch conformity experiments](https://en.wikipedia.org/wiki/Asch_conformity_experiments) |
| Minority-objection override bar | One high-severity, evidenced objection outweighs several low-severity approvals — never a nose count | structural rule (Prime Directive 3), not a vote |

### Named anti-patterns

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| Vote-counting | Treats headcount as evidence when severity and evidence quality are what actually matter | Rank by severity × confidence; state that a lone objection is blocking and why |
| Averaging conflicting positions | "Ship with monitoring" when nobody argued for that middle ground invents a position out of thin air | State both positions, name what they actually disagree about, let the user decide |
| Dropping the dissent | A lens's objection quietly disappears from the summary because it complicates a clean verdict | Every dissent meeting the severity bar appears, attributed, even if the final call overrides it |
| Unattributed synthesis | Rewriting findings in the synthesizer's own voice loses which lens actually raised each one | Tag every finding with its source lens; paraphrase closely, don't rewrite with new confidence |
| Consensus theater | All lenses "approve" because they were shown one shared surface-level summary, not their own checklist | Run each lens against its own material and hard-reject list independently before comparing |
| Blending factual and values disagreements in one line | Flattens a checkable claim into the same bucket as an unresolvable priority call | Tag each finding factual or values/priority; resolve factual ones with evidence first |

### Worked example

- *Weak:* "The team reviewed the migration plan and everyone thinks it's basically fine, just
  tighten up the rollback section."
- *Sharp:* "**Engineer lens** (high confidence, factual): the migration in `migrate_v2.sql` adds a
  `NOT NULL` column with no down-migration — checked directly, not disputable, ~1 day to add.
  **PM lens** (values/priority): launch date is fixed by a partner contract; a 1-day slip risks a
  penalty clause. **Tension:** this is not a facts disagreement — both lenses agree the
  down-migration is missing. The real tension is whether a 1-day slip against a contractual
  penalty is acceptable. **Verdict: revise** — add the down-migration regardless of date (checkable,
  not optional); the date-vs-penalty tradeoff is the user's call, not resolved here. What would
  change it: if the down-migration already exists in a shared runbook, this drops from blocking to
  a minor note."

### What this skill must not do

- Does not invent a lens's opinion when its persona material is unavailable — skip that lens
  explicitly and say so.
- Does not perform the single deep technical read itself — `jstack:review-code-review` owns
  line-level diff findings; this skill reconciles perspectives that already exist.
- Does not resolve a values/priority tension on the user's behalf — it names the tension and the
  evidence that would move it, then asks.
- Not a substitute for a real-time, no-time-to-hold-lenses-independently decision — if there isn't
  time to run each lens on its own material, say so rather than faking a synthesis.

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

### Step 2 — Plan the safe path
Read the whole change before commenting on any part of it. Separate blocking findings from suggestions, and cite `file:line` for each. Do not approve based on a summary you did not verify. Rank by severity, not by reading order.

### Step 3 — Execute
Multi-persona (CEO/PM/eng/QA/design) with synthesis and tensions. Not vote-counting by title.

### Step 4 — Validate
Confirm every finding cites a real location and that severities are ordered. Confirm you did not present a preference as a defect. State explicitly what you did not review.

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
| No artifact to review | Ask for doc link, paste, or file path. Do not improvise a review. |

## Chaining
Complete the work here. If a natural follow-up exists, add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

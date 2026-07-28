---
name: jstack-self-eval
description: Self-assessment on a 9-grid with one growth goal for next 2 weeks. Not formal HR input unless user says so.
category: self
effort: high
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Produce a self-assessment on a 9-grid with one concrete growth goal for the next two weeks. Treat it as personal reflection, not formal HR input, unless the user says otherwise.
- **Out of scope:** Submitting or publishing the eval anywhere — it stays a draft for the user.

## Domain rules — self/eval

**Absolute rules**

1. Every impact claim needs at least one concrete, dated example behind it. A claim with no example attached is an impression, not an assessment — if you can't name the instance, don't make the claim.
2. Self-ratings must be calibrated against evidence, not confidence alone. Research on self-assessment accuracy found bottom-quartile performers grossly overestimate their ability, while top-quartile performers underestimate theirs — in one study, top performers scoring in the 86th percentile rated themselves at only the 68th ([Dunning–Kruger effect](https://en.wikipedia.org/wiki/Dunning%E2%80%93Kruger_effect)). Both directions are miscalibration; neither confident overclaiming nor reflexive underclaiming is more "humble" or more honest by default — evidence decides, not instinct.
3. An activity list is not an impact statement. "Attended 12 meetings," "reviewed 40 PRs," and "shipped feature X" are outputs; none of them says what changed as a result. Every bullet needs the consequence named, not just the action taken.
4. "Shipped X" is not impact without the consequence attached. Shipping is an output; impact is what shipping X caused — a metric that moved, a workflow that got faster, an incident that stopped recurring ([output vs. outcome](https://productschool.com/blog/analytics/output-vs-outcome); [Intercom — ship outcomes, not features](https://www.intercom.com/blog/outcomes-vs-features/)). If the consequence can't be named, say so rather than implying it by proximity.
5. Growth framing names a next behavior, not a trait. "Be more strategic" is unfalsifiable and unactionable; "in the next planning cycle, write the problem statement before proposing a solution" is a specific, checkable behavior change.
6. Exactly one growth goal per eval cycle, stated as a behavior with a timeframe — not a list of aspirations that dilutes into nothing being prioritized.
7. This is personal reflection, not formal HR input, unless the user explicitly says otherwise — do not imply institutional weight the artifact doesn't have.

## Thresholds

| Signal | Threshold | Why |
|---|---|---|
| Evidence per claim | ≥1 concrete, dated instance per impact claim | Zero examples means the claim is an impression, not a self-assessment |
| Activity-vs-impact ratio | If most bullets name an action with no stated consequence, flag the draft as activity-heavy | An eval that is majority activity-listing under-serves the actual question ("what changed because of this work") |
| Growth goals | Exactly 1 named next-behavior goal per cycle | More than one dilutes focus; zero means the eval has no forward motion |
| Self-rating vs. evidence gap | A rating that moves >1 tier (e.g., "exceeds" to "meets") from what the cited evidence supports, in either direction | Matches the calibration failure pattern in both directions — over- and under-claiming both need a check against the actual examples listed |

## Anti-patterns

| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Listing activities as accomplishments | "Shipped X, attended Y, reviewed Z" says nothing about effect | Attach the consequence: what metric, workflow, or outcome changed because of the activity |
| Rating from confidence instead of evidence | Confident self-assessment with no examples is exactly the overclaiming pattern the research warns about | Write the examples first, then let the rating follow from what they actually show |
| Reflexive underclaiming by strong performers | Understating real impact denies the evidence the same way overclaiming does — both are miscalibration | Check the rating against the evidence list, not against a feeling of not wanting to overstate |
| Growth goal as a trait ("be more proactive") | Unfalsifiable — no way to check in two weeks whether it happened | Restate as a specific behavior with a timeframe ("propose the next sprint's risk list before planning starts") |
| Comparing self to named peers | Turns a personal reflection into a ranking exercise and drags another person's performance into a document about your own | Describe your own evidence only; if comparison is unavoidable, describe the situation, not the peer by name |

## Worked example

- *Weak:* "This quarter I shipped the onboarding redesign and helped out with the migration. I think I did strong work and should be rated highly."
- *Sharp:* "Shipped the onboarding redesign (Mar–Apr); activation rate for new signups went from 41% to 53% over the following four weeks (evidence: analytics dashboard, dated). Supported the database migration by writing the rollback script that was used when the first attempt failed, avoiding a second full migration window. Next-behavior goal: write the rollback/revert plan before starting a migration, not after the first attempt — this quarter it was reactive."

## What this skill must not do

- Must not become a judgment of a person's worth or character — it evaluates specific, evidenced work in a period, not the person as a whole.
- Must not include another person's PII or performance detail. If teammates appear, name only their role in a shared outcome ("paired with the on-call engineer to..."), never their personal information or an assessment of their performance.
- Must not submit or publish itself anywhere — it stays a draft for the user unless the user explicitly says this is formal HR input.
- Must not fabricate a metric or outcome to make an impact claim look stronger than the evidence supports.

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
Personal target by default; write to a shared store only when the user asks explicitly. Never place another person's performance data or PII in a personal or team note.

### Step 3 — Execute
Self assessment only. Suggest one growth goal for next 2 weeks.
- Do not use as formal HR input unless user says so.

### Step 4 — Validate
Confirm the write went to the personal target unless explicitly told otherwise, and that no other person's PII or performance data is present.

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
| Emotional crisis language | Be brief, kind; suggest professional support. Do not role-play therapy. |
| User pastes a secret | Refuse to store; tell them to rotate immediately. |

## Chaining
Complete the work here. If a natural follow-up exists, add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

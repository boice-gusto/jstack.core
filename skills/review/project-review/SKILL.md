---
name: jstack-project-review
description: Review a project update for schedule, scope, risk, and stakeholder issues. Factual errors vs strategy issues.
category: review
effort: high
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Review a project update for schedule, scope, risk, and stakeholder issues. Factual errors vs strategy issues.

## Domain rules — project-review

### Absolute rules

1. **A status with no updated evidence for a full reporting cycle is Amber, not Green.** Silence
   is not "no news is good news" — it is itself a signal that must be reported as such.
2. **RAG color must trace to a measurable, pre-agreed trigger, not a feeling.** If no threshold was
   set, say that explicitly rather than assigning a color from vibes.
3. **Name which of three causes explains a schedule slip: scope growth, underestimation, or
   blockage.** A bare "we're behind" line conflates causes that need different fixes — descoping
   fixes scope growth, re-estimating fixes underestimation, neither fixes an external blocker.
4. **A status that jumps directly from Green to Red is itself a reporting failure**, independent of
   whatever caused the underlying delay — flag the missing Amber step, not just the current color.
5. **Never accept "done" on say-so.** A milestone is complete only against the artifact or evidence
   it was defined to produce; ask for it before marking it closed.
6. **Schedule confidence must scale with project phase.** An estimate made at kickoff carries far
   more uncertainty than one made after detailed design — an unrevised kickoff-era number still
   being reported at execution time is itself a red flag.
7. **A recovery plan attached to Amber or Red names an owner and a date.** "We'll monitor" is not a
   plan; it's a status with the accountability removed.

### Thresholds

| Signal | Threshold | Source |
|---|---|---|
| Schedule variance | Green ≤5% behind plan · Amber 5–15% behind · Red >15% behind with no approved recovery plan | [ClearPoint Strategy — RAG status for KPIs](https://www.clearpointstrategy.com/blog/establish-rag-statuses-for-kpis) |
| Budget variance | Green ≤10% over · Amber 10–20% over · Red >20% over | [ClearPoint Strategy — RAG status for KPIs](https://www.clearpointstrategy.com/blog/establish-rag-statuses-for-kpis) |
| Estimate uncertainty (Cone of Uncertainty) | Initial concept: 4x–0.25x (16x spread) narrowing to ~1.1x–0.9x once detailed design is complete | [Construx — The Cone of Uncertainty](https://www.construx.com/books/the-cone-of-uncertainty/) |
| Stale-status window | No new evidence for 1 full reporting cycle → report Amber, not the prior color | [Reworked — "Why Everything's Green Until It's Red"](https://www.reworked.co/collaboration-productivity/the-yellow-zone-why-perfect-status-reports-are-killing-your-projects/) |

### Named anti-patterns

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| Watermelon status (green outside, red inside) | The report says Green while anyone on the ground knows it's in trouble | Attach RAG to objective, pre-agreed triggers; escalate on evidence, not optimism |
| "Green until suddenly Red" | By the time it's undeniably Red, it's usually too late to recover cleanly | Require Amber as a mandatory intermediate step once a trigger is crossed |
| One "behind schedule" line covering three different causes | Hides which lever actually fixes it — cutting scope doesn't fix a blocked dependency | Name the specific cause (scope growth / underestimation / blockage) and its specific fix |
| Reusing a kickoff-era estimate unrevised at execution | Cone of Uncertainty implies 2–4x error at that phase; treating it as still accurate is itself a risk | Re-estimate at each phase gate and disclose whether the range actually narrowed |
| "We'll monitor" as the stated recovery plan | No owner, no action, no date — not actually a plan | Name an owner, a concrete action, and a date to re-check |
| Scope growth absorbed silently with no rebaseline | The original schedule becomes meaningless but is still reported against it | Rebaseline explicitly and disclose that the comparison point moved |

### Worked example

- *Weak:* "The project is a bit behind but should be fine, team is working hard."
- *Sharp:* "Status: **Amber** (was Green last cycle, no rebaseline since). Schedule variance is 11%
  behind the approved baseline — inside the Amber band (5–15%) — driven by two integration
  requirements the sponsor approved on [date], not by underestimation of the original scope. This
  is scope growth, not blockage: no external dependency is stalling work. Recovery: engineering
  lead owns a decision by Friday to either descope the v2 reporting item or accept a 1-week slip."

### What this skill must not do

- Does not perform the multi-persona ship/no-ship synthesis — that's `jstack:counsel-review`; this
  skill evaluates the project update itself against schedule, scope, risk, and stakeholder signals.
- Does not invent a baseline, an approval date, or a milestone definition that wasn't provided —
  ask for it or say the status can't be computed without it.
- Does not make the final go/no-ship call — it surfaces risk and a recommended color; the sponsor
  or stakeholder owns the decision.
- Not for evaluating individual contributor performance behind a slip — that's EM territory, not a
  project-status finding.

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
Schedule, scope, risk, stakeholders checklists. Separate factual errors from strategy issues.

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

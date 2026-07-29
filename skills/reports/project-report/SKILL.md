---
name: jstack-project-report
description: "Generate a stakeholder 1-pager: RAG status, milestones, risk register snapshot."
category: reports
effort: high
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Assemble a project status report: scope, schedule, risk, and the decision the reader needs to make.
- **Out of scope:** Re-planning the project, and stating a confidence level the underlying data cannot support.

## Domain rules — project-report

### Absolute rules

1. **RAG color traces to a pre-agreed, measurable trigger stated inline** (schedule variance %,
   budget variance %) — never assigned from a feeling. If no trigger was configured, say the
   color can't be computed rather than picking one anyway.
2. **A milestone is complete only against the artifact it was defined to produce** (a closed
   ticket, a signed doc, a metric hit). "The team says it's done" is not evidence; ask for the
   artifact or mark `[unverified]`.
3. **No status jumps directly from Green to Red between reports.** If the underlying source
   shows that jump, flag the missing Amber cycle explicitly as a reporting gap — the jump is
   itself a failure independent of what caused the schedule slip.
4. **Silence for a full reporting cycle is reported as Amber (stale), never carried forward as
   the prior color.** No news is not good news in a status report.
5. **Every open risk-register row carries severity, owner, and last-updated date.** A risk row
   with no last-updated date can be months stale and still look current.
6. **Label schedule/budget figures measured (from the PM tool) vs. projected (a forecast)
   distinctly.** Presenting a forecast with the same visual weight as a measured actual misleads
   a reader who assumes both carry equal certainty.
7. **This report states RAG and evidence; it does not render the go/no-go call.** That decision
   belongs to the sponsor or stakeholder this report feeds.

### Thresholds / criteria

| Signal | Rule | Source |
|---|---|---|
| RAG banding | Illustrative external bands: Green ≤5% behind, Amber 5–15%, Red >15% with no approved recovery plan — the org's actual bands are config-defined, not these figures | [ClearPoint Strategy — RAG status for KPIs](https://www.clearpointstrategy.com/blog/establish-rag-statuses-for-kpis) |
| Estimate uncertainty | Concept-phase estimates carry roughly 4x–0.25x spread, narrowing to ~1.1x–0.9x once detailed design is complete — an unrevised concept-era number reported at execution time is itself a flag | [Construx — The Cone of Uncertainty](https://www.construx.com/books/the-cone-of-uncertainty/) |
| Stale-status window | No new evidence for one full reporting cycle → report Amber, not the prior color | qualitative gate, this skill's own contract |
| Milestone completion | Requires the defining artifact; `[unverified]` otherwise | this skill's own contract |

### Named anti-patterns

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| Watermelon status (green outside, red inside) | Reported color doesn't match ground truth | Trace RAG color to a pre-agreed measurable trigger every time |
| Green-to-Red jump with no Amber cycle | Signals a reporting gap on top of the underlying slip | Flag the missing intermediate step explicitly |
| Accepting "done" without the defining artifact | A milestone marked complete that isn't | Require the artifact before marking complete |
| Risk row with a last-updated date from a prior quarter | Looks current, may be stale by months | Require a current last-updated date on every open risk |
| Forecast shown with the same weight as a measured actual | Reader can't tell certain from projected | Label forecasted figures distinctly from measured ones |

### Worked example

- *Weak:* "Project is on track, a few minor risks, nothing urgent."
- *Sharp:* "Status: Amber (was Green last cycle, no rebaseline since). Schedule variance: measured
  9% behind the approved baseline as of 2026-07-24 (source: PM-tool burndown) — driven by scope
  growth (two integration requirements approved 2026-07-10), not underestimation. Milestone 'API
  v2 complete' marked complete against merged+deployed evidence (PR #310, deployed 2026-07-15).
  Open risk: vendor SLA delay, last updated 2026-07-22, owner [role]."

### What this skill must not do

- Does not render the go/no-go decision — states RAG and evidence; the sponsor decides.
- Must not accept "done" without the defining artifact.
- Not for evaluating an individual's performance behind a slip.
- Does not invent an approval date, baseline, or milestone definition not supplied — asks instead.

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
Every figure traces to a named source with an as-of time. Mark a missing metric as `[no data]` — never interpolate it, and never drop the row silently, because omission in an authoritative-looking report misleads exactly as much as fabrication.

### Step 3 — Execute
Stakeholder 1-pager: RAG, milestones, risk register snapshot.

### Step 4 — Validate
Confirm every figure has a source and as-of time, that gaps read `[no data]`, and that the footer and scope match this report's kind. Re-run the render and confirm identical output from identical inputs.

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
| Missing data for a metric | Leave cell blank with `[no data]`; do not invent numbers. |
| Tone mismatch | Offer 2 tone options from `prompts/tones/` in one question. |

## Chaining
Complete the work here. If a natural follow-up exists (e.g. `jstack-team-report` then `jstack-share-html-publish`), add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

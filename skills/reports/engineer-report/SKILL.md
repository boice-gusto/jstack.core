---
name: jstack-engineer-report
description: Generate an individual engineer report: shipped, WIP, blockers, next. No invented metrics.
category: reports
effort: high
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Generate an individual engineer report: shipped, WIP, blockers, next. No invented metrics.

## Domain rules — engineer-report

### Absolute rules

1. **"Shipped" means merged and deployed/released** — not "opened a PR," not "merged behind a
   flag with no rollout yet." Cite the release evidence (deploy log, release tag, changelog
   entry) with an as-of date; a PR link with no merge/release confirmation is a claim, not a
   shipped result.
2. **Never invent velocity, story points, or incident counts to fill a template gap.** Mark the
   row `[no data]`. A silently blank or omitted row reads as "nothing to report," which is as
   misleading as a fabricated number.
3. **Tag every figure measured / estimated / assumed.** Measured = pulled from an integration
   (GitHub/Jira/PagerDuty API) with an as-of timestamp. Estimated = derived with a stated
   assumption. Assumed = user-supplied and unverified. Collapsing the three into one unmarked
   number lets a stale guess pass as a live measurement.
4. **A blocker names the blocking dependency and the date it was raised** — "things are slow" is
   not a blocker line; it can't be escalated or aged.
5. **This report evaluates the work, not the person.** No competence rating, no inferred-motive
   line ("isn't trying hard enough"). Requests for that route to `reports/eval-report`, and even
   there the same behavior-not-motive rule applies.
6. **One report per engineer.** Cross-engineer rollups belong to `reports/team-report` /
   `reports/manager-report` — don't fold multiple people into one report to save a step.
7. **"Next" items are already scheduled** (a ticket in next sprint, an assigned follow-up), not
   aspirational filler restating the mission. An unscheduled "next" item is `[no data]`.

### Thresholds / criteria

| Signal | Rule | Source |
|---|---|---|
| Data provenance | Every figure tagged measured / estimated / assumed with a named source and as-of date | data-hierarchy pattern from [GHG Protocol Scope 3 data hierarchy](https://ghgprotocol.org/sites/default/files/standards/Scope3_Calculation_Guidance_0.pdf) (supplier-specific → hybrid → average → spend-based, most- to least-verified), applied to eng reporting |
| Missing metric | `[no data]` — never interpolated, never silently dropped | this skill's own reporting contract |
| Blocker escalation age | Org-specific threshold comes from `jstack.config.json`; state the blocker's raised-date so age is computable, don't invent a universal day count | config-first convention |
| Pull freshness | State the as-of date/time the underlying data was pulled, distinct from the report's generation date | [W3C PROV-Overview — provenance as basis for trust](https://www.w3.org/TR/prov-overview/) |

### Named anti-patterns

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| Counting "opened a PR" as shipped | Overstates progress on work that hasn't merged or released | Require merge + deploy/release evidence before marking shipped |
| Filling a blank metric with "about the usual" | An invented figure dressed as data | Mark `[no data]` and state why the source returned nothing |
| Blockers written as mood ("things are slow") | Can't be escalated, tracked, or aged | Name the blocking dependency and the date it was raised |
| Editorializing on effort or attitude | Turns a work report into an unrequested performance judgment | Report shipped/WIP/blocked facts only; route judgment elsewhere |
| Rolling several engineers into one report | Loses the per-person accountability this report exists to provide | Generate one report per engineer; aggregate in `reports/team-report` |

### Worked example

- *Weak:* "Alex shipped some good stuff this week and is generally on track."
- *Sharp:* "Shipped: PR #482 (`auth-service`) merged and deployed 2026-07-22 — closes 2 open P2
  tickets tied to session-expiry bugs (measured, source: GitHub + Jira). WIP: PR #491, in review
  since 2026-07-24, blocked on a schema-migration review from the data team (raised 2026-07-23,
  3 days aging). Next: JIRA-1201, scheduled for next sprint."

### What this skill must not do

- Does not stack-rank this engineer against peers — that comparison, if wanted, belongs to
  `reports/manager-report`'s team-level rollup.
- Does not render a competence judgment or inferred motive about the engineer.
- Must not aggregate multiple engineers into a single report.
- Not for surfacing a metric the org hasn't wired an integration for — say `[no data]`, don't
  estimate from impression.

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
Individual weekly: shipped, WIP, blockers, next. No invented metrics. Tone: peer+manager safe.

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

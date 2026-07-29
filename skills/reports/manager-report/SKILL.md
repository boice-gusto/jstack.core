---
name: jstack-manager-report
description: Generate a manager rollup across teams without stack-ranking individuals.
category: reports
effort: high
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Assemble a manager-facing roll-up: delivery, risk, and people-signal sections at the altitude a manager acts on.
- **Out of scope:** Individual performance verdicts, and IC-identifying detail where the report redacts names by config.

## Domain rules — manager-report

### Absolute rules

1. **Never stack-rank named individuals.** Aggregate at team level; a "rollup" that reduces to a
   sorted list of ICs by output volume is performance review by another name, not a rollup.
2. **Every rollup figure states the source reports it aggregates and their as-of dates.** A
   rollup is only as fresh as its stalest input — if one team's report is two weeks old and
   others are current, disclose the mismatch rather than blending as if simultaneous.
3. **Aggregate at the altitude a manager's question requires**, not by concatenating engineer
   reports. An engineer report answers "what did I ship"; a manager rollup answers "where do I
   need to intervene" — those are different documents even when built from the same source data.
4. **Check the IC-name redaction flag in `jstack.config.json` before writing names** — don't
   assume either a redacted or a named default.
5. **A team with `[no data]` is listed as `[no data]`, never silently dropped from the roster.**
   A missing row reads as "nothing happened," not "no report submitted."
6. **Label a measured cross-team trend separately from an estimated one** (e.g., extrapolated
   from a partial reporting period) — an unlabeled extrapolation looks like a confirmed number.
7. **This report does not substitute for 1:1 feedback or a performance review.** No paragraph
   rating any named engineer's output belongs here, regardless of how it's phrased.

### Thresholds / criteria

| Signal | Rule | Source |
|---|---|---|
| Individual attribution | Zero named-individual rankings in the rollup; team-level only | this skill's own contract — see the same behavior-not-worth boundary in `reports/eval-report` |
| Source staleness | State each source report's as-of date; flag any spread greater than one reporting cycle | provenance discipline (measured/estimated/assumed convention) |
| Redaction policy | Read from `jstack.config.json`; do not assume a default in either direction | config-first convention (`CLAUDE.md`) |
| Missing team | Listed as `[no data]`, not omitted from the roster | this skill's own reporting contract |
| Audience altitude | Rollup answers a manager's trend/risk/resourcing question, not a ticket-level activity log | [Minto Pyramid Principle — conclusion first, increasing detail below](https://www.toolshero.com/communication-methods/minto-pyramid-principle/) |

### Named anti-patterns

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| Stack-ranking ICs by ticket count | Reduces a rollup to a performance ranking nobody asked this report to produce | Aggregate at team level; route individual assessment elsewhere |
| Blending reports from different as-of dates unflagged | Reader assumes simultaneity that doesn't exist | State each source's as-of date; flag the spread |
| Dropping a `[no data]` team from the roster | Reads as "nothing happened" instead of "no report submitted" | List every team; mark missing ones explicitly |
| Copy-pasting engineer-report detail wholesale | Wrong altitude — a manager audience doesn't need ticket-level detail | Summarize to the decision/trend level; link to source reports |
| Assuming a redaction default instead of checking config | Over- or under-redacts relative to actual policy | Read the flag from `jstack.config.json` before writing names |

### Worked example

- *Weak:* "Team A and Team B both had solid weeks, no real issues to flag."
- *Sharp:* "Team A (as of 2026-07-25): 14/16 committed tickets closed; one Amber risk (vendor API
  rate limit), owner [role], recheck 2026-07-30. Team B (as of 2026-07-20 — source report not
  resubmitted, 5 days stale): reported Green last cycle; treat as stale, not confirmed current.
  No individual ranking included, per the redaction flag in `jstack.config.json`."

### What this skill must not do

- Must not name and rank individual ICs — aggregate at team level only.
- Does not replace 1:1 feedback or a performance review.
- Not for blending source reports from mismatched as-of dates without flagging the mismatch.
- Does not invent a redaction policy — reads it from config.

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
Rollup across people without stack-ranking. Focus on system issues (CI, on-call, hiring).

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

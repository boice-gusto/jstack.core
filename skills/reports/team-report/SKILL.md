---
name: jstack-team-report
description: Generate a weekly team report: velocity, risks, dependencies, and 3 asks to leadership.
category: reports
effort: high
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Generate a weekly team report: velocity, risks, dependencies, and 3 asks to leadership.

## Domain rules — team-report

### Absolute rules

1. **Velocity is a measured count from the tracker** (points completed, tickets closed) for the
   stated sprint window — never a felt sense of "productive week." Report points committed vs.
   points completed so the completion rate is computable, not just asserted.
2. **Exactly the "3 asks" the template promises** — no more (dilutes what leadership should act
   on) and no fewer (looks like nothing is needed). If there are genuinely zero live asks, state
   `No asks this week — [reason]` rather than padding a fourth item.
3. **A risk with no named owner and no next check-in date is incomplete** — leadership can't act
   on a risk nobody is accountable for.
4. **Dependencies name the blocking team/system explicitly, plus the date first raised** —
   "waiting on platform team" with no raised-date can't be escalated by age.
5. **Carried-over work is labeled `carried over (Nth week)`.** Folding it back into "this week's
   completed" inflates apparent velocity and hides a slipping timeline.
6. **Report committed, completed, and added-mid-sprint as three separate counts.** Collapsing
   them into one "velocity" number hides whether the team estimates well or is absorbing
   unplanned scope.
7. **The audience is leadership above the team, not the team itself.** Omit ticket-level detail a
   standup would want; state the decision needed, not the activity log.

### Thresholds / criteria

| Signal | Rule | Source |
|---|---|---|
| Ask count | Exactly 3 named asks; 0 requires an explicit stated reason, never silent omission | this skill's own template contract |
| Risk completeness | Every risk row: owner + next check-in date; missing either blocks publish | qualitative gate, this skill's own contract |
| Committed / completed / added | 3 distinct counts, never collapsed into one velocity figure | measured/estimated/assumed provenance discipline (see `reports/engineer-report`) |
| Audience altitude | Leadership rollup states the decision needed, not an IC-level activity log | [Minto Pyramid Principle](https://www.toolshero.com/communication-methods/minto-pyramid-principle/) |

### Named anti-patterns

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| Padding to "3 asks" with a non-ask | Trains leadership to skim past the asks section as noise | State fewer asks with a stated reason if fewer are live |
| Folding carried-over work into "completed" | Inflates apparent velocity, hides a slipping timeline | Label carried-over items and their originating week |
| Risk row with no owner | Nobody is accountable to act on it | Every risk names an owner and a next check-in date |
| One velocity number blending committed/completed/added | Hides whether the team estimates well or absorbs scope creep | Report the three counts separately |
| Writing for the team's own audience (ticket detail) | Wrong altitude for a leadership report, buries the actual ask | State the decision needed, not the activity log |

### Worked example

- *Weak:* "Good week, made progress on most things, a couple of blockers."
- *Sharp:* "Velocity: 18 pts committed / 14 pts completed / 3 pts added mid-sprint (unplanned
  hotfix). Risk: vendor API deprecation, owner [role], recheck 2026-08-01. Dependency: waiting on
  the platform team for a shared-library bump, raised 2026-07-20 (5 days aging). Asks: (1) approve
  the library-bump ticket, (2) confirm Q3 headcount for the migration, (3) unblock the
  platform-team dependency."

### What this skill must not do

- Not for individual engineer detail — that's `reports/engineer-report`.
- Must not pad or shrink the ask count to hit a fixed-looking number.
- Does not substitute for a project-level RAG status — that's `reports/project-report`.
- Must not fold carried-over or added-mid-sprint work into "completed" silently.

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
Velocity narrative with caveats. Risks, dependencies, and 3 asks to leadership if applicable.

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

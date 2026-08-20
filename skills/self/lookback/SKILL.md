---
name: jstack-self-lookback
description: Review last N days of personal gbrain + calendar and surface patterns. Gentle, not therapeutic.
category: self
effort: high
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Review the last N days of personal gbrain entries and calendar context to surface patterns worth noticing, in a gentle and observational tone, not a therapeutic one.
- **Out of scope:** Diagnosing mental-health concerns — redirect to professional support if the content warrants it.

## Domain rules — lookback

Explicitly gentle and observational, not therapeutic or diagnostic — the SKILL.md's own
out-of-scope clause already redirects mental-health-adjacent content to professional support;
these rules keep the pattern-surfacing itself honest.

### Absolute rules

1. **A surfaced pattern names the dated data points behind it** ("3 of the last 5 gbrain entries
   mention the same blocked dependency"). An unsupported mood summary ("you seem stressed
   lately") is a guess dressed as an observation, not a pattern.
2. **Separate observed behavior from inferred internal state.** "Logged working past 8pm on 4 of
   the last 7 days" is observable; "you're burning out" is an inferred state this skill must not
   assert — name the observable pattern and let the user draw their own conclusion, the same
   behavior/character separation the [SBI feedback model](https://www.ccl.org/articles/leading-effectively-articles/closing-the-gap-between-intent-vs-impact-sbii/)
   draws in a work-feedback context.
3. **Suggestions name a next behavior, not a trait fix.** "Try logging blockers same-day next
   week" is actionable; "be more resilient" targets a trait and gives no next action.
4. **Stay observational and gentle.** If a surfaced pattern suggests a mental-health concern, name
   the pattern plainly and redirect to professional support — do not attempt to counsel.
5. **Only the user's own data.** This reads personal gbrain/calendar, not a teammate's; if a
   pattern only makes sense with a teammate's private data, say it can't be substantiated from
   personal data alone.
6. **State the review window explicitly** ("looking at the last 14 days"). An undisclosed window
   lets a cherry-picked range imply a trend a different window wouldn't support.
7. **This surfaces retrospective patterns; it does not evaluate performance or worth**, and does
   not feed a manager-facing artifact or `reports/eval-report` without the user's explicit choice
   to share it.

### Thresholds / criteria

| Signal | Rule | Source |
|---|---|---|
| Pattern support | ≥2 concrete, dated data points before naming a pattern; fewer is speculation | evidence-over-assertion convention shared with `reports/*` |
| Behavior vs. inferred state | Names the observed event; never asserts an internal state (burnout, disengagement) not directly evidenced | [SBI feedback model](https://www.ccl.org/articles/leading-effectively-articles/closing-the-gap-between-intent-vs-impact-sbii/) |
| Window disclosure | States the exact day range reviewed | this skill's own scope contract |
| Scope boundary | Never diagnoses; redirects to professional support when content warrants it | SKILL.md's own out-of-scope clause |

### Named anti-patterns

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| Naming a mood pattern from a single entry | One data point isn't a pattern | Require multiple dated data points before naming a pattern |
| Asserting an internal state ("burnout") from behavior | Diagnostic overreach outside this skill's remit | State the observed behavior; redirect to professional support if warranted |
| Undisclosed lookback window | Lets a cherry-picked range imply an unsupported trend | State the exact day range reviewed |
| Framing a suggestion as a trait fix ("be more resilient") | Not actionable, targets identity rather than behavior | Name a specific next behavior to try |
| Feeding a pattern into a manager-facing report without consent | Repurposes a personal reflection tool without the user's choice | Keep output personal-target by default; share only by explicit choice |

### Worked example

- *Weak:* "You seem like you've been stressed and overworked lately."
- *Sharp:* "Looking at the last 14 days (2026-07-13 to 2026-07-26): 4 of 10 gbrain entries logged
  working past 8pm, up from 1 of 10 in the prior 14-day window. Pattern: later end-of-day logging
  this period. Suggestion: try logging blockers same-day next week to see if that shifts it. Not
  a diagnosis — if this reflects something more, professional support is the right next step, not
  this tool."

### What this skill must not do

- Must not diagnose a mental-health concern — redirects to professional support when warranted.
- Does not feed a manager-facing report or evaluation without the user's explicit choice to share it.
- Not for surfacing a pattern from a single data point.

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
Last N days of personal gbrain + calendar. Surface patterns in one short section.
- Gentle tone; not therapy.
- Structure around wins, misses, surprises, one habit to change: !cat ${CLAUDE_PLUGIN_ROOT}/skills/_core/references/reflection-patterns.md

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

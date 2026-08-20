---
name: jstack-my-metrics
description: Personal throughput and review latency from GitHub/Jira. No peer comparison unless user is a people manager.
category: metrics
effort: low
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Report the individual's own delivery metrics for a period from configured sources, as distributions rather than single averages.
- **Out of scope:** Comparing the individual against teammates, and any performance judgement.

## Domain rules — metrics

### Absolute rules
1. Derive rollups from Jira/GitHub only; label gaps when data is partial.
2. DORA language is descriptive, not a percentile claim unless the user's pipeline computes them.
3. Never compare people in rank-and-yank tone; use neutral framing.
4. **Report review-latency and time-in-review as percentiles (p50/p85), never a bare average.**
   Review wait times are right-skewed — a handful of PRs stuck for days pull the mean up while
   the typical PR looks fine; the median plus a tail percentile is what actually tells the person
   whether their normal case or their bad case needs attention.
5. **Never compare raw ticket count or PR count across periods without stating whether the scope
   changed.** A jump from "5 tickets" to "12 tickets" between sprints means nothing on its own if
   the second sprint's tickets were smaller, or if the label set used to count them changed —
   state the window and, where available, points or PR-size alongside the count.

### Thresholds / criteria
| Signal | Guideline | Why |
|---|---|---|
| Review-latency reporting | Report p50 and p85 time-to-first-review together, never a bare average | Right-skewed distribution — a few stuck reviews drag the mean; percentiles separate the typical case from the tail worth escalating |
| Period-over-period ticket/PR count | Never bare count-vs-count across periods with different scope or window | A count alone can't distinguish "did more" from "the tickets got smaller" or "the window changed" |

### Named anti-patterns
| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| "I closed 12 tickets this sprint vs. 5 last sprint — I'm on a roll" | Ticket count isn't normalized for size; smaller tickets or a longer sprint window inflate the count with no more actual output | Pair the count with points or PR size, and state the window for both periods before comparing |
| Reporting "average review turnaround: 4 hours" alone | A few long-stuck PRs can sit outside the average entirely, hiding the actual pain point | Report p50 and p85 time-to-first-review side by side |
| Comparing raw PR count/size across periods with no size normalization | A period with more, smaller PRs looks "more productive" than one with fewer, larger PRs carrying equal or more actual change | State median PR size (lines changed or files touched) alongside count, or skip the comparison if size data isn't available |

### Worked example
- **Weak:** "This month I closed 14 tickets vs. 9 last month — clearly more productive."
- **Sharp:** "Tickets closed: 14 this month vs. 9 last month, but median ticket size dropped from
  ~3 points to ~1 point (label/scope shifted toward smaller bug fixes this month) — so the raw
  count isn't a fair before/after comparison. Review latency: p50 time-to-first-review held at 5
  hours, p85 rose from 1 day to 2.5 days (two PRs waited on a single reviewer who was out most of
  the week) — that tail, not the ticket count, is the actual thing worth flagging."

## Config and references

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
State the denominator and the time window before stating the number; a rate without either is unusable. Prefer percentiles to averages and say which you used. Note the data's freshness.

### Step 3 — Execute
Personal throughput and review latency. If GitHub not linked, return import instructions and a manual table template.
- No peer comparison unless user is a people manager.

### Step 4 — Validate
Confirm each number carries its denominator, window, and freshness, and that no average is hiding a distribution you should have shown as percentiles.

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
| GitHub/Jira not linked | Return import instructions and a manual table template. |

## Chaining
Complete the work here. If a natural follow-up exists, add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

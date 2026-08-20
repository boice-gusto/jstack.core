---
name: jstack-engineering
description: Quick composite snapshot of CI status, PR queue, flaky tests, and revert risk from configured repos. For DORA-banded deep analysis with thresholds and trend context, use jstack:engineering-health instead.
category: engineering
agent: Explore
context: fork
effort: high
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Summarize engineering health from configured repos: CI status, PR queue, flaky tests, revert risk.
- **Out of scope:** Modifying repos, merging PRs, or fixing CI — surface issues for humans to act on.

## Domain rules — engineering (composite roll-up)

### Absolute rules
1. Report CI status, PR queue, flaky tests, and revert risk as **four separate lines**, never collapsed into one composite score — a blended "engineering health: 78/100" hides exactly which axis needs attention, the same failure a blended DORA score produces.
2. Revert risk is defined by a concrete, checkable condition — a merge to main with a failing required check, fewer than the required approving reviews, or an actual subsequent revert commit — never an inferred "this looks risky."
3. Every PR aged past the configured stale threshold is named individually (link, author, age) — a bare "12 stale PRs" count gives nobody an actionable next step.
4. Flaky tests are reported with an occurrence count and window ("4 of the last 50 runs"), never a vague "some flakiness" — a flaky test is a leading indicator that's easy to ignore until it's quantified.
5. Only repos present in config are scanned or reported. Silently expanding scope produces noise nobody asked for and may surface data outside the requester's access boundary.
6. When one signal's integration is unavailable, say so for that signal specifically — a 3-of-4-signals report must not read as "everything is fine" by omitting the fourth.

### Thresholds
| Signal | Threshold | Source |
|---|---|---|
| PR stale threshold | >3 days open with no review activity (org-configurable) | practitioner convention; confirm against `skill_defaults` |
| Flaky test flag | >1% failure rate over the last 50 runs | [Google Testing Blog — Flaky Tests at Google](https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html) |
| Revert-risk condition | merge to main with a failing required check, or fewer than the required approvals, or a revert commit within the window | concrete, checkable definition |
| CI status roll-up | reported green/red/flaky per repo, never averaged into one org-wide color | prevents one bad repo from being diluted into a "fine" aggregate |

### Named anti-patterns
| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Collapsing 4 signals into one score | Hides which axis is the actual problem, same failure as a blended DORA number | Report CI / PR queue / flaky / revert risk as four separate lines |
| Stale-PR count with no list | Not actionable — nobody knows which PR to look at | Name each stale PR: link, author, age |
| Scanning repos outside config | Exceeds the request's boundary; may expose data outside the requester's scope | Only touch configured repos; state which repos were checked |
| Omitting an unavailable signal silently | A partial report reads as "all clear" when one axis is actually unmeasured | Explicitly mark the missing signal as unavailable |
| Reporting revert risk as a feeling | Unfalsifiable, can't be checked by a second reader | Cite the specific merge and the concrete condition it met |

### Worked example
- *Weak:* "Engineering health looks okay this week, a few PRs are getting old."
- *Sharp:* "CI: green across 4/5 configured repos; `payments-service` is flaky (3 of 50 recent runs failed, ~6%, above the 1% threshold). PR queue: 14 open, 3 stale (>3 days, no review) — oldest is #482 (opened 5 days ago, author J. Lee, no reviewer assigned). Flaky test: `test_webhook_retry` in `payments-service`, 4 of the last 50 runs. Revert risk: one merge to `main` in `payments-service` this week shipped with a failing lint check overridden by an admin merge — flagged. `billing-service`'s CI integration is not configured; that signal is reported unavailable, not assumed healthy."

### What this skill must not do
- Not the deep DORA four-keys analysis with bands and trend framing — that's `jstack:engineering-health`.
- Not a code-ownership or bus-factor investigation — that's `jstack:engineering-silo-scan`.
- Does not fix CI, merge PRs, or modify repos — surfaces findings for humans to act on.

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
Name the mechanism, not the symptom, and cite the file or component that shows it. Prefer measuring to asserting. If you cannot name the alternative to what you are criticizing, say so plainly.

### Step 3 — Execute
Query configured repos for CI status (green/red/flaky), open PR count, stale PRs (>3 days), and recent merges with failing checks.
- Flaky tests: list top offenders if data available; otherwise note the gap.
- Revert risk: flag recent main merges missing reviews or with post-merge failures.
- All data from config repos only — never scan unrelated repos.

### Step 4 — Validate
Confirm each finding names a mechanism and a location, and that any measurement you cite is reproducible.

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
| CI integration not configured | List repos from config; point to `integration-guide.md` for setup. |
| No PR data available | Return manual checklist template instead of empty table. |

## Chaining
Complete the work here. If a natural follow-up exists, add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

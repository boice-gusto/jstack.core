---
name: jstack-engineering-health
description: Summarize engineering health — CI status, PR queue, flaky tests, revert risk — from configured repos only.
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
Summarize engineering health — CI status, PR queue, flaky tests, and revert risk — using only the repos configured for this team.
- **Out of scope:** Fixing CI, merging PRs, or modifying repos — surface issues for humans to act on.

## Domain rules — engineering health

### Absolute rules
1. Report the DORA four keys as independent axes, never collapsed into one composite "health score." High throughput with high change-failure rate is fragility, not health, and a blended number hides which axis is actually the problem.
2. Every band claim ("we're High on lead time") states the metric, the measurement window, and the threshold used — a band name with no number behind it is unverifiable.
3. Report leading indicators (PR review latency, CI flake trend, deploy-frequency trend) alongside lagging ones (incident count, MTTR, change-failure rate). Lagging indicators only move after damage is already done; leading indicators are the only ones that give time to intervene.
4. Name what a healthy-looking number could be concealing before declaring health. Zero rollbacks can mean nothing risky shipped (flags off, low-blast-radius changes) rather than nothing going wrong — state which explanation the evidence actually supports.
5. Never scan or report on a repo outside the ones the user or config specified.
6. Never rank or name individuals in a health report — this is a team/repo-level rollup, not a performance review.

### Thresholds — DORA four keys
Bands per [getdx.com's 2024 DORA benchmark summary](https://getdx.com/blog/dora-metrics/); state which year's bands you're using, since DORA's own published thresholds shift release to release.

| Metric | Elite | High | Medium | Low |
|---|---|---|---|---|
| Deployment frequency | multiple/day | daily–weekly | weekly–monthly | monthly–biannually |
| Lead time for changes | <1 day | 1 day–1 week | 1 week–1 month | 1–6 months |
| Change failure rate | 0–15% | 16–30% | 16–30% | 46–60% |
| Time to restore (MTTR) | <1 hour | <1 day | 1 day–1 week | 1 week–1 month |

Additional practitioner thresholds:

| Signal | Threshold | Why |
|---|---|---|
| CI flake rate | >1% of runs over the last 50 runs | A test that fails 1-in-100 times trains the team to re-run instead of read failures — treat as a leading indicator of eroding trust in the suite, not noise ([Google Testing Blog](https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html)). |
| PR stale threshold | >3 days open with no review activity | A stale PR queue is a leading indicator of lead-time degradation before it shows up in the DORA number. |
| Revert-risk window | merge to main with a failing check or a single reviewer on a critical path | Corroborates change-failure risk before it becomes an incident. |

### Named anti-patterns
| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Composite "health score" (single 0-100 number) | Hides which axis is the actual problem; a team can raise the score by trading stability for speed (or the reverse) with no one noticing which | Report each DORA axis separately with its band; summarize as "N of 4 elite/high," never a single blended number |
| Lagging-only reporting (incidents, MTTR) | By the time these move, the damage already happened — no window to intervene | Pair with leading indicators: PR review latency, CI flake trend, deploy-frequency trend |
| "All green" dashboard with no thresholds shown | Reader can't tell if green means elite or merely "not on fire" | Always show the band/threshold next to every number |
| Cherry-picking the best repo in a multi-repo rollup | Conceals which teams actually need help; defeats the purpose of an accountability signal | Report every configured repo, including the ones that look bad |
| Deploy frequency alone read as "velocity" | Goodhart risk: deploy count can be inflated with no-op or artificially split deploys | Always pair with change-failure rate and lead time — the four keys are meant to be read together |

### Worked example
- **Weak:** "Our engineering health score is 82/100, we're doing great."
- **Sharp:** "On the four DORA keys: deploy frequency is High (daily-to-weekly), lead time is Elite (<1 day), but change-failure rate is Low (46–60%, i.e. under half of deploys need a follow-up fix) and MTTR is Medium (1 day–1 week). A single blended score would have averaged the great lead time against the bad failure rate and reported 'fine' — the actual finding is we ship fast but too much of what we ship breaks, and it takes too long to notice. That's a review/test-quality problem, not a throughput problem. The leading indicator worth watching is PR review latency, which has been trending up over the last 4 weeks — consistent with rushed reviews driving the failure rate."
- The sharp version names the concealed axis (failure rate hidden by a blended score), cites the evidence (the band table plus the trending leading indicator), and points at the actual fix (review quality, not "go faster").

### What this skill must not do
- Not invent metric values when an integration is unavailable or unhealthy — say so and point to setup/doctor rather than fabricate a number.
- Not compare or rank individual engineers — team/repo level only.
- Not substitute for an incident postmortem — this surfaces trend and risk, not the root cause of one specific event.
- Not report on repos the user/config didn't specify.

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
Pull each configured repo's data and compute the four DORA keys as independent bands, stating the metric, measurement window, and threshold behind each — never collapse them into one score. Pair each lagging indicator (incident count, MTTR, change-failure rate) with its leading counterpart (PR review latency, CI flake trend, deploy-frequency trend), and check flake rate and stale-PR signals directly against the CI/PR data. Before calling anything healthy, name what a clean number could be concealing — for example, zero rollbacks from low-risk changes rather than low risk.

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

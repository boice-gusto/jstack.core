---
name: jstack-team-metrics
description: Team DORA-style signals with caveats for sample size. Separate unplanned work % when labels exist.
category: metrics
effort: max
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Report team delivery metrics (throughput, cycle time, WIP, flow efficiency) from configured sources, stating the population and window for every figure.
- **Out of scope:** Ranking individuals within the team, and inferring causation from a metric shift.

## Domain rules — team metrics

### Absolute rules
1. Goodhart's Law governs every metric here: once a number becomes a target, people optimize the number, not the goal it was meant to represent. Name this explicitly whenever a metric is proposed as a target rather than a diagnostic signal.
2. Velocity and story points measure **estimated effort**, not delivered value or productivity. They are team-relative and un-normalized by design — comparing velocity across teams, or using it to judge individual output, is a category error, not just a bad practice ([Fowler: "velocity is not a measure of productivity"](https://www.artisanagility.com/blog/velocity-is-not-a-productivity-metric-and-never-was)).
3. Report flow metrics with their real definitions, not colloquial synonyms: **cycle time** is time-in-process for one item; **throughput** is items completed per unit time; **WIP** is items currently in progress; **flow efficiency** is active time divided by total elapsed time.
4. Apply **Little's Law** — WIP = throughput × cycle time — as a consistency check, not three independently estimated numbers. If reported WIP, throughput, and cycle time don't roughly satisfy the identity, one measurement is wrong or the system isn't in a steady state; say which is suspect.
5. Report **percentiles (p50/p85 or p95), never a bare average**, for cycle time or any right-skewed duration metric. An average is dragged toward the fast bulk of the distribution and hides the long tail that actually generates complaints — the same failure mode as reporting mean latency instead of p95/p99.
6. Never state a rate or percentage without its denominator visible in the same sentence. An unstated-denominator claim ("80% of PRs reviewed within a day") can be true and misleading simultaneously if the sample, window, or exclusions aren't named alongside it.
7. Never compare individuals by these metrics. Team/flow-level only, and always paired with a quality signal (e.g. change-failure rate alongside throughput) so speed alone isn't read as the whole story.

### Thresholds
| Signal | Threshold | Why |
|---|---|---|
| Little's Law identity | WIP ≈ throughput × cycle time | If reported numbers don't roughly satisfy this, flag which measurement is likely wrong or the window isn't steady-state. |
| Flow efficiency | typical unmanaged team: 15–40%; high-performing: 40–60% | Most elapsed time in an unmanaged flow is waiting (review queues, handoffs, approvals), not active work — 100% is neither realistic nor the goal ([Swarmia](https://www.swarmia.com/blog/flow-efficiency/)). |
| Cycle-time reporting | report p50 **and** p85/p95 together, never a bare average | Duration distributions are right-skewed; the mean sits far from the typical case and hides the tail. |
| Velocity comparison across teams | never valid (0 tolerance) | Story points aren't normalized across teams or estimators; a cross-team velocity comparison compares nothing meaningful. |
| Denominator disclosure | 100% of published rate/percentage metrics state N and window in the same sentence/caption | Without it, the number can't be evaluated for whether it's meaningful or cherry-picked. |
| WIP per person | practitioner guideline: 1-2 active items | Above this, context-switching cost and Little's Law both predict rising cycle time even with constant throughput. |

### Named anti-patterns
| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Velocity as a productivity KPI | Goodhart's Law: teams inflate point estimates once velocity is tracked as a target | Track flow metrics (cycle time, throughput) instead; keep velocity internal to the originating team's own sprint planning |
| Reporting average cycle time only | Right-skewed distributions make the mean dragged and unrepresentative — same shape problem as mean vs. p99 latency | Report percentiles (p50 + p85/p95) side by side |
| Unstated-denominator rate ("80% shipped on time") | True and misleading simultaneously if N, window, or exclusions aren't stated | State N, window, and inclusion criteria in the same sentence |
| Comparing individual engineers by ticket count/velocity | Goodhart at the person level, plus tickets/points vary wildly in size and aren't comparable across people | Report team/flow-level only; use qualitative review, not a ticket count, for individual signal |
| Treating WIP, throughput, and cycle time as three independent facts | They're linked by Little's Law; reporting them without the identity misses an internal-consistency check and an obvious lever | Apply WIP = throughput × cycle time explicitly; recommend a WIP limit when cycle time is the actual complaint |

### Worked example
- **Weak:** "Team velocity is up 20% this quarter, we're getting more productive."
- **Sharp:** "Story points completed per sprint rose ~20%, but average points-per-ticket also rose (5 points vs. 3 last quarter) — consistent with estimate inflation, a known Goodhart response once velocity started appearing in the quarterly review deck. The flow metrics tell a different story: median (p50) cycle time held flat at 3 days, but p85 cycle time rose from 6 to 11 days — a growing share of work is stuck in a long tail, mostly PRs waiting >48h for a second reviewer. Recommend dropping velocity from the quarterly deck and tracking p50/p85 cycle time plus WIP (currently ~2.4 items/engineer, above the 1-2 guideline) instead — capping WIP is the direct lever on the actual complaint (things take a long time to land), not a velocity target the numbers show is already being gamed."
- The sharp version names the mechanism (estimate inflation under Goodhart's Law), the evidence (points-per-ticket drift, p50 vs. p85 divergence, WIP above guideline), and the fix (swap the tracked metric, cap WIP).

### What this skill must not do
- Not a performance-review or individual-ranking tool — team/flow-level only, ever.
- Not invent org-specific velocity or story-point history — derive only from configured Jira/GitHub data, and label gaps rather than fill them.
- Not a substitute for qualitative signal (interviews, retro themes) when the question is "why," not just "what changed."
- Not present any rate or percentage without its denominator in the same sentence.

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
Team DORA-style table with caveats for sample size.
- Separate unplanned work % if Jira has labels — else omit.

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

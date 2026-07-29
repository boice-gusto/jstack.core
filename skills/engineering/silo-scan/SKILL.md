---
name: jstack-engineering-silo-scan
description: Detect overlapping work — same files or similar tickets/PRs — from a Jira ticket or GitHub PR; confidence-thresholded; read-only unless user approves comments.
category: engineering
agent: Explore
context: fork
effort: high
disable-model-invocation: true
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Detect overlapping work — same files or similar tickets and PRs — starting from a Jira ticket or GitHub PR, flagging matches above a confidence threshold.
- **Out of scope:** Posting comments on matched items without explicit user approval.

## Domain rules — silo / bus-factor scan

### Absolute rules
1. Bus factor is the minimum number of people whose sudden unavailability would critically stall a module or codebase. Measure it from commit and review authorship over a **trailing window (6-12 months)**, never all-time history, which dilutes current risk with a departed contributor's old commits.
2. Report bus factor and silo ratio **per critical module/directory**, not repo-wide only. A healthy-looking repo aggregate can still hide a single-owner critical module inside it.
3. A single-owner module is a risk even when the code is well-written. Code quality and knowledge concentration are independent axes — good code with one owner still stalls onboarding, review depth, and incident response when that person is unavailable.
4. Measure **review-authorship spread** independently from commit-authorship spread. A module can look fine on who wrote the code while every review was rubber-stamped by the same single approver, meaning no one else has actually vetted the logic even by proxy.
5. Weight remediation priority by **change frequency and downstream dependents (fan-in)**, not ownership concentration alone. A single-owner module that rarely changes and has no callers is a lower priority than a single-owner module that changes weekly and six services depend on.
6. Frame every finding as organizational/process risk (cross-training, pairing, documentation gap) — never as a judgment on the individual ("this person hoards knowledge"). Naming a name as the finding discourages the transparency the scan depends on.

### Thresholds
| Signal | Threshold | Why |
|---|---|---|
| Bus factor on a critical module | ≤2 = high risk | Roughly 65% of studied popular GitHub projects have a bus factor ≤2, and under 10% exceed 10 — a bus factor of 1-2 is common, not exceptional, but still a named risk on anything critical ([truck-factor study, arXiv](https://arxiv.org/pdf/2202.01523)). |
| Silo ratio (top contributor's share of meaningful commits) | >70% over trailing 6 months on a critical module | Meaningful excludes formatting/auto-generated diffs; above this, the module is effectively single-authored regardless of nominal team size. |
| Review-participation spread | <2 distinct approvers merging to a critical module over trailing 90 days | A review-silo flag independent of the commit-authorship number — approval spread and authorship spread must both be checked. |
| Remediation priority | top-quartile change frequency **and** silo ratio >70% **and** fan-in ≥1 dependent service | Combine concentration with churn and blast radius before prioritizing — a static, low-dependency file doesn't need the same urgency. |
| Onboarding lag | new team member's first unassisted merged change to an owned module >60 days after joining | A concrete signal that knowledge transfer for that module hasn't happened yet. |

### Named anti-patterns
| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Repo-wide bus factor only | A healthy-looking aggregate can hide a single-owner critical module | Report bus factor per critical module/directory, not just the repo aggregate |
| Silo flag as individual indictment | Frames a systemic gap as a personal failing; discourages transparency and pushes experts to hide rather than share knowledge | Frame as organizational risk: "module X has one reviewer; recommend pairing/rotation," never "Y hoards knowledge" |
| Ignoring review-authorship concentration | A module can look fine on commit spread while every review is rubber-stamped by the same approver | Measure commit-authorship and review-authorship spread independently |
| Flagging every single-owner module equally | Wastes remediation effort on low-churn, low-blast-radius files | Weight by change frequency and fan-in before prioritizing |
| Using all-time git history | Dilutes a departed contributor's old commits into current risk, understating who actually owns the module today | Use a trailing 6-12 month window for the ownership calculation |

### Worked example
- **Weak:** "This module was written by one person, that's risky."
- **Sharp:** "`billing/src/proration.ts` has a silo ratio of 91% (one author, trailing 6 months, excluding formatting-only commits) and is in the top decile for change frequency this quarter (14 merges), with 6 downstream callers. Independently, review participation over the same window shows only 1 distinct approver across all 14 merges — the concentration exists on both the write side and the review side, so no one else has verified the logic even by proxy. This is a high-priority pairing target given the churn and fan-in, not a low-churn file we can defer. Recommend the second reviewer on the next 3 merges be someone new to the module specifically to build a second capable reviewer, not to rubber-stamp."
- The sharp version names the mechanism (write-side and review-side concentration are independent findings), the evidence (silo ratio, churn rank, fan-in, reviewer count), and the fix (targeted pairing, sized to the actual risk).

### What this skill must not do
- Not a performance-review or individual-accountability tool — never produce a name-and-shame ranking.
- Not a substitute for actual documentation — surfacing a gap doesn't close it; hand off remediation (pairing schedule, doc sprint) as a recommendation, not an automatic assignment.
- Not repo-wide-only reporting — findings must resolve to specific modules/directories to be actionable.
- Not based on all-time git blame alone — must use a bounded, recent window.

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
Apply the `jstack-engineering-silo-scan` workflow using values from `jstack.config.json`. There is no `templates/engineering/` directory — derive the output shape from the Output shape section below rather than looking for a template file.

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

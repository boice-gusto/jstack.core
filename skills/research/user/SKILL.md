---
name: jstack-research-user
description: Synthesize user interview themes with verbatim quotes (permission-aware). Distinguish frequent vs loud users.
category: research
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
Synthesize user interview themes with verbatim quotes (permission-aware). Distinguish frequent vs loud users.

## Domain rules — user research

### Absolute rules
1. State the sample size and what it can and cannot support in the same breath as any finding. Five participants in a qualitative usability test on a homogenous user group typically surface roughly 85% of usability problems ([Nielsen/Landauer model, NN/g](https://www.nngroup.com/articles/why-you-only-need-to-test-with-5-users/)) — but that model says nothing about **how many** total users hit each problem. Issue-discovery and prevalence are different questions requiring different sample sizes.
2. Never state a prevalence percentage ("60% of users struggle with X") from a qualitative sample. Quantitative prevalence claims need roughly 20-40+ participants to be statistically meaningful ([NN/g quant guidance](https://www.nngroup.com/articles/5-test-users-qual-quant/)); a 5-person qual study can tell you a problem exists, not how common it is.
3. Avoid leading questions: don't name the UI element before the user does, don't presuppose difficulty ("wasn't this confusing?"), and don't offer the answer inside the question. Ask what was easy or hard, not whether something specific was hard ([NN/g](https://www.nngroup.com/articles/leading-questions/)).
4. Separate what users **said** (self-report, quotes, stated preference) from what they **did** (observed task success/failure, time-on-task, actual choice) — label each distinctly in synthesis; never blend them into one narrative.
5. Stated preference is not revealed behavior. When both exist, trust the revealed signal: stated-only preference research has been shown to predict real purchase/adoption behavior far less reliably than behavioral evidence in comparable studies — treat a stated-only finding as directional, not decision-grade.
6. Distinguish frequent (heavy, representative) users from loud (vocal, self-selected) ones. A sample drawn only from support tickets or forum threads is a loud-user sample, not a representative one, and should never be reported as "users think."

### Thresholds
| Signal | Threshold | Why |
|---|---|---|
| Qualitative issue-discovery | n=5 per homogenous segment (~85% of usability issues found) | Distinct user segments (e.g. admin vs. end user) each need their own round — the model doesn't transfer across segments ([NN/g](https://www.nngroup.com/articles/how-many-test-users/)). |
| Quantitative prevalence claim | ~20-40+ participants minimum | Below this, a percentage claim is not statistically supportable. |
| Stated- vs revealed-preference gap | trust revealed evidence when they conflict | Stated preference alone has been shown to substantially under-predict real behavior compared to behavioral methods. |
| Verbatim quote per theme | ≥1 direct, attributed quote per major theme reported | A theme with no quote is a summarizer's paraphrase, not a finding. |
| Segment homogeneity | test each distinct segment separately | The n=5 rule assumes users are using the product in a similar way; heterogenous segments need their own round. |

### Named anti-patterns
| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Prevalence claim from n=5 ("most users think...") | Conflates qualitative issue-discovery with quantitative prevalence, which needs a much larger sample | Report as "found in interviews with N users," never as a population percentage |
| Leading question ("wasn't this confusing?") | Presupposes the answer; respondents mirror the interviewer's framing | Ask a neutral open question ("what was easy or hard about this task?") |
| Treating stated interest as demand | Say-do gap: "I'd pay for that" doesn't predict conversion | Corroborate with a behavioral signal — waitlist conversion, usage of an existing proxy, or an A/B test |
| Loud-user sampling (support tickets/forum only) | Overrepresents vocal edge cases; the silent majority is unseen | Supplement with usage data or a random sample of the broader base |
| Merging "said" and "did" into one narrative | Hides exactly the cases where self-report contradicts observed behavior — the most useful signal | Keep them in separate labeled sections: Said vs. Did |

### Worked example
- **Weak:** "Users don't like the new checkout flow — 4 out of 5 people said it was confusing."
- **Sharp:** "In 5 task-based sessions (one homogenous new-customer segment), 4 of 5 participants failed to find the 'apply discount' control unprompted (observed: avg. 45s of visible searching before giving up or asking) — that's a usability-issue signal from a small qual sample, not a population prevalence estimate. Separately, on the SAID layer: when asked afterward, 3 of 5 said they 'liked' the new flow overall. That say-do gap (liked it / couldn't use it) means we trust the observed failure over the self-report here. Recommend relocating the discount control and re-testing with a different n=5 cohort before rolling to 100%."
- The sharp version names the mechanism (say-do gap), the evidence (observed time-on-task vs. quoted sentiment), and the fix (targeted re-test, not a full rollout decision from 5 people).

### What this skill must not do
- Not a substitute for a properly powered quantitative survey when the actual question is "what percentage of our users..."
- Not permission-agnostic — respect participant consent and anonymization; never quote or attribute beyond the granted permission level.
- Not a tool for justifying a decision already made — never select quotes to support a predetermined conclusion.

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
State which sources you searched and which you could not reach — silent partial coverage reads as completeness. Distinguish "not found" from "does not exist". Timestamp findings, because a stale answer presented as current is worse than no answer.

### Step 3 — Execute
Interview synthesis: themes, verbatim quotes with permission context.
- Distinguish frequent vs loud users.

### Step 4 — Validate
Confirm every claim has a source and an as-of time, and that coverage gaps are stated rather than implied. No source, no claim.

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
| Web search unavailable | Return assumptions as `[unverified]` with a to-verify checklist. |
| Codebase too large to map | Top-down overview first, then offer targeted deep dives. |

## Chaining
Complete the work here. If a natural follow-up exists, add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

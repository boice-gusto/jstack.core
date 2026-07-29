---
name: jstack-research-competitive
description: Competitive analysis with comparison table. Treat public info as potentially stale; never claim private competitor metrics.
category: research
agent: Explore
context: fork
effort: max
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Compare named alternatives on capabilities a user would actually choose between, separating verified facts from inference and labelling each.
- **Out of scope:** Pricing negotiation advice, legal comparison, and presenting a competitor's roadmap claim as shipped fact.

## Domain rules — competitive research

### Absolute rules
1. No claim without a source and an as-of date. An undated competitive claim is unusable — pricing, feature sets, and positioning all decay within a quarter, and a reader cannot tell whether an undated claim is current or two years stale.
2. Rank source quality before citing: **primary** (competitor's own pricing page, product changelog, SEC filings, job postings, customer contracts) outranks **paid analyst research** (Gartner/Forrester, dated by report version) which outranks **vendor marketing** (a competitor's — or your own — press release, which states positioning, not verified capability) which outranks **secondhand aggregator blogs**. Secondary research is available to every competitor; primary research is what makes a report intelligence instead of a compiled newspaper clipping ([Contify](https://www.contify.com/resources/blog/reboot-competitive-intelligence-by-leveraging-competitive-intelligence-solution-for-integrating-primary-and-secondary-research/)).
3. Separate **claim** from **evidence** in every line: "the competitor is the market leader" is a claim; "the competitor's G2 review count is 3x the category median as of 2026-06-01" is evidence. A comparison table entry with no evidence column is an opinion, not research.
4. Disclose the full set of comparison dimensions considered, including ones where the competitor wins. A table that only shows dimensions favoring one side is cherry-picked even if every cell in it is true.
5. Distinguish "not found" from "does not exist." Absence of evidence in a search is a coverage gap, not proof the feature/claim is false — state it as `[not found as of <date>]`.
6. Never treat a competitor's marketing copy as proof of a security, compliance, or performance capability. Marketing states aspiration; verifying the capability needs a doc, a customer reference, or an independent audit artifact.

### Thresholds
| Signal | Threshold | Why |
|---|---|---|
| Pricing/feature claim recency | stale if unchecked >90 days | Public pricing/feature pages change on product-cycle timelines. |
| Funding/headcount claim recency | stale if unchecked >180 days | LinkedIn/Crunchbase-style data lags real changes by months. |
| Analyst report age | usable <12 months; else label historical | Analyst quadrant/wave placements shift on an annual cadence. |
| UI/product-behavior screenshot | stale if >30 days old | Live product changes faster than marketing collateral; verify against the current product, not a cached image. |
| Corroboration for a "materially disadvantages us" claim | ≥2 independent sources | A single source driving a high-stakes claim is a single point of failure in the brief. |

### Named anti-patterns
| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Citing vendor marketing as a verified capability | Marketing states positioning/aspiration, not audited fact | Require a doc, customer reference, or independent audit before treating it as capability |
| Feature-checklist theater | A landing page mentioning a word is not proof the mechanism works to spec | Verify via demo, documentation, or trial account before checking the box |
| Cherry-picked comparison table | Shows only dimensions that flatter one side, misleading the decision-maker | Disclose the full dimension set considered, including unfavorable ones |
| "Not found" reported as "does not exist" | Absence of evidence isn't evidence of absence | Label `[not found as of <date>]` and flag as a coverage gap, not a negative finding |
| Analyst placement cited without report year | Placements move yearly; an undated citation implies false currency | Always cite the specific report edition/year |

### Worked example
- **Weak:** "Competitor Y is cheaper than us."
- **Sharp:** "Competitor Y's published self-serve tier starts at $X/seat/month (source: Y's pricing page, checked 2026-07-20) versus our $Z. Y's enterprise tier has no public list price — quote-only — so this is a self-serve-to-self-serve comparison only, not a full price comparison. Treat any enterprise-tier price delta as `[unverified]` until we get a real quote."
- The sharp version names the mechanism (which tiers are actually comparable), the evidence (source + date), and the fix (scope the claim to what's verifiable, flag the rest).

### What this skill must not do
- Not a substitute for legal or patent counsel — stop at questions for counsel, don't render a legal opinion on trademark/patent risk.
- Not a scraping tool that violates a competitor's terms of service to obtain data.
- Not a source of fabricated competitor financials, headcount, or internal roadmap — if it isn't publicly sourced, it doesn't go in the brief.

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

For methodology, examples, and templates for this skill, read:
!cat ${CLAUDE_PLUGIN_ROOT}/skills/research/competitive/references/deep-dive.md

### Step 2 — Plan the safe path
State which sources you searched and which you could not reach — silent partial coverage reads as completeness. Distinguish "not found" from "does not exist". Timestamp findings, because a stale answer presented as current is worse than no answer.

### Step 3 — Execute
Comparison table. Treat public info as potentially stale.
- Never claim private competitor metrics without a source line.

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

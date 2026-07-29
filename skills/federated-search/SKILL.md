---
name: jstack-federated-search
description: Multi-provider federated search — selects N backends (Jira, Notion, Slack, GitHub, Glean, Google, DuckDuckGo, gbrain, knowledge_base, etc.) from the user query or explicit flags; delegates one constrained subagent (or isolated tool sweep) per provider; merges hits, ranks relevance to the question, structures a single answer. Supports --raw to skip synthesis. Reads jstack.config.json mcp_servers and integrations; does not invent credentials.
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
Dispatch one query across the configured backends in parallel (Jira, Notion, Slack, GitHub, knowledge_base, gbrain) and fuse the results with per-source attribution.
- **Out of scope:** Knowledge-base-only lookups — use `jstack:knowledge-search`, which is scoped to the curated `knowledge_base` config. Also out of scope: storing anything it finds.

## Domain rules — federated-search

### Absolute rules

1. **State exactly which providers were queried, which returned zero hits, and which were
   unreachable — every time.** Federated search inherently combines heterogeneous, independently
   available backends ([federated search](https://en.wikipedia.org/wiki/Federated_search)); silent
   partial coverage reads as completeness to anyone who wasn't watching it run.
2. **"Not found in the providers reached" and "does not exist" are different claims.** Only the
   first is ever justified by a search that skipped or lost a provider — never collapse the two.
3. **Never fabricate a result or a credential.** A provider that errors, times out, or lacks a
   configured token is reported as unreachable — it is never a reason to synthesize a plausible-
   looking hit in its place.
4. **Every surfaced result carries per-provider evidence and an as-of/query timestamp.** A result
   with no source and no freshness marker cannot be checked or trusted by the reader.
5. **State the ranking rationale per result** — recency, exact keyword match, source authority, or
   a stated fusion method such as reciprocal rank fusion for combining independently ranked lists
   ([Cormack, Clarke & Buettcher, 2009 — Reciprocal Rank Fusion](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf)).
   "Most relevant" with no named reason is not an audit trail.
6. **A provider timeout is a coverage gap, not a null result.** Report it as "timed out after
   config's configured window," never silently folded into "no hits."
7. **When providers disagree on a fact** (one says an incident is closed, another implies it's
   still open), surface the conflict explicitly — do not pick one silently and drop the other.

### Thresholds

| Signal | Threshold | Basis |
|---|---|---|
| Coverage disclosure | 100% of invoked providers listed as queried / zero-hit / unreachable / timed-out | Anything less misrepresents completeness |
| Provider timeout | Per-provider timeout from `jstack.config.json` / `mcp_servers` config, not invented — describe the shape, pull the number from config | Org-specific; hardcoding a figure here would be fiction |
| Result freshness | 100% of results carry an as-of query timestamp | Undated results can't be judged as current or stale |
| Ranking rationale | Named per result: recency, keyword match, source authority, or fusion method | Unlabeled ranking can't be audited or reproduced |

### Named anti-patterns

| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Silent partial coverage | Reports as if fully searched when some providers failed or were skipped | Always list queried vs. zero-hit vs. unreachable vs. timed-out |
| "No hits" treated as "confirmed doesn't exist" | Absence of evidence in reachable providers isn't evidence of absence | State "not found in reachable providers"; name what wasn't reached |
| Fabricating a result when a provider errors | Worse than an honest gap — presents invented data as real | Report the error; never synthesize a plausible-looking hit |
| Merging ranked lists with no stated method | Unreproducible, unauditable ordering | Name the ranking basis or fusion method used for the final order |

### Worked example

- *Weak:* "Searched everywhere, didn't find anything about the outage."
- *Sharp:* "Queried: Jira (0 hits), Slack (3 hits, as of 2026-07-27 14:02 UTC), GitHub (1 hit).
  Unreachable: Notion — auth token expired, not searched, flagged rather than silently omitted.
  Ranking: the Slack thread ranks first on recency (posted 40 minutes prior) plus an exact keyword
  match on 'checkout-outage'; the GitHub issue ranks second on keyword match alone, with no
  recency signal. Conclusion: not found in Jira or Slack; cannot say it doesn't exist in Notion,
  since that provider was unreachable this run."

### What this skill must not do

- Does not decide which provider's conflicting account of a fact is correct — surfaces the
  conflict for the user to resolve.
- Does not retry a hung provider indefinitely — respects the configured timeout and reports the
  gap rather than blocking the whole search on one backend.
- Does not invent a provider's credential or id to make it appear queried when it wasn't configured.

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
Apply the `jstack-federated-search` workflow using config and any applicable templates under `templates/research/`.

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

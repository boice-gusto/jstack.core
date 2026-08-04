---
name: jstack-incident-find-sme
description: Rank subject-matter experts from Jira history + Slack presence for an incident description or incident id; config project scope.
category: incident
effort: medium
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md
Load the policy this domain is governed by (do not restate it from memory):
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/policies/incident-policy.md

## What this skill is for
Identify the likeliest subject-matter expert for a system from configured history (commits, tickets, docs), with the evidence for each candidate.
- **Out of scope:** Paging or messaging the person, and treating commit volume alone as expertise.

## Domain rules — incident/find-sme

**Absolute rules**

1. Evidence for "who knows this" comes from code ownership signals — recent commit history, review/approval history, and CODEOWNERS-style mappings — not from reputation or hearsay ("I think it was someone on that team") ([git blame and code ownership](https://www.gitkraken.com/answers/how-code-ownership-tracking-speeds-troubleshooting); [git_sme — identifying experts from commit history](https://github.com/sjaveed/git_sme)).
2. Weight recency: a name that only appears in commits from years ago is a stale lead, not a current SME — verify they're still the right contact before treating the match as current, since ownership drifts as people change teams or leave.
3. Never surface a single name as the only path to the answer without naming the bus-factor risk. If exactly one person has touched a critical file or module in the recent history, say so explicitly — a bus factor of one is itself a finding worth flagging, not just a routing shortcut ([Assessing the Bus Factor of Git Repositories](https://www.researchgate.net/publication/272794507_Assessing_the_Bus_Factor_of_Git_Repositories)).
4. Escalation follows the defined order: primary on-call, then secondary/backup, then team/eng lead. Never skip a level because someone "seems faster to reach" — the order exists precisely so availability doesn't override accountability.
5. Respect on-call boundaries: do not page or interrupt someone who is off-call, on leave, or outside their defined on-call window just because they wrote the code, unless the incident severity and defined escalation policy explicitly call for it.
6. Every candidate returned is labeled with its evidence basis — "3 of the last 5 commits to this file" is a strong lead; "mentioned in a Slack thread once" is hearsay and must be labeled as such, not presented with equal confidence.

## Thresholds

| Signal | Threshold | Why |
|---|---|---|
| Bus factor | ≤2 recent contributors to a critical file/module | Flag as a bus-factor risk worth naming, not just a routing convenience — losing either person leaves a knowledge gap |
| Evidence recency window | Commits/reviews within roughly the last 6–12 months weighted as current; older activity treated as historical context only | Ownership and team membership drift; an old commit doesn't guarantee current expertise or availability |
| Escalation order | Primary → secondary/backup → team lead, in that order, no skipped level | Skipping steps "because it's faster" erodes the reason an escalation policy exists |
| Hearsay confidence | Any lead with zero commit/review/ownership evidence behind it is labeled `[unverified]` | Prevents a rumor from being paged with the same confidence as a documented owner |

## Anti-patterns

| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Paging based on reputation ("ask so-and-so, they know everything") | No evidence trail; may not even be current on this specific code | Check recent commit/review history for the actual file or module in question first |
| Always routing to the same one person | Creates a single point of dependency and burns out the de facto owner | Surface the bus-factor risk explicitly and suggest a second reviewer/owner be established |
| Skipping the escalation order for speed | Undermines the reason the order exists — accountability and coverage, not just speed | Follow primary → secondary → lead; if primary is unresponsive within the policy's window, escalate per policy, not by guessing who's awake |
| Paging someone off-call or on leave without checking policy | Violates on-call boundaries and burns goodwill even when well-intentioned | Check on-call status first; only override for severity levels the escalation policy explicitly allows |
| Presenting a hearsay lead as equal to a verified owner | Misleads the incident commander about how solid the lead actually is | Label every candidate with its evidence basis so confidence is visible |

## Worked example

- *Weak:* "Ping Jordan, I think they built this."
- *Sharp:* "Recent evidence for the payment-retry module: Jordan authored 4 of the last 6 commits and reviewed 2 of the other 2 (last activity 3 weeks ago) — strong current lead. Priya is the only other contributor in the last 12 months (1 commit, 8 months ago) — bus factor of 2 on this module, worth flagging separately. Jordan is off-call this week per the schedule; per escalation policy this is a Sev2, so page the secondary on-call first and loop Jordan in async rather than paging them directly outside their window."

## What this skill must not do

- Does not page or contact anyone directly — it produces a ranked candidate list with evidence and escalation guidance for a human (or the incident commander) to act on.
- Does not override on-call boundaries or the defined escalation order on its own judgment; it surfaces the policy and any tension with it.
- Does not present a single match as definitive without naming the bus-factor risk or the possibility the lead is stale.
- Does not share a candidate's personal availability or off-call details beyond what's needed to route the page appropriately.

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
Stabilize before diagnosing. Record the timeline as you go, not afterwards from memory. Do not state a cause until it is established — in anything customer-facing, "under investigation" is correct and a guess is a liability.

### Step 3 — Execute
Search commit history, review/approval history, and CODEOWNERS-style mappings within the configured project scope for the system named in the incident, then rank candidates by recency-weighted evidence rather than raw commit count. Label each candidate with its evidence basis (recent commits/reviews vs. older activity vs. hearsay), and flag explicitly when two or fewer people have touched the relevant file or module recently. Before naming who to contact, check the top candidate's on-call status and order any suggested outreach primary → secondary/backup → team lead rather than routing straight to whoever wrote the code.

### Step 4 — Validate
Confirm the timeline is ordered and sourced, that cause is labelled as established or under investigation, and that no customer-facing text asserts more than is known.

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
| Impact unverified | Do not announce resolved; state current known status only. |

## Chaining
Complete the work here. If a natural follow-up exists, add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

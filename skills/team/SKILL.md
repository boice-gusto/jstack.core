---
name: jstack-team
description: "Team snapshot: roster, on-call, sprint goal, dependencies. No individual performance color."
category: team
effort: high
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md
Load the policy this domain is governed by (do not restate it from memory):
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/team-context.md

## What this skill is for
Structural team snapshot: roster, on-call, sprint goal, cross-team dependencies. No individual performance commentary.
- **Out of scope:** Performance reviews or stack-ranking people.

## Domain rules — team snapshot

### Absolute rules
1. Every listed area or component has a named individual owner. An area marked "TBD" or left blank is not neutral — it is unowned, and an unowned area is exactly where an incident finds nobody positioned to respond.
2. Bus factor is reported **per critical area**, not only as a team-wide aggregate — a healthy-looking headcount of 8–12 can still contain one critical module only one person can touch.
3. On-call coverage and area ownership are reported as two separate facts. The person on rotation this week is not automatically the deep owner of every area they get paged for; conflating the two hides the real concentration risk.
4. Never rank, score, or stack-rank individual contributors in this snapshot — it is a structural map (roster, ownership, on-call, dependencies), not a performance signal, and smuggling one in destroys trust in the skill.
5. When roster data is stale beyond the configured refresh window, say so explicitly rather than presenting an out-of-date roster as current — org changes (transfers, backfills) routinely outpace a cached snapshot.
6. A cross-team dependency without a named counterpart owner on the other side is reported as an unresolved risk, not treated as a completed handoff.

### Thresholds
| Signal | Threshold | Source |
|---|---|---|
| Bus factor on a critical area | ≤2 = high risk · 5+ = well distributed | [Bus factor — Wikipedia](https://en.wikipedia.org/wiki/Bus_factor); [Laws of Software Engineering — Bus Factor](https://lawsofsoftwareengineering.com/laws/bus-factor/) |
| Named-owner coverage | 100% of listed areas/components carry a named owner; gaps are reported, not filled with a guess | structural completeness check |
| Roster staleness | flag if unrefreshed beyond the configured window (commonly 30–90 days) — pull the actual figure from config | shape only; org-specific |
| Cross-team dependency resolution | every dependency line names a counterpart owner on the other team, or is flagged open | prevents an unresolved handoff from reading as complete |

### Named anti-patterns
| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Listing "the team" as an area's owner | A team name is not an accountable person; diffusion of responsibility slows response | Name one accountable individual per area, even if others contribute |
| Treating on-call as ownership | On-call this week ≠ deep expertise in the module being paged for | Report ownership and on-call as separate columns |
| Team-wide bus factor only | Hides a single-owner critical module inside a large, healthy-looking team | Report bus factor per critical area/component |
| Presenting a stale roster as current | Misleads on-call routing and escalation decisions | Show last-refreshed date; flag anything past the staleness window |
| Stack-ranking members inside a "snapshot" | Turns a structural view into an unrequested performance judgment | Keep the snapshot to roster, ownership, on-call, dependencies only |

### Worked example
- *Weak:* "The team has 8 engineers and things are going well."
- *Sharp:* "Roster (8 engineers, last refreshed 2026-07-20). Billing area — owner: [name], bus factor 1 (single committer/reviewer, trailing 6 months) — flagged high risk. Notifications area — owner: [name], bus factor 3 — healthy. On-call this week: [name], Notifications rotation — not the Billing owner, so a Billing incident this week would page someone without deep context. Cross-team dependency: Payments API migration blocked on Platform team; no counterpart owner confirmed on their side — flagged open, not resolved."

### What this skill must not do
- Does not evaluate individual performance or produce a stack-rank — structural snapshot only.
- Does not decide remediation staffing (pairing schedules, hiring, backfill) — it surfaces the gap for a human to act on.
- Does not perform the code-level concentration analysis with churn and fan-in weighting — that deeper investigation is `jstack:engineering-silo-scan`; this skill names bus factor at the roster level only.

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
Read current state before changing it. Prefer the reversible action; when an action is irreversible, show what will change and get explicit confirmation first. If a required id or path is missing from config, stop and ask — never substitute a guess.

### Step 3 — Execute
Build a structural snapshot from config roster, on-call integration (if available), and Jira sprint goal.
- Dependencies: list cross-team blockers with owner and current status.
- If roster is incomplete, list what is known and note the gap.
- No performance commentary — this is a factual structure view.

### Step 4 — Validate
Before reporting done: confirm the change landed where intended, that nothing outside the stated scope was touched, and that every id, path, and figure you emitted came from config or the conversation rather than from inference. Name anything you could not verify.

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
| Team roster incomplete in config | List known members; note gap and suggest config update. |
| On-call integration missing | Omit on-call section; note it as unavailable. |

## Chaining
Complete the work here. If a natural follow-up exists, add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

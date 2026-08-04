---
name: jstack-sprint-prep
description: Pre-refinement prep — curate needs-refinement queue vs sprint goals, flag stale work, suggest new tickets for gaps, priority order draft.
category: sprint
effort: high
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Curate the pre-refinement queue against sprint goals: flag stale work, suggest new tickets for gaps, and draft a priority order.
- **Out of scope:** Running the refinement ceremony itself — hand off to `jstack:sprint-refinement`.

## Domain rules — sprint-prep

### Absolute rules
1. Prep's output is a **curated, prioritized queue for refinement** — it is not refinement itself. Writing acceptance criteria or estimates here duplicates a ceremony that exists specifically to get the whole team's input, and produces criteria nobody else reviewed.
2. Every item entering the queue carries a rough owner and a stated why-now; an item with neither cannot be prioritized honestly, and unranked backlog rot degrades trust in the whole queue.
3. Stale items (no activity beyond the configured staleness window — pull the actual figure from `skill_defaults`, default commonly 30 days) are flagged explicitly with the last-touched date, never silently reordered lower as if that were a deliberate deprioritization.
4. A vague item is named by its specific missing piece — no AC, no owner, unclear dependency — never labeled with a generic "needs more detail" that gives refinement nothing to start from.
5. A suggested new ticket for a coverage gap is a **proposal**, not a created ticket — prep hands the payload to `jstack:jira-intake`; it never silently commits a new backlog item on its own authority.
6. The queue covers more than exactly one sprint's worth of refined-adjacent work — queuing only one sprint's depth leaves zero buffer, so any prep delay turns refinement into a scramble under time pressure.

### Thresholds
| Signal | Threshold | Source |
|---|---|---|
| Stale-item flag | no update beyond the configured window (commonly 30 days) — read from `skill_defaults.sprint_prep`, don't invent a number if one is configured | shape only; org-specific |
| Queue depth vs. cadence | queue more than 1 sprint's worth of candidate-ready items | buffers refinement against a slipped prep cycle |
| Owner/why-now coverage | 100% of queued items carry a rough owner and a stated reason | prevents unranked rot from degrading trust in the queue |
| New-ticket proposals | 0 tickets created directly by this skill; all routed as payloads | keeps ticket creation on its own reviewed chain |

### Named anti-patterns
| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Raw backlog straight to planning | Planning absorbs derivation time understanding each item live, burning the ceremony meant for committing | Run prep first so refinement (and then planning) gets curated material |
| Writing AC/estimates in prep | Duplicates refinement without the team's input; produces unreviewed criteria | Flag the gap; the clarifying conversation happens in refinement |
| Silently reordering stale items | Looks like an intentional call when it's actually neglect | Flag staleness explicitly with the last-touched date |
| Creating tickets directly for gaps | Bypasses the reviewed ticket-creation chain | Propose a ticket payload for `jstack:jira-intake` |
| Queuing exactly one sprint's depth | Zero buffer — any prep delay becomes an under-fire refinement session | Queue more than the immediate next sprint's worth |

### Worked example
- *Weak:* "Backlog looks fine, pull the top 10 tickets for refinement."
- *Sharp:* "Of the top 15 items: 9 have an owner and a stated why-now — queued for refinement. 3 are stale (no update >30 days, oldest since 2026-04-02) — flagged, not silently dropped. 2 lack both AC and an owner — named as the specific gap, not 'needs detail.' 1 coverage gap found: no ticket exists yet for the reported CSV-export timeout — proposing a payload for `jstack:jira-intake` rather than creating it directly. Priority order for refinement: [9 ranked items]."

### Scope edge — how the three sprint ceremonies differ
Prep decides what and in what order enters the refinement queue. It does not run the five-question refinement walkthrough (`jstack:sprint-refinement`) and does not commit a sprint goal or plan (`jstack:sprint-planning`). If prep starts asking refinement's five questions per ticket or estimating items, that is scope creep into refinement's job, not additional prep work.

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
Read the board's actual state before planning against it. When something spilled, diagnose which of scope growth, underestimation, or blockage caused it rather than re-committing the same item. Change the plan or the scope, not the record of what happened.

### Step 3 — Execute
Pull the current backlog and check each item's last-touched date against the configured staleness window, its owner, and its stated why-now. Sort what's ready into a priority queue that covers more than one sprint's depth, flag stale or vague items by their specific missing piece instead of a generic label, and package any coverage gap as a proposed ticket payload for `jstack:jira-intake` rather than creating it directly.

### Step 4 — Validate
Confirm the numbers match the board rather than the narrative, and that carryover is explained rather than silently re-committed.

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
| No velocity data available | Use T-shirt estimates with a conversion note; do not invent points. |
| Sprint scope exceeds capacity | Show the gap and suggest which items to defer. |

## Chaining
Complete the work here. If a natural follow-up exists (e.g. `jstack-sprint-prep` then `jstack-sprint-planning`), add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

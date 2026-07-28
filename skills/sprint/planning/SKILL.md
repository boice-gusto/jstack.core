---
name: jstack-sprint-planning
description: Sprint planning: capacity, commit vs goal, spill from last sprint with root causes.
category: sprint
effort: high
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Run sprint planning: assess capacity, compare commit against goal, and explain spill from the prior sprint with root causes.
- **Out of scope:** Bulk-moving Jira issues into the sprint without user confirmation.

## Domain rules — sprint-planning

### Absolute rules
1. Planning ends with exactly one testable, falsifiable sprint goal ("ship X, verified by Y") — a pasted list of ticket keys with no goal statement is a scope dump, not a plan; nobody can tell mid-sprint whether the sprint is on track.
2. Commit to **this sprint's actual capacity** (available days after PTO, holidays, on-call), never to trailing average velocity unchanged — a team down two people for the sprint that still commits to its 6-sprint average is planning against a team that doesn't exist this cycle.
3. An item that arrives at planning without meeting Definition of Ready (clear, testable, feasible in one sprint) consumes planning time re-deriving scope live. That is a refinement failure surfacing in the wrong ceremony — flag it, don't quietly absorb it.
4. Planned WIP must not exceed what Little's Law implies the team can sustain (WIP = throughput × cycle time) — committing more in-flight items than that relationship supports means the plan is already assuming a faster cycle time than the team has ever hit.
5. Estimates draw on this team's own historical cycle time/velocity on comparable work (a reference class), never a bare gut/expert-feel number — an estimate with no comparison class is optimism bias wearing a number, not planning.
6. Story points stay an internal planning input. The moment velocity is reported externally as a productivity KPI, it predictably drifts into a target people learn to game (Goodhart) rather than a sizing tool.
7. Spillover from the prior sprint is classified as scope growth, underestimation, or blockage before being re-committed — recommitting it unchanged just re-runs whichever failure caused the miss.

### Thresholds
| Signal | Threshold | Source |
|---|---|---|
| Conservative commit ceiling | ≤80% of calculated capacity | [Tempo — How to Calculate Sprint Capacity](https://www.tempo.io/blog/how-to-calculate-sprint-capacity) |
| On-call capacity discount | roughly -50% of available days for the person on rotation | [Tempo](https://www.tempo.io/blog/how-to-calculate-sprint-capacity) |
| Focus factor (nominal → deliverable days) | 0.6–0.7 after meetings/ceremonies | [Tempo](https://www.tempo.io/blog/how-to-calculate-sprint-capacity) |
| WIP per person | 1.5–2.5 items in progress | [Multiboard — Effective WIP limits](https://www.multiboard.dev/posts/effective-setting-wip-limits) |

### Named anti-patterns
| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Goal-as-ticket-list | No falsifiable statement of success; mid-sprint status has nothing to check against | State one testable sprint goal; tickets are the plan to reach it |
| Committing to average velocity unadjusted | Ignores this sprint's actual PTO/on-call/holidays | Compute this sprint's capacity explicitly, discount known absences |
| Recommitting spillover unchanged | Repeats whatever caused the miss without fixing it | Classify cause (scope/underestimation/blockage); re-scope before recommitting |
| Gut-feel estimate with no comparison class | Optimism bias — the outside view is empirically more accurate | Estimate against this team's own historical cycle time on similar work |
| Publishing velocity outside the team as a KPI | Drives predictable gaming once it's a target, not a measure | Keep velocity internal; report flow metrics (cycle time, throughput) externally |

### Worked example
- *Weak:* "We're committing to 40 points this sprint, that's our average velocity."
- *Sharp:* "Capacity: 3 engineers × 8 days × 0.65 focus factor ≈ 15.6 person-days, minus 2 PTO days and one on-call rotation (-50% for that engineer) ≈ 12.4 effective person-days. Trailing 3-sprint velocity is ~2.2 pts/person-day → commit ceiling ~27 points at the 80% conservative discount. Sprint goal: 'Ship CSV export end-to-end, verified by the checklist in TICKET-101.' Two items spilled last sprint: one blocked on an API dependency now resolved (re-committing as-is), one underestimated 3x (re-scoped into two items before recommitting, not re-added unchanged)."

### Scope edge — how the three sprint ceremonies differ
Prep decides **what enters the refinement queue and in what order**. Refinement makes each item **individually estimable and sprint-ready** (the five-question walkthrough, AC, dependency check). Planning takes only items already meeting Definition of Ready and turns them into **this sprint's committed, testable goal and plan**. If planning has to invent acceptance criteria or resolve an open dependency live, that is a refinement failure leaking into planning — flag it, don't silently do refinement's job here. Planning does not curate the backlog queue (`jstack:sprint-prep`) and does not run the refinement conversation (`jstack:sprint-refinement`); it also never bulk-moves Jira issues into the sprint without explicit user confirmation.

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
!cat ${CLAUDE_PLUGIN_ROOT}/skills/sprint/planning/references/deep-dive.md

### Step 2 — Plan the safe path
Read the board's actual state before planning against it. When something spilled, diagnose which of scope growth, underestimation, or blockage caused it rather than re-committing the same item. Change the plan or the scope, not the record of what happened.

### Step 3 — Execute
Capacity (holidays, on-call) + commit vs goal. Show spill from last sprint with root causes.
- Jira: suggest sprint scope as list of issue keys, not a silent bulk edit.
- `suggested_next:` `jstack:reports` or Notion sprint page update when user uses both.

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

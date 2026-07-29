---
name: jstack-sprint-refinement
description: Refinement ceremony — five questions per ticket, capacity snapshot, sprint-ready checklist; no bulk Jira writes without confirmation.
category: sprint
effort: high
disable-model-invocation: true
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Facilitate the refinement ceremony: walk five standard questions per ticket, show a capacity snapshot, and confirm each ticket against a sprint-ready checklist.
- **Out of scope:** Bulk Jira writes — get explicit confirmation before updating multiple tickets.

## Domain rules — sprint-refinement

### Absolute rules
1. Every ticket is walked through the same five questions (what / why / acceptance criteria / dependencies / estimate) before being marked ready — skipping straight to an estimate produces a confident number on a scope nobody has actually clarified.
2. Estimate comes **last**, after AC and dependencies are answered, never first — an estimate given before the scope is clear just anchors the team to a number with nothing yet to check it against.
3. A ticket exits refinement as "sprint-ready" only once it meets Definition of Ready — clear, testable, feasible within a sprint. An item marked ready with an unresolved dependency is not ready, it is optimistic.
4. An item too large for the estimation scale in use (for example, ≥13 on a Fibonacci-like scale, or larger than a typical sprint) is split before any single number is assigned — one estimate on heterogeneous, poorly understood scope hides that it's actually several items.
5. Bulk Jira writes from a refinement session require explicit user confirmation before applying — refinement produces a proposed diff (status, estimate, AC updates), not a silent batch edit across many tickets.
6. The capacity snapshot is shown alongside the sprint-ready checklist — refining items in isolation from actual room in the coming sprint(s) produces a "ready" pile the team can't act on yet.

### Thresholds
| Signal | Threshold | Source |
|---|---|---|
| Five-question completion | 5 of 5 answered before "ready" | Definition of Ready convention — [Scrum.org, Ready or Not?](https://www.scrum.org/resources/blog/ready-or-not-demystifying-definition-ready-scrum) |
| Estimate ordering | AC + dependencies answered before an estimate is recorded | prevents anchoring on an unscoped guess |
| Mandatory-split threshold | item sized ≥13 (Fibonacci-like scale) or larger than typical sprint capacity | forces decomposition before a single number is assigned |
| Bulk-write confirmation | 0 unconfirmed multi-ticket writes | keeps refinement notes auditable and undoable |

### Named anti-patterns
| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Estimate-first refinement | Anchors the team on a guess before scope is clear; AC gets written afterward to justify the number | Walk AC/dependencies/owner first, estimate last |
| Marking "ready" with an open dependency | "Ready" becomes aspirational; planning inherits the surprise later | Only mark ready once the dependency is resolved or explicitly scheduled |
| Silent bulk Jira updates from notes | Applies many estimate/status changes with no confirm step, hard to audit or undo | Present as a proposed diff; confirm before writing |
| Giant unsplit epic given one estimate | A single number can't represent heterogeneous, poorly understood scope | Split above the size threshold before estimating any piece |
| Refining with no capacity shown | Team can't tell whether the ready pile even fits the coming sprint | Show a capacity snapshot next to the sprint-ready checklist |

### Worked example
- *Weak:* "TICKET-204: refine — team says 5 points, done."
- *Sharp:* "TICKET-204 — (1) what: add CSV export to the reports page; (2) why: top support request this quarter; (3) AC: export matches on-screen filters, downloads <5MB in <3s; (4) deps: none, confirmed against the export-service roadmap; (5) estimate: 5 points, given only after 1–4 were answered. Marked sprint-ready. Contrast: TICKET-205 has no AC and an unconfirmed dependency on the billing team — held back from 'ready' despite a team member's gut '3 points'; estimate deferred until the dependency is confirmed."

### Scope edge — how the three sprint ceremonies differ
Refinement makes individual items estimable and sprint-ready. It does not decide queue order or flag staleness (`jstack:sprint-prep`'s job) and it does not decide what actually gets committed into a sprint or the sprint goal (`jstack:sprint-planning`'s job). If refinement starts negotiating which ready items get pulled into this sprint versus the next, that decision belongs to planning, not refinement.

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
Apply the `jstack-sprint-refinement` workflow using values from `jstack.config.json`. There is no `templates/sprint/` directory — derive the output shape from the Output shape section below rather than looking for a template file.

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

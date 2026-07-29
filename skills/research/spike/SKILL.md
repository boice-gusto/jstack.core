---
name: jstack-research-spike
description: "Time-boxed technical spike: hypothesis, method, go/no-go criteria up front. Report findings even if spike fails."
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
Run a timeboxed feasibility spike: state the question, the box, what was tried, and a go/no-go with the evidence that decided it.
- **Out of scope:** Turning the spike code into production code, and exceeding the timebox silently — report an unfinished spike as unfinished.

## Domain rules — technical spike

### Absolute rules
1. Every spike opens with exactly one falsifiable question stated before work starts — not "explore X" but "can X achieve Y within constraint Z, yes or no." If the request bundles two unrelated questions, split it into two spikes.
2. The time-box is set before work starts and is immutable once set. Reaching the boundary without an answer means stop, write up what's known and unknown, and bring it back for an explicit new decision — never silently extend ([agilekrc](https://agilekrc.com/agile/agile-spike); [Creately](https://creately.com/guides/scrum-spikes/)).
3. A spike's deliverable is a **decision-enabling answer with evidence** — a go/no-go plus what was learned — not working code. Prototype code produced during a spike is disposable by default.
4. Spike code never merges to a production branch by continuation. Converting a spike's findings into real work requires a new, normally-scoped implementation ticket with its own review and test rigor.
5. A spike never writes to production systems, migrates real data, or touches a customer-facing path. If the investigation requires that, it is implementation work wearing a spike's name.
6. Report progress at the timebox's midpoint, not only at the end — a spike that goes silent until the deadline gives the team no chance to re-scope early.

### Thresholds
| Signal | Threshold | Why |
|---|---|---|
| Spike duration | 1–3 days typical; escalate past 5 days without an answer | Beyond this, an open-ended spike has become unbilled implementation, not investigation. |
| Primary questions per spike | exactly 1 | Two-plus unrelated questions make "done" ambiguous and invite scope creep. |
| Progress checkpoint | at 50% of elapsed timebox | Catches silent expansion before the deadline, not after. |
| Code merged to main from spike branch | 0 lines, without a follow-up ticket + normal review | Prototype code skipped the rigor production code requires. |
| Go/no-go criteria defined | before work starts, not at the end | A spike without a stated stop condition can be re-run indefinitely as analysis paralysis. |

### Named anti-patterns
| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Open-ended "investigate X" spike | No falsifiable question means no way to know when it's done — it expands to fill the sprint | Rewrite as "can X achieve Y within Z" before starting |
| Silent time-box extension | Erodes the team's ability to plan sprints; this is exactly how a spike becomes unbilled implementation | Stop at the boundary, report status and learnings, request an explicit new time-box |
| Spike code merged directly to main | Prototype code bypassed the review/test bar production code needs | Require a new implementation ticket with normal review before merge |
| Spike as analysis-paralysis avoidance | Re-running the same investigation because no go/no-go criteria were set | Set stop conditions before the spike starts, not after it stalls |
| Two unrelated questions in one spike | "Done" becomes ambiguous — one question can be answered while the other drags | Split into separate spikes, each with its own time-box |

### Worked example
- **Weak:** "Spend a few days exploring whether we could use library X."
- **Sharp:** "2-day spike: can library X parse our current payload format (`fixtures/payload_v3.json`) at p95 < 50ms without a custom preprocessor? Go: adopt X, file an implementation ticket. No-go: fall back to the existing parser. Time-box ends Thursday EOD regardless of outcome; if unresolved by then, report what's known/unknown and ask for an explicit re-scoped follow-up rather than continuing."
- The sharp version names the question, the measurable pass/fail bar, and the stop behavior — the weak version has no way to ever be "done."

### What this skill must not do
- Not a general project-tracking tool for ordinary story work — spikes are for genuine unknowns, not routine tickets relabeled to skip estimation.
- Not a vehicle for building a production feature under cover of "just investigating."
- Not a substitute for writing the decision down — a spike produces the input to a decision; recording the decision itself belongs to an ADR/architecture skill, not here.

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
Hypothesis, time box, method, go/no-go in the first screenful.
- If spike fails, say stop and report what was learned (still value).

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

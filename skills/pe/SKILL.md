---
name: jstack-pe
description: Route a people/performance-engineering request to the right sub-skill — report-context to assemble/validate a reporting window and team scope against pe.* config, or pe-recon for a proactive team-scoped digest sweep. Not for writing performance narrative about a named individual.
category: pe
effort: low
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Route a people/performance-engineering request to the right sub-skill.
- **Out of scope:** Writing performance narrative or a rating about a named individual, and reporting on a team absent from `pe.teams`.

## Disambiguation — report-context vs pe-recon

Both sub-skills read `pe.*` config and never write narrative about a named person. They differ in **what triggers them** and **what they produce**:

| Signal in the request | Route to | Why |
|---|---|---|
| "Validate/build the reporting context," "assemble the window/teams/projects," anything that gates a **downstream report** on `pe.configured` | `report-context` | It assembles and validates structured JSON context for a report someone else will write — no artifact of its own beyond that context. |
| "Weekly digest," "what's going on for my team," "PE recon," "catch me up," a recurring/scheduled PE catch-up | `pe-recon` | It's a **proactive sweep** across configured sources (Slack, Notion, etc. — same routing as `jstack:recon`), synthesized into a skimmable local HTML digest that opens in the browser. |
| A one-off narrow question about a single ticket, thread, or person's status | Neither — route to `jstack:recon` directly | Both `pe` sub-skills are team/report-scoped; a single-item lookup doesn't need report-context's validation step or pe-recon's full sweep-and-render. |

If the request names a report kind, a schema, or "validate," prefer `report-context`. If it asks for a status sweep, a digest, or "what's new," prefer `pe-recon`. Ask **one** disambiguating question only when the request is genuinely ambiguous between the two (e.g. "give me the PE report" without saying whether they want the assembled context or a rendered digest).

## Domain rules — people and performance engineering
- Assemble the reporting CONTEXT before any narrative: which teams, which projects, and the exact window, all validated against `pe.*` in config. A narrative written before the window is fixed cannot be checked later.
- Report on a team only if it appears in `pe.teams`. An unlisted team means the scope is unconfirmed — say so instead of inferring it.
- Separate observation from evaluation. Describe what happened with a date and a source; do not attach a rating, a level, or a promotion opinion about a named person.
- Single incidents are not patterns. One data point gets labelled as one data point.

## Sub-skills (pick the most specific)
**Under `skills/pe/`:** report-context, pe-recon — see Disambiguation above.

If the user is vague, ask **one** question to disambiguate, then route to the child skill. Do not execute every sub-skill in one turn unless the user asked for a chain.

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
Route to the most specific child skill under `skills/pe/`. If the user's intent is clear, emit `suggested_next: <child-skill>` and stop. If ambiguous, ask one question to disambiguate before routing.

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

## Chaining
This is a **domain orchestrator** — route to the most specific child skill. Do not inline every sub-flow. If the user's task maps to one child, say `suggested_next: <child-skill>` and stop.

## User request

$ARGUMENTS

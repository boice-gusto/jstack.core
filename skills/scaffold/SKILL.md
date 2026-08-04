---
name: jstack-scaffold
description: Scaffold a new skill or plugin using org conventions and checklists.
when_to_use: User wants to create a new skill pack or plugin structure.
category: skill-creator
data_class: internal
disable-model-invocation: true
effort: medium
gbrain_destination: team
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Create the file skeleton for a new skill or plugin that satisfies this repo's conventions and passes its gates.
- **Out of scope:** Writing the skill's domain content, and hand-editing a generated skill body — most bodies come from the generator, so a hand edit to a non-`SKIP` skill is lost on the next run.

## Domain rules — skill and plugin scaffolding
- Generate the directory shape only: `SKILL.md`, `references/`, `evals/`. Never write skill *content* the author has not decided on — a plausible-looking body is harder to fix than an empty one.
- Frontmatter must be inline scalars. `read_front_matter()` in `scripts/apply_detailed_skills.py` is line-based and keeps only lines containing `:`; a YAML block list is silently dropped and the key round-trips empty. Quote any `description` containing a colon.
- A new skill body is GENERATED unless its path is added to `SKIP` in `scripts/apply_detailed_skills.py`. Decide which before scaffolding, and say which you chose — a hand-edit to a non-SKIP body is lost on the next regeneration.
- Every new skill needs eval cases or `bun run check` fails on coverage. Scaffold `evals/` alongside the skill, then run `bun run gen:skill-evals` rather than hand-writing them.
- Set `disable-model-invocation: true` when the skill writes external state, and `context: fork` + `agent: Explore` only when it is genuinely read-only — `Explore` has no Write or Edit tool, so a write skill configured that way cannot do its job.
- After adding a skill, run `bun run docs:generate` so `skill-catalog.json` includes it.

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
Create the directory skeleton only — `SKILL.md` with inline-scalar frontmatter, `references/`, and `evals/` — without writing domain content the author hasn't decided on. Decide whether the new skill's body will be hand-maintained or generator-produced, add its path to `SKIP` in `scripts/apply_detailed_skills.py` if hand-maintained, and state which choice you made. Run `bun run gen:skill-evals` to scaffold eval cases and `bun run docs:generate` so `skill-catalog.json` includes the new skill.

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
Complete the work here. If a natural follow-up exists, add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

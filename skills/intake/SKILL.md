---
name: jstack-intake
description: Convert unstructured feature/ticket requests into shaped ticket fields. Split bundled requests into separate candidates.
when_to_use: Also when shaping a feature idea, PRD snippet, messy notes, or Slack thread into ticket-ready fields (before Jira create).
category: intake
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->
<!-- chains-to: jstack:jira-intake -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Shape raw feature requests, bug reports, or tasks into structured ticket fields. Split bundled asks into separate candidates.
- **Out of scope:** Creating tickets — hand off the payload to `jstack:jira-intake` or clipboard.

## Domain rules — intake
- Shape raw feature requests, bug reports, or task descriptions into structured fields.
- Split bundled requests: one candidate per distinct ask; label splits so the user can recombine.
- If the text is too vague for a ticket, return a short form (summary, AC, type, priority) the user can fill in one pass.
- Never create tickets directly — output is a payload for `jstack:jira-intake` or clipboard.

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
!cat ${CLAUDE_PLUGIN_ROOT}/skills/intake/references/deep-dive.md

### Step 2 — Plan the safe path
Prefer read-only first, then idempotent updates, then irreversible changes — each gated by org norms.

### Step 3 — Execute
Parse the raw text into candidate ticket fields: summary, description (with AC as checklist), issue type, priority, labels.
- If the text contains multiple distinct asks, split into separate candidates and label each.
- If required fields are too vague, return a short form the user can complete in one pass.
- End with `suggested_next: jstack-jira-intake` and the shaped payload.

### Step 4 — Validate
Correct surface, no stray side effects, tone matches `prompts/tones/` if publishing text.

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
| Bundled request too large | Split into first candidate + remainder; confirm split with user. |
| Ambiguous priority/type | Return a 2-option form; do not guess. |

## Chaining
Complete the work here. If a natural follow-up exists (e.g. `jstack:jira-intake` then `jstack:jira-create`), add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

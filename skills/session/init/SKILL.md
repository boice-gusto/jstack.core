---
name: jstack-init-session
description: Start a jstack session: set gbrain target (personal vs team), load sprint/timezone context, confirm integrations.
category: session
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->
<!-- chains-to: jstack:recon -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Start a session: set gbrain target, load sprint and timezone from `jstack time`, confirm integration health.
- **Out of scope:** Silently ending a prior session — ask once if ambiguous.

## Domain rules — session lifecycle
- `init` sets gbrain target, issues or reads `session.current_session_id`, loads context; `end` flushes to GBrain with **provenance** per `gbrain.provenance` and `gbrain-entry-provenance.md`.
- Config keys: `session.*`, `gbrain` URLs + `gbrain.provenance` (config_label, identity, entry_fields), eval hooks.
- Not a login system — the host enforces auth; this manages jstack session state only.

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
Prefer read-only first, then idempotent updates, then irreversible changes — each gated by org norms.

### Step 3 — Execute
**GBrain target (explicit):** Do not assume team vs personal. State `session.default_gbrain_target` from config as the *proposed* default, then confirm with the user if there is any ambiguity (missing session state, conflicting request, or user said “my” vs “team” notes). Only after confirmation, treat the target as set for this session.
Set or read `session.current_session_id` (opaque). Load team context. Echo sprint and timezone from `jstack time` if available.
- Do not end prior session silently — ask once if ambiguous.

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
| Prior session still open | Ask once whether to end it or continue. Do not silently close. |

## Chaining
Complete the work here. If a natural follow-up exists (e.g. `jstack:jira-intake` then `jstack:jira-create`), add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

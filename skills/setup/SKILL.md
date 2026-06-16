---
name: jstack-setup
description: First-time jstack onboarding: run jstack setup wizard, create config, validate with jstack doctor. No secrets in chat.
when_to_use: Also for first-time install, onboarding, jstack doctor failures, MCP setup, or fixing missing jstack.config.json.
category: setup
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Walk the user through first-time onboarding: `jstack setup` wizard, config creation, `jstack doctor` validation, dashboard pointers.
- **Skill catalog:** After `bun run docs:generate`, open `index.html` via a local server (see repo README). The **Setup guide** section mirrors this flow with CLI examples and advanced copy paths.
- **Out of scope:** Writing secrets to markdown or logging tokens. If the user pastes a token, tell them to move it to an env/secret store and rotate.

## Domain rules — setup
- **Team + personal:** `gbrain.team` and `gbrain.personal` are both in schema; `session.default_gbrain_target` picks default. If files/repos are missing, bootstrap from `config/defaults.json` and `config/personal.example.json` — see `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/config-team-vs-personal.md`.
- No secrets in chat. If the user pastes a token, tell them to move it to env/secret store and rotate.
- Validate against `config/schema.json`. Follow `integration-guide.md` for MCP server discovery.
- Do not start arbitrary servers without user opt-in.

## Config and references
- `jstack.config.json` — team ids, integrations, `skill_defaults`, `jira_rules`, `notion`, `gbrain`. Never hardcode.
- Questions (open-ended, one at a time): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/question-patterns.md`
- Discrete choices (when the host supports AskUserQuestion or equivalent): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/ask-user-question-patterns.md`
- Integrations: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/integration-guide.md`
- **Links footer** (when creating/updating resources): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/response-artifacts.md`
- **GBrain bridge:** when `cross_plugins.gbrain.enabled`, list non-empty `skills[]` (expected host skill ids); `jstack doctor` warns if misconfigured.
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
If `jstack.config.json` is missing, create it from `config/defaults.json` (or a template) after user confirm; if team wants a new git repo for shared config, outline `git init` + first commit of **team-only** keys.
For personal: if `jstack.personal.json` (or the path the host uses) is missing, copy `config/personal.example.json` to `~/.config/jstack/jstack.personal.json` and set `gbrain.personal` + `gbrain.provenance.config_label`. See `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/config-team-vs-personal.md`.
Walk through `jstack setup` wizard steps: team name, GBrain team URL, integrations, GBrain personal URL in personal file.
- Validate with `jstack doctor` after creation. Report integration health per service.
- If the user pastes a token, tell them to move it to env/secret store and rotate.
- Point to dashboard for visual confirmation if available.

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
| User pastes token in chat | Tell them to move to env/secret store and rotate. Never log it. |

## Chaining
Complete the work here. If a natural follow-up exists (e.g. `jstack:jira-intake` then `jstack:jira-create`), add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

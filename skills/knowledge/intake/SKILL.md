---
name: jstack-knowledge-intake
description: Ingest raw text into a structured record (title, body, tags). Flag PII/secrets before storage.
category: knowledge
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->
<!-- chains-to: jstack:knowledge-process -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Ingest raw text into a structured record (title, body, tags). Flag PII/secrets before storage.

## Domain rules — knowledge
- **Lookup vs store:** `jstack:knowledge-search` answers from configured sources (`knowledge_base` in config). Intake/process store into gbrain/Notion. See `skills/knowledge/references/gbrain-patterns.md`.
- Intake raw notes → process (tag, dedupe, link) → route to gbrain/Notion per config.
- No invented hierarchy: if a page id is missing, return markdown the user can paste.
- Deduplication: merge duplicates; keep the oldest decision link as canonical.

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

### Persistence gate (before any write)
Do **not** write to GBrain, Notion, or create/overwrite files under `knowledge_base.roots` until the user has **explicitly confirmed**:
1. **Where** it will go: team vs personal **GBrain** (if URLs set), **Notion**, **`knowledge_storage.team.local_checkout` / `personal.local_checkout`** (git-tracked clone), or — if those are unset — **`knowledge_storage.disk_fallback_root`** (default `/tmp/knowledgebase`) under `{team|personal}/<category>/<file>.md`.
2. **That the content is safe to store** (PII/secrets flagged or redacted; user approves the draft).

Until then, output a **preview only** (structured title/body/tags in the message) and ask one focused confirm. If the user has not started a session, say so and point to session init for target selection. **Disk fallback is the default** when Git checkouts and GBrain destinations are not configured for that target.

### Step 3 — Execute
Raw text → title + body + tags. Flag PII/secret before storage.
- gbrain target: team vs personal from session; see `gbrain-patterns.md`.

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
| Duplicate entry detected | Show the existing canonical and ask: merge, update, or skip. |

## Chaining
Complete the work here. If a natural follow-up exists (e.g. `jstack:jira-intake` then `jstack:jira-create`), add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

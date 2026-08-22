---
name: jstack-skill-finder
description: Map vague user goals to specific jstack skills; prefer CLI skills index and domain routers. User asks how to do something or which jstack skill to use; keep answers to 1–3 skills with rationale.
category: knowledge
agent: Explore
context: fork
data_class: non_sensitive
effort: medium
gbrain_destination: inherit
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Given a described need, name the skill that fits and say why the near-misses do not.
- **Out of scope:** Doing the work of the skill it recommends, and inventing a skill that does not exist — if nothing fits, say so plainly.

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

For the portable discovery flow (restate intent, propose 1-3 candidates, prefer routers, CLI fallback, org-overlay handoff), read:
!cat ${CLAUDE_PLUGIN_ROOT}/skills/_core/references/skill-discovery.md

### Step 2 — Plan the safe path
Search for near-duplicates before writing anything new — unresolved duplicates make later retrieval untrustworthy. Carry source and as-of time on every entry. Ask before persisting, and honour the session's team-vs-personal target rather than defaulting to shared.

### Step 3 — Execute
Check the CLI skills index and domain routers first for candidates matching the described need, then narrow against each candidate's `description` in the catalog. Also check whether the need matches a named composite alias (persona + tone + target skill, e.g. `jstack:ceo-brainstorm`, `jstack:executive-research-brief`) — those are the canonical list of aliases and external-pack bridges:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/shortcuts/composites.md
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/shortcuts/gstack-bridge.md
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/shortcuts/superpowers-bridge.md
Name the 1–3 skills that fit and state why each near-miss was rejected; if nothing fits, say so instead of inventing a skill. Never perform the work of the recommended skill yourself.

**Worked example — a genuine near-miss, not a coin flip:**
User: "Find out if we already documented our on-call rotation somewhere."
- `jstack:knowledge-search` fits: the user wants an answer retrieved from an already-configured
  source (`knowledge_base` roots, gbrain, Notion) — this is a lookup, not a request to store
  anything or to be told which skill to use.
- `jstack:skill-finder` (this skill) does *not* fit here, even though the user is technically
  "finding" something: they are not asking "which jstack skill should I use," they are asking a
  question that should be answered from content. Recommending `skill-finder` for a plain content
  lookup would send the user one hop further from the answer instead of straight to it.
- A genuinely vague ask — "help me find stuff" with no object named — *is* `skill-finder`'s job:
  there's no content query yet, only a request to be pointed at the right tool. Ask one
  clarifying question ("find stuff *in the knowledge base*, or find *which skill* to use?")
  rather than guessing.
- The disambiguating signal is whether the user named a lookup target (content, a fact, a doc) —
  route to `search` — or is asking about jstack's own capabilities/skill set — route to
  `skill-finder`. "Which skill handles X" is always `skill-finder`; "what does X say about Y" is
  always `search`.

### Step 4 — Validate
Confirm the entry is findable by the query a future reader would actually use, that provenance is attached, and that no duplicate was left unresolved. Confirm it went to the intended team-vs-personal target.

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
Complete the work here. If a natural follow-up exists (e.g. `jstack-knowledge-intake` then `jstack-knowledge-process`), add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

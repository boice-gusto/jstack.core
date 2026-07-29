---
name: jstack-team-knowledge
description: "Build the team knowledge graph: link issues, ADRs, runbooks. Suggest hubs and flag stale pages."
category: knowledge
disable-model-invocation: true
effort: high
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Build the shared team knowledge graph — issues, ADRs, runbooks — with canonical links, dedupe checks, and staleness flags.
- **Out of scope:** Writing personal or performance commentary into the shared store, and superseding a canonical entry without saying which one it replaces.

## Domain rules — team-knowledge

### Absolute rules
1. **Never write personal data into the shared team store.** An individual's private notes, preferences, or performance commentary get redacted or stripped before capture — the team store is discoverable by the whole team by design, so anything written there is effectively broadcast.
2. Every linked entry (issue, ADR, runbook) carries provenance — source and as-of date — and is checked against near-duplicates before writing; the cost of a wrong canonical is higher here than in personal capture because more people rely on it.
3. A suggested hub page must resolve to entries a team member would actually search for. A hub nobody can find via a normal query creates false confidence the topic is documented.
4. Stale pages (past the configured review window) are flagged explicitly in the graph, not silently left to imply currency — a team following an outdated runbook believing it current is worse than an admittedly gap.
5. No invented hierarchy: if a page id or parent doesn't exist in Notion/gbrain, return paste-able markdown rather than fabricating a link that looks valid but resolves nowhere.
6. Deduplication keeps the **oldest decision link** as canonical and merges the rest into it — canonical means the original decision record, not whichever entry was most recently edited.

### Thresholds
| Signal | Threshold | Source |
|---|---|---|
| Provenance completeness | 100% of linked entries carry source + as-of date | [Where Provenance Ends, Knowledge Decays](https://jessicatalisman.substack.com/p/where-provenance-ends-knowledge-decays) |
| Dedupe check | before every write | prevents parallel "canonical" entries |
| Stale-page flag | past the configured, risk/usage-based review window | [Knowledge Base Governance Framework](https://knowledge-base.software/guides/knowledge-base-governance-framework/) |
| Personal-data scan | 0 personal identifiers/preferences in team-store entries | privacy boundary, non-negotiable |

### Named anti-patterns
| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Copying a personal note into the team graph verbatim | Leaks private context into a store the whole team can see | Redact personal content; capture only the team-relevant fact |
| Building a hub with no discoverable entry point | Team believes the topic is documented, wastes time searching anyway | Verify a plausible search query surfaces the hub before proposing it |
| Treating most-recently-edited as canonical | Loses the original decision rationale in favor of whatever was touched last | Keep the oldest decision link canonical; merge duplicates into it |
| Inventing a Notion page id that doesn't exist | Produces a link that looks valid but 404s, eroding trust in the graph | Return paste-able markdown when no real id exists |
| Leaving a stale runbook unflagged | Team follows outdated steps believing them current | Flag anything past the review window in the graph itself |

### Worked example
- *Weak:* "Added a link between the incident and the runbook, looks connected now."
- *Sharp:* "Linked INC-4021 → `runbooks/payment-retry.md` (source: incident postmortem, 2026-06-14). Duplicate check: an older link from ADR-118 already covers this relationship — keeping ADR-118 canonical, superseding the new one rather than creating a parallel edge. Runbook flagged stale (last reviewed 2025-11-02, past the 6-month window) — recommend re-verifying retry steps before relying on it live. No personal names or 1:1 content included in this entry."

### What this skill must not do
- Does not manage an individual's personal capture — that's `jstack:knowledge-self-knowledge`.
- Must never write personal data into the shared store, regardless of how the request is phrased.
- Does not unilaterally restructure Notion — it proposes links/hubs/stale flags; write-scale changes need user confirmation.

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
Search for near-duplicates before writing anything new — unresolved duplicates make later retrieval untrustworthy. Carry source and as-of time on every entry. Ask before persisting, and honour the session's team-vs-personal target rather than defaulting to shared.

### Step 3 — Execute
Team graph: link issues, ADRs, runbooks. Suggest hubs and flag stale pages.

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

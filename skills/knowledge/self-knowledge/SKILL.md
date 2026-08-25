---
name: jstack-self-knowledge
description: Link personal GitHub activity and gbrain entries. No scraping private repos without token scope.
category: knowledge
data_class: internal
disable-model-invocation: true
effort: high
gbrain_destination: personal
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Link the user's own activity and gbrain entries into a retrievable personal graph, each entry carrying a source and an as-of date.
- **Out of scope:** Copying personal entries into a team store, and scraping repos or org data beyond the configured token's scope.

## Domain rules — self-knowledge

### Absolute rules
1. Every captured entry carries provenance — a source (PR, repo, transcript, self-report) and an as-of date — before it's written. An entry with no source is unverifiable the moment it's needed again.
2. Search for near-duplicates before writing anything new. Two competing personal notes on the same topic, with neither marked canonical, make later retrieval untrustworthy.
3. **Privacy boundary runs both directions.** Personal data captured here (activity, preferences, working-style notes) is never copied into a team/shared store by default; separately, this skill never scrapes private repos or org data beyond what the configured token's scope actually grants.
4. An entry only earns capture if it's retrievable by the query a future search would plausibly use. A note filed under a title nobody would search for is worse than not captured — it creates false confidence the information was saved.
5. Entries past the configured review window are flagged for re-confirmation, not silently trusted — personal knowledge decays exactly like team knowledge, just with a smaller blast radius when it's wrong.
6. If token scope is unclear, ask before assuming broader access — never infer scope from what would be convenient to read.

### Thresholds
| Signal | Threshold | Source |
|---|---|---|
| Provenance completeness | 100% of captured entries carry source + as-of date | [Where Provenance Ends, Knowledge Decays](https://jessicatalisman.substack.com/p/where-provenance-ends-knowledge-decays) |
| Dedupe check | run before every write, not after | prevents competing "canonical" notes |
| Review cadence | risk/usage-based, not flat — high-use personal reference notes reviewed more often than one-off preferences; pull the actual cadence from config | [Knowledge Base Governance Framework](https://knowledge-base.software/guides/knowledge-base-governance-framework/) |
| Retrieval test | entry must resolve to a query a future search would plausibly use | prevents "captured but unfindable" |

### Named anti-patterns
| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Writing without a source | Can't verify later whether it's still true or who to ask | Capture source link and as-of date every time |
| Skipping the duplicate search | Two competing notes on the same topic, neither canonical | Search first; merge or supersede on a match |
| Filing under a title nobody would search | Note exists but is functionally lost — worse than not captured | Use retrieval-cue tags/titles matching the actual future query |
| Copying personal activity into the shared store by default | Leaks preferences or private context into a team-visible store | Personal capture stays personal unless explicitly promoted by the individual |
| Trusting an old entry with no re-check | Personal knowledge decays; a stale entry silently misleads | Flag entries past the review window instead of presenting them as current |

### Worked example
- *Weak:* "Noted: prefers async review over sync pairing."
- *Sharp:* "Captured 2026-07-26, source: self-reported in this session's notes. Retrieval tag: `review-style-preference` (matches how a future search would phrase it). Checked for duplicates under `review`/`pairing` tags: none found. Not synced to the team store — this is a personal working-style note, not a team process decision."

### What this skill must not do
- Does not build or maintain the team-wide knowledge graph — that's `jstack:knowledge-team-knowledge`.
- Does not write personal data into a shared store under any default path.
- Does not scrape private repos or org data beyond the configured token's actual scope.

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
Personal GitHub and gbrain linking: repos starred, own PR themes.
- No scraping private repos without token scope.

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

---
name: jstack-project
description: "Cross-surface project status (Notion/Jira): RAG health, 3 risks, 3 asks, milestone table."
category: project
effort: high
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Cross-surface project health from Notion, Jira, and user-supplied updates. Output: RAG status, 3 risks, 3 asks, milestone table.
- **Out of scope:** Updating Jira or Notion directly — produce a read-only snapshot.

## Domain rules — project status

### Absolute rules
1. RAG color must trace to a stated, pre-agreed threshold (schedule/budget variance, milestone slip) — never assigned from narrative tone. If no threshold exists yet, say that explicitly instead of picking a color from a feeling.
2. A status carried over unchanged for a full reporting cycle with no new evidence is reported as Amber, not the prior color — silence is itself a signal, not confirmation that nothing changed.
3. A schedule slip names exactly one of three causes — scope growth, underestimation, or blockage — never a bare "behind schedule." Each cause implies a different fix, and a blended line hides which one applies.
4. A status must never jump directly from Green to Red between two consecutive reports. If the underlying evidence already crossed a Red-level threshold, the prior report should have shown Amber; a Green-to-Red jump is itself a reporting failure to name, separate from the schedule issue.
5. A milestone is marked "done" only once it resolves to a specific artifact or link — accepting verbal confirmation with nothing to point to is a guess dressed as a status.
6. Every risk and every ask to leadership carries a named owner — an ask with no owner gives leadership nothing to act on.

### Thresholds
| Signal | Threshold | Source |
|---|---|---|
| Schedule variance | Green ≤5% behind plan · Amber 5–15% · Red >15% with no approved recovery plan | [ClearPoint Strategy — RAG status for KPIs](https://www.clearpointstrategy.com/blog/establish-rag-statuses-for-kpis) |
| Budget variance | Green ≤10% over · Amber 10–20% · Red >20% | [ClearPoint Strategy](https://www.clearpointstrategy.com/blog/establish-rag-statuses-for-kpis) |
| Stale-status window | no new evidence for 1 full reporting cycle → report Amber, not the prior color | pattern documented in status-reporting failure analyses |
| Milestone evidence | 100% of "done" milestones resolve to a named artifact/link, not verbal confirmation | completeness check |

### Named anti-patterns
| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Watermelon status (Green outside, Red inside) | Report reads fine while anyone close to the work knows it's in trouble | Tie color to the pre-agreed threshold, never to tone |
| One-line "behind schedule" covering all causes | Hides which lever fixes it — descoping doesn't fix a blocker | Name scope growth / underestimation / blockage explicitly |
| Green-to-Red jump with no intermediate Amber | By the time it's undeniably Red, recovery options have narrowed | Require Amber as the mandatory intermediate step once a threshold is crossed |
| "Done" on say-so | Nothing to check the claim against later | Require the artifact/evidence link before marking a milestone done |
| Ask or risk with no owner | Not actionable by the reader | Pair every risk/ask with a named owner |

### Worked example
- *Weak:* "Project is a bit behind but the team is working hard, should be fine."
- *Sharp:* "Status: Amber (was Green last cycle; variance moved from 3% to 11% behind baseline — inside the 5–15% Amber band). Cause: scope growth — two integration requirements the sponsor approved on 2026-07-10, not underestimation of the original scope. Milestone 'API contract signed off' marked done, evidenced by the signed doc linked in Notion, not verbal confirmation. Risk: integration scope may grow further — owner: PM, watching sponsor requests. Ask: confirm whether the two July additions are in scope for this milestone or the next — owner: sponsor, needed by Friday."

### What this skill must not do
- Does not perform the multi-persona ship/no-ship reconciliation of an existing status draft — that audit is `jstack:review-project-review`; this skill produces the original cross-surface snapshot.
- Does not write back to Jira or Notion — output is a read-only snapshot.
- Does not invent a baseline, approval date, or milestone definition that wasn't provided — ask, or state the status can't be computed without it.

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
!cat ${CLAUDE_PLUGIN_ROOT}/skills/project/references/deep-dive.md

### Step 2 — Plan the safe path
Read current state before changing it. Prefer the reversible action; when an action is irreversible, show what will change and get explicit confirmation first. If a required id or path is missing from config, stop and ask — never substitute a guess.

### Step 3 — Execute
Pull data from Notion project page and Jira board (or accept user paste if integrations are missing).
- Build: RAG status line, milestone table (name, date, status), 3 risks with owner, 3 asks to leadership.
- If Jira is unavailable, accept epic keys or a pasted sprint view.
- Output is read-only — do not update Notion or Jira from this skill.

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
| Jira board not linked | Accept epic keys or user paste; note the data gap in output. |
| Stale Notion page | Show last-updated date; suggest refresh before sharing externally. |

## Chaining
Complete the work here. If a natural follow-up exists, add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

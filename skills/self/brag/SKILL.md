---
name: jstack-self-brag
description: Daily or weekly activity brag from Slack, GitHub, and Jira mapped to config-defined impact dimensions; parallel gather; tiered PR labels; personal gbrain by default.
category: self
disable-model-invocation: true
effort: high
gbrain_destination: personal
data_class: people_performance
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Assemble a daily or weekly brag entry from Slack, GitHub, and Jira activity mapped to configured impact dimensions, weighting significance with tiered PR labels. Save to the personal gbrain by default.
- **Out of scope:** Formal performance-review narratives — use `jstack:self-eval`.

## Domain rules — brag

Personal-target by default: this writes to the user's own gbrain and covers only their own,
verifiable work.

### Absolute rules

1. **Capture within the same reporting cycle the work happened.** A brag entry drafted from
   memory months later is a reconstruction, not a contemporaneous record, and reconstruction is
   lossy in a specific direction: only the most salient or most recent items survive, which is
   exactly why [a brag document's value is the log, not the eventual recall](https://jvns.ca/blog/brag-documents/).
2. **State the impact, not just the output.** "Shipped the migration" is an activity; "shipped
   the migration, cutting P1 incident volume from N to M over the following two weeks" is
   impact — an entry with no stated consequence is a to-do-list item, not a brag entry, and
   conflating output with impact is exactly the gap [outcome-over-output framing exists to close](https://www.svpg.com/outcomes-are-hard/).
3. **Tier significance by the configured label** (size, blast radius), not by entry length or
   personal enthusiasm — a two-line hotfix that stopped an outage can outrank a large refactor if
   the configured tier says so.
4. **Only the user's own verifiable contribution.** Never fold a teammate's work into the user's
   entry as if solely theirs, and never store a teammate's private activity data without their
   consent and redaction.
5. **Label a self-reported, unsourced claim `[self-reported, unverified]`** rather than
   presenting it with the same confidence as an API-sourced commit/PR/ticket.
6. **Calibrate in both directions.** Don't inflate a routine task into a headline accomplishment,
   and don't habitually under-claim high-impact work out of modesty — either failure defeats the
   document's purpose of preserving accurate evidence.
7. **A team win is not automatically an individual line item** unless the individual's specific,
   attributable contribution is named.

### Thresholds / criteria

| Signal | Rule | Source |
|---|---|---|
| Capture cadence | Logged within the same day/week the work happened, not reconstructed later | [Julia Evans — "Get your work recognized: write a brag document"](https://jvns.ca/blog/brag-documents/) |
| Impact statement | Every entry states output AND consequence; output alone is incomplete | outcome-vs-output distinction, [SVPG — Outcomes Are Hard](https://www.svpg.com/outcomes-are-hard/) |
| Attribution | Only the user's own verifiable contribution; teammate work needs explicit consent + redaction | this skill's own personal-target-by-default contract |
| Source confidence | API-sourced entries and self-reported claims are visually distinguished, never blended | provenance discipline shared with `reports/*` |

### Named anti-patterns

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| Reconstructing months later from memory | Loses most entries to recency/salience bias by write time | Log within the same day/week the work happens |
| Listing output with no stated consequence | Reads as a to-do list, not a brag entry | State the measured or observed effect, not just the action |
| Claiming a team win as a solo line item | Misattributes credit that isn't verifiably the user's own | Name the user's specific, attributable contribution only |
| Treating every PR as equally significant | Buries the one high-impact fix among routine ones | Tag entries with the configured significance tier |
| Habitual under-claiming of high-impact work | Loses evidence the document exists to preserve | Calibrate to the artifact's actual impact, not to modesty |

### Worked example

- *Weak:* "Did a lot of good work this week on the migration project."
- *Sharp:* "2026-07-22: Shipped PR #482 (auth-service migration, tier: high-blast-radius per
  config), cutting open session-expiry P2 tickets from 4 to 0 within the week — verified via
  ticket-close log. Logged same day; source: GitHub PR + Jira closure, not self-reported."

### What this skill must not do

- Not for compiling a teammate's activity — personal target by default.
- Does not substitute for `self/explain`'s short per-update narrative or `self/impact-prep`'s
  rubric-mapped evidence gather — this is the running contemporaneous log those draw from.
- Must not present a self-reported, unverified claim with the confidence of a sourced one.

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
Personal target by default; write to a shared store only when the user asks explicitly. Never place another person's performance data or PII in a personal or team note.

### Step 3 — Execute
Pull the user's own activity from Slack, GitHub, and Jira for the requested cycle, and map each item to the impact dimensions defined in config. For each entry, state the output and its measured or observed consequence, tag significance using the configured PR label tier rather than length or enthusiasm, and mark any self-reported, unsourced claim `[self-reported, unverified]`. Drop or flag anything that isn't the user's own verifiable contribution before writing the entry to the personal gbrain.

### Step 4 — Validate
Confirm the write went to the personal target unless explicitly told otherwise, and that no other person's PII or performance data is present.

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
| Emotional crisis language | Be brief, kind; suggest professional support. Do not role-play therapy. |
| User pastes a secret | Refuse to store; tell them to rotate immediately. |

## Chaining
Complete the work here. If a natural follow-up exists, add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

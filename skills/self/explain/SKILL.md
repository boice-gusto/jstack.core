---
name: jstack-self-explain
description: Short narrative of recent work for PR descriptions or standup, tying commits to user impact.
category: self
effort: high
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Write a short narrative of recent work — commits, tickets, reviews — tying it to user impact for a PR description or standup update. Keep it factual; never invent work that did not happen.
- **Out of scope:** Full accomplishment reports — use `jstack:self-brag`.

## Domain rules — explain

### Absolute rules

1. **Describe what happened and its effect, not an inferred motive.** "I really pushed hard on
   this" can't be verified from the commit history and doesn't belong in the narrative.
2. **Every claim traces to a commit, ticket, or review comment that exists.** Do not narrate work
   that isn't in the record, even to make an update sound more complete.
3. **State outcome over output where the data exists.** "Reduced API p95 latency by a measured
   amount" beats "refactored the query layer." If no outcome measurement exists yet, state the
   output and mark the outcome `[not yet measured]` — don't invent a plausible-sounding number.
4. **Cover only the period since the last update.** A standup narrative that reaches back further
   to pad length misrepresents "since last time."
5. **Match length to venue.** A PR description can run several sentences of context; a standup
   update is one to three lines — the same event gets different treatment without changing what
   happened.
6. **State a revert or block alongside forward progress.** Omitting a revert from "what happened
   since last time" misleads about actual state.
7. **This narrates recent, already-completed-or-in-flight work.** It does not compile a broader
   accomplishment record — that's `self/brag`'s job over a longer window.

### Thresholds / criteria

| Signal | Rule | Source |
|---|---|---|
| Venue length | Standup: 1–3 lines; PR description: as much as justifies the diff, no fixed minimum | this skill's own venue contract |
| Claim traceability | Every sentence maps to an existing commit/ticket/review comment | provenance discipline shared with `reports/*` |
| Outcome vs. output | State a measured outcome when available; otherwise state output and mark `[not yet measured]` | [SVPG — Outcomes Are Hard](https://www.svpg.com/outcomes-are-hard/) |
| Coverage window | Only the period since the prior standup/PR base | this skill's own scope contract |

### Named anti-patterns

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| Narrating an inferred motive ("I really pushed hard") | Unverifiable from the record, reads as self-serving | State what happened and its observed effect |
| Padding by reaching past "since last time" | Misrepresents the actual period covered | Cover only the period since the last update |
| Describing only forward progress after a revert | Misleads about current state | State the revert/blocker alongside the progress |
| Inventing an outcome number with no measurement | Fabricated precision looks more credible than it is | Mark the outcome `[not yet measured]` |
| Same-length narrative for a standup and a PR description | Wrong length for the venue, buries the point | Match length to venue: 1–3 lines vs. fuller context |

### Worked example

- *Weak:* "Worked hard on the caching layer this week, made real progress."
- *Sharp:* "Since last standup (2026-07-22): merged the caching-layer PR (#503); measured p95
  latency on the `orders` endpoint dropped from 340ms to 210ms in yesterday's dashboard snapshot.
  One follow-up (#505) was reverted after a flaky test surfaced — reopening today."

### What this skill must not do

- Not for compiling a longer accomplishment record — that's `self/brag` over a longer window.
- Must not narrate work that isn't in the commit/ticket/review record.
- Does not invent an outcome measurement that doesn't exist yet.

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
Short narrative of recent work for PR description or standup. Tie commits/tickets to user impact.

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

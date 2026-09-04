---
name: jstack-engineering-show-me-your-work
description: >-
  Keep a reviewable decision trail for long-running or unattended work — a TSV log with one row
  per decision (what, why, evidence, result) — so a human who wasn't watching can reconstruct
  what happened and trust the result without rerunning the work or reading the whole transcript.
  Local scratch by default; commit it only when the work is ambitious enough that a reviewer
  needs the trail to trust the result. Use for autonomous or multi-phase runs, "show me your
  work," or any task a human will review after stepping away.
  Do NOT use this for anonymous aggregate metrics (token counts, latency, success rate) — that's
  `telemetry/`, a different mechanism with a different audience. Do NOT use this for personal
  reflection — that's `jstack:self-diary`. This is a task-scoped audit trail for a reviewer who
  needs to trust a specific run, not a metrics pipeline or a personal journal. Inspired by
  pstack's `show-me-your-work` skill, adapted to jstack conventions.
category: engineering
effort: medium
generator: skip
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config, task_description -->
<!-- outputs: decision_log_path -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Produce a decision trail a reviewer can read top to bottom, follow the evidence pointers on, and
trust — without having watched the work happen or read the full transcript. One row per real
decision or checkpoint, evidence as a pointer (commit SHA, file:line, PR number, artifact path),
never a paragraph.
- **Out of scope:** Replacing telemetry (anonymous, aggregate, machine-read) or `jstack:self-diary`
  (personal, reflective, not for a reviewer); logging routine actions that need no review; writing
  the log retroactively from memory after the work is already done — the log is only as trustworthy
  as its distance from the decision it records.

## Domain rules — decision trail
- **The format is fixed: `ts, phase, decision, why, evidence, result`, one row per decision.** If a
  row doesn't fit on one line, the decision isn't crisp yet — split it or wait until it is.
- **Append-only.** A wrong call gets a new row that supersedes it; never edit or delete history —
  an edited trail is not a trail, it's a story rewritten after the fact.
- **Evidence is a pointer, not prose.** A commit SHA, a `file:line`, a PR number, a trace or
  screenshot path. If there's no pointer, the row is a claim, not evidence.
- **Local scratch by default, gitignored, discardable.** Commit it only when the work is ambitious
  enough that a reviewer genuinely needs the trail to trust the result (a large cross-language
  port, a multi-week migration, anything where confidence has to be shown, not assumed).
- **Log decision points and checkpoints, not every action.** A fork chosen, a unit completed with
  its verification result, a pivot or revert with its trigger, a blocker surfaced, a gate fixed.
  For loop runs, one row per iteration. Skip the trivial and self-evident.
- Write each row the way you'd tell a teammate what you did — plain words, concrete actions, no
  jargon or AI-sounding filler (`jstack:writing-humanizer`'s standard applies to log text too).

### Named anti-patterns

| Anti-pattern | Why it's wrong | Do this instead |
|---|---|---|
| Logging a conclusion without evidence | "decided to proceed" with no pointer is a claim a reviewer can't check, not a decision trail | Every row's evidence resolves to something real: a SHA, a path, a line number |
| Writing the log after the fact, from memory | Retroactive rows drift toward the story you'd like to have told, not what happened | Log as you go, at the moment of the decision — a row written 20 minutes later already has this problem |
| Editing or deleting a wrong row | Erases the record of the mistake, which is often the most useful row in the log | Append a new row that supersedes it; the wrong call and the correction both stay visible |
| Logging every action | A 200-row log of trivia is as unreviewable as no log at all — the signal drowns | Log decision points and checkpoints only; skip what's self-evident from the diff |
| Committing a scratch log nobody asked to review | Adds noise to the PR for a routine change that needed no trail | Default local and gitignored; commit only when the work's stakes actually warrant a reviewable trail |

### Worked example

- *Weak:* `2026-05-24 widget moved styles over, looks fine`
- *Sharp:* `2026-05-24T11:15:00Z	widget	moved the widget styles over without changing how it looks	keep the change small and the result identical	commit 7c21e0a, pixel-diff 0	looks identical, tests pass`

The sharp row has an ISO timestamp (the timeline axis), names the phase, states the decision in
one line, gives the real reason in plain words, points to a commit AND a concrete pixel-diff
result as evidence, and states the outcome as a predicate a reviewer can check — not "looks fine."

## Config and references
- `jstack.config.json` — team ids, integrations, `skill_defaults`, `jira_rules`, `notion`, `gbrain`. Never hardcode.
- Log format template: `${CLAUDE_PLUGIN_ROOT}/skills/engineering/show-me-your-work/references/decision-log-template.tsv`
- Append helper (stamps `ts`, strips stray tabs/newlines, escapes spreadsheet-formula-triggering
  cells so a reviewer opening the log doesn't trigger formula execution from attacker- or
  generated-controlled evidence text):
  `${CLAUDE_PLUGIN_ROOT}/skills/engineering/show-me-your-work/scripts/log.sh <logfile> <phase> <decision> <why> <evidence> <result>`
- Questions (open-ended, one at a time): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/question-patterns.md`
- Chaining: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/chaining-guide.md`

## Intake
1. Parse `$ARGUMENTS` for the task this trail is for, and whether the user wants it committed
   (ambitious/high-stakes work) or left as local scratch (the default).
2. If unclear whether this run needs a trail at all, ask **one** question: is this work a human
   will review after stepping away, or work you're doing live with the user watching? A live,
   watched session rarely needs this — the transcript already is the trail.
3. If the request bundles this with the actual task, do both: run the task, log decisions as you
   go, hand back the trail alongside the result.

## Procedure
### Step 1 — Load config and pick the log location
Read relevant keys from `jstack.config.json` if this run has a project/team context. Default the
log to a local scratch path (e.g. `.tmp/decisions/<task-slug>.tsv`, matching this repo's own
`.tmp/a2a/`-style gitignored-scratch convention) unless the user or the stakes call for a
committed trail — in that case, place it where it'll render in the PR (repo root or alongside the
change) and say explicitly that it's meant to be committed.

### Step 2 — Plan the safe path
Copy the header row from `references/decision-log-template.tsv` to start a clean log rather than
hand-typing column names — a typo'd header breaks every row appended after it. Never let generated
or user-supplied text reach the log unescaped; always append through `scripts/log.sh`, which
strips stray tabs/newlines and neutralizes leading `=`/`+`/`-`/`@` characters.

### Step 3 — Execute
Do the actual work, and at each real decision point or checkpoint, append a row via `log.sh`. One
row per decision, evidence as a pointer, plain words for `why`. Do not batch-write rows at the
end from memory — log as you go, at the moment of the decision, or the trail degrades into the
story you'd like to have told rather than what happened.

### Step 4 — Audit the log against what actually happened
Before handing back, read back through the log against the real record (this host's own
transcript or session log, if it exposes one, plus the actual commits/artifacts the log cites):
- Every row maps to a real action — cut invented or aspirational entries.
- Each row's evidence actually resolves and shows what the row claims.
- A fork, pivot, or abandoned approach that shaped the work but isn't logged is a gap — add it.
- Drop padding: if nobody would audit a row, it doesn't earn its place.
Fix the log, not the story — if the work diverged from what a row claims, the row is wrong, not
the work.

If this host can dispatch a second, independent reviewer (e.g. a different model or a fresh
subagent that did not do the work) before handing back, use it — self-review by the same
run that produced the trail is not a substitute for fresh eyes, and this repo's own
`evals/a2a/` harness already establishes the pattern of an independent judge for exactly this
reason. When no independent reviewer is available, say so plainly in the handoff rather than
presenting a self-audit as if it were independent.

### Step 5 — Summarize and hand off
State the log's location, whether it's committed or local scratch, and its row count. If a
second reviewer ran, lead with `reviewed by <name/model>` and list what they flagged — "no flags"
is a valid value, omitting the reviewer line is not, when one was actually run.

## Output shape
Use a domain-appropriate heading, then:
- **Summary** (2–4 sentences: what the trail covers, where it lives, committed or not)
- **Details** — row count, notable decisions/pivots worth a reviewer's attention
- **Next steps** with owner + timeline if known
- **Limitations** (no independent reviewer available, any gap found during the Step 4 audit)
- For eval-gated skills, end with `result_ok: true` or `result_ok: false` + reason

## Failure modes

| Symptom | Recovery |
|---------|----------|
| Log grows to hundreds of trivial rows | Stop, prune to decision points and checkpoints only; a log nobody will read is as useless as no log |
| A row's evidence pointer doesn't resolve | Fix the row at audit time (Step 4) — a broken pointer is a gap the audit exists to catch |
| Task ends without ever logging a decision | Say so; don't fabricate a retroactive trail — a real "nothing warranted a row" is more honest than an invented one |
| User asks to edit/delete a past row | Refuse; append a superseding row instead — the log is append-only by design |
| No independent reviewer available for Step 4 | State that plainly in the handoff rather than presenting the self-audit as independent |

## Chaining
Complete the work here. This skill doesn't stand alone — it's the audit-trail mechanism other
skills or a long autonomous run route to instead of inventing their own log format. Reference it
by name; don't restate the columns elsewhere. Do not auto-invoke without user intent.

## User request

$ARGUMENTS

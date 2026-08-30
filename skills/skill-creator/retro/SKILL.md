---
name: jstack-skill-creator-retro
description: Read back the local jstack memory store (jstack memory search) plus recent eval reports and declined-edit history, and produce a self-improvement retro -- what's been learned, what recurred often enough to promote into a real fix, and what's still just a log entry. Use when the user asks "what have we learned," "do a retro on our skills," "what keeps coming up," or as a periodic hygiene routine. Not for a personal-life retrospective -- that's self/lookback.
category: skill-creator
context: fork
agent: Explore
effort: high
---

<!-- Chain Contract -->
<!-- inputs: optional $ARGUMENTS (skill/kind filter, lookback window), .jstack/memory.jsonl, evals/.reports/*.json, .jstack/claude-md-improver-history.json -->
<!-- outputs: retro_report (learned/recurring/promoted-to-fix/still-just-a-log-entry), optional skill_deep or SKIP-set follow-ups -->
<!-- chains-to: jstack:skill-creator, jstack:update-config -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for

Turn the jstack memory store from a pile of log entries into an actual improvement: read back
everything logged via `jstack memory log`, group it, and decide what's a one-off note versus a
pattern that recurred enough times to deserve a real fix (a `skill_deep` entry, a SKIP-set pin, a
CLAUDE.md edit, a new eval case) rather than just being read and forgotten again next retro.

- **In scope:** Reading `jstack memory search`, `evals/.reports/*.json`, and
  `.jstack/claude-md-improver-history.json` for this project; synthesizing what recurred; naming
  concrete promotion candidates.
- **Out of scope:** Writing the fix itself — this skill diagnoses and recommends, then hands off
  to `jstack:skill-creator` (or the relevant CLI/config command) for the actual edit, with the
  user's explicit go-ahead. Also out of scope: personal-life reflection (moods, habits, calendar
  patterns) — that's `jstack:self-lookback`, a different subject entirely.

## Domain rules — skill-creator/retro

### Absolute rules

1. **A "recurring pattern" needs the same `kind`+`key` (or a materially identical `insight`)
   logged 2+ times, or the same eval case failing across 2+ separate report runs.** One log entry
   is a note; it does not get promoted to "we should fix this" status on a single occurrence — the
   same evidentiary bar `self/lookback` and `pe/report-context` already apply to their own pattern
   claims applies here too.
2. **Every promotion recommendation names the exact mechanism**, not just "we should be more
   careful": a `skill_deep/<category>` entry, a `SKIP` pin, a CLAUDE.md line, a new eval case, or a
   `jstack.config.json` default. "Encode the lesson in structure, not prose that will be repeated
   next retro" — matching this skill's own bar for output.
3. **Never fabricate a memory entry, eval result, or history record that isn't actually present.**
   If the store is empty or a report file is missing, say so plainly and report what genuinely
   nothing has been learned yet (or that this is the first retro), rather than inventing plausible
   history to make the report look substantive.
4. **State the exact window and source files read** (e.g. "42 memory entries, 2026-07-01 to
   2026-08-22; evals/.reports/quick-latest.json"). An undisclosed window risks implying more
   history was reviewed than actually was.
5. **A declined CLAUDE.md edit that keeps getting proposed is itself a recurring pattern**, not a
   settled decision to ignore — cross-reference `.jstack/claude-md-improver-history.json` against
   fresh evidence; if the same fingerprint would fire again with stronger evidence than when it
   was declined, say so instead of silently respecting a stale decline forever.
6. **Group by `kind` before writing the report** (fact / decision / preference / pattern) — a flat
   chronological dump makes recurrence invisible; grouping is what makes the promotion decision
   legible.

### Thresholds

| Signal | Threshold | Why |
|---|---|---|
| Pattern recurrence | ≥2 occurrences (same kind+key, or materially identical insight) before recommending promotion | One occurrence is a note, not evidence of a pattern worth restructuring |
| Eval-failure recurrence | Same case failing in ≥2 separate report runs | A single failing run can be transient (flaky fixture, missing API key); repetition is the signal |
| Report freshness | State the report file's own timestamp/generatedAt field | An eval report from weeks ago describes stale state; the retro must say how old it is |
| Promotion mechanism named | 100% of "should fix" findings name a concrete mechanism (skill_deep entry / SKIP pin / CLAUDE.md line / eval case / config default) | A recommendation with no mechanism is advice, not a retro output |

### Named anti-patterns

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| Promoting a single log entry to "we should fix this" | No repetition means no evidence it's actually a recurring problem, just one observation | Wait for a second occurrence, or explicitly flag it as "watching, not yet a pattern" |
| Vague recommendation ("be more careful about X") | Not a mechanism — will not survive to the next retro any better than the original mistake did | Name the exact file/field/gate that should change |
| Silently dropping an empty or missing source (no memory entries, no eval report) | Looks like a thorough retro was done when key inputs were actually unavailable | State explicitly which sources were empty/missing and that the retro is partial |
| Treating a declined CLAUDE.md edit as permanently settled | The decline may have been correct at the time but new evidence can change the calculus | Re-check declined fingerprints against current evidence; note if a decline should be revisited |
| Flat chronological log dump as the "report" | Buries recurrence in noise; the user has to do the grouping themselves | Group by kind first, then flag what recurred within each group |

### Worked example

- *Weak:* "Looked through the memory log, saw some stuff about config validation. Might be worth
  looking into at some point."
- *Sharp:* "Reviewed 18 memory entries (2026-07-01 to 2026-08-22) and evals/.reports/quick-latest.json
  (generated 2026-08-22). Recurring pattern: `pattern/config-validation-skipped` logged 3 times
  (2026-07-10, 2026-07-28, 2026-08-15), each time describing a skill that read `jstack.config.json`
  without calling `bun run validate-config` first and silently used a wrong default. Promotion
  recommendation: add a `skill_deep` rule requiring `Step 1 — Load config` to name
  `validate-config` explicitly, not just 'read relevant keys' (currently generic across ~40
  skills) — concrete mechanism: edit `scripts/skill_deep/config_deep.py`, regenerate, verify via
  `bun run skills-depth:strict`. One eval (`self/remember`) failed in both of the last 2 report
  runs — reason: a fixture references a `data_class` value that no longer validates; recommend
  updating the fixture, not the schema. No declined-edit history file found for this project;
  this appears to be the first retro run here."

### What this skill must not do

- Does not write the fix itself — names the mechanism and hands off to `skill-creator` or the
  relevant command, with the user's go-ahead.
- Does not treat a single occurrence as a pattern, and does not fabricate history when a source
  file is empty or missing.
- Does not cross into personal-life retrospective territory (moods, habits, calendar) -- that's
  `self/lookback`'s job, not this skill's.
- Does not silently respect a stale declined-edit fingerprint when fresh evidence would change it.

## Config and references
- `jstack.config.json` — team ids, integrations, `skill_defaults`, `jira_rules`, `notion`, `gbrain`. Never hardcode.
- Memory store: `jstack memory search --json` (see `cli/src/lib/memory-store.ts`).
- Eval reports: `evals/.reports/quick-latest.json`, `evals/.reports/a2a-latest.json` if present.
- Declined-edit history: `.jstack/claude-md-improver-history.json` if present (see `skill-creator/improve-claude-md`).
- Chaining: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/chaining-guide.md`

## Intake
1. Parse `$ARGUMENTS` for an optional `kind`, `skill`, or lookback-window filter; default to everything on record.
2. If the memory store, eval reports, and declined-edit history are all absent, say so plainly and stop -- there is nothing to retro on yet, and that is itself the honest finding.

## Procedure

### Step 1 — Gather

Run `jstack memory search --json` (with any requested `--kind`/`--skill`/`--limit` filters). Read
`evals/.reports/quick-latest.json` and `evals/.reports/a2a-latest.json` if present. Read
`.jstack/claude-md-improver-history.json` if present. Note which sources were actually available.

### Step 2 — Group and find recurrence

Group memory entries by `kind`. Within each group, cluster by `key` (or materially identical
`insight` text). Flag any cluster with ≥2 entries as a recurring pattern. Cross-reference eval
reports for any case that failed across more than one available report run.

### Step 3 — Decide what's promotion-worthy

For every recurring pattern or repeat eval failure, name the exact mechanism that would encode it
permanently (see Absolute rule 2). For everything else, note it as "observed once, watching."

### Step 4 — Report

Produce the retro report (see Output shape). Ask the user, in one batched question, which
promotion recommendations (if any) they want turned into an actual change now versus deferred.

### Step 5 — Hand off

For accepted promotions, suggest the concrete next skill/command (`skill-creator`, a direct file
edit, `jstack memory log` to record the retro's own meta-finding) rather than making the edit
inside this skill.

## Output shape

- **Sources reviewed** — which files/commands, and their date range or generation timestamp; note explicitly if any were empty or missing.
- **Learned this period** — grouped by kind (fact / decision / preference / pattern), one line each.
- **Recurring (promotion candidates)** — cluster, occurrence count, dates, and the named mechanism to encode it permanently.
- **Watching (single occurrence)** — noted but not yet promoted.
- **Declined-edit re-check** — any previously declined CLAUDE.md fingerprint where fresh evidence changes the calculus.
- **Next step** — the one batched question to the user about which promotions to act on now.

## Failure modes

| Symptom | Recovery |
|---------|----------|
| Memory store, eval reports, and declined-edit history all absent | Say so plainly; report "nothing to retro on yet" rather than fabricating findings. |
| `jstack memory search` command unavailable (older jstack.core checkout) | Say the local memory store isn't available in this checkout; skip to whatever eval/history sources exist. |
| Eval report file present but malformed JSON | Note it as unreadable; do not guess its contents. |
| User asks for a retro scoped to one skill that has zero memory entries | Say plainly that skill has no logged history yet; that absence is itself informative. |

## Chaining
Suggest `suggested_next: jstack-skill-creator` for any accepted promotion that needs a SKILL.md or `skill_deep` edit. Do not make the edit inside this skill. Chains to `jstack:update-config` only when persisting new defaults, not on every run.

## User request

$ARGUMENTS

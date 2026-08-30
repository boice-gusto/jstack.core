---
name: jstack-knowledge-reflect
description: >-
  Mine THIS session's own transcript for durable, reusable lessons once a task has landed — not
  mid-task. Runs 2–3 independent adversarial reviewer passes over every candidate lesson (did it
  actually work, was the approach sound, was there a cheaper way), then one synthesis pass that
  buckets each candidate into Accepted / Rejected / Backlog, and stops for explicit human
  confirmation before handing the Accepted list to `jstack:team-knowledge` or
  `jstack:self-knowledge` for the actual write — this skill never writes to gbrain itself. Use
  after a hard debug, a long multi-step task, or a project wrap-up to ask "what should a future
  session already know so it doesn't repeat this mistake or redo this work." Trigger phrases:
  "reflect on this," "what did we learn," "do a retro before we close this out," "mine this
  session for lessons," "capture what we just learned." Not for knowledge pasted in from outside
  this session — use `jstack:knowledge-intake`; not for the write itself — use
  `jstack:knowledge-process`, `jstack:team-knowledge`, or `jstack:self-knowledge`; not for
  reading back logged history across many past sessions — use `jstack:skill-creator-retro`.
category: knowledge
effort: high
gbrain_destination: none
data_class: internal
generator: skip
---

<!-- Chain Contract -->
<!-- inputs: current_session_transcript (implicit), optional $ARGUMENTS topic hint, jstack_config -->
<!-- outputs: accepted_rejected_backlog_report (unwritten, unconfirmed) -->
<!-- chains-to: jstack:knowledge-search, jstack:team-knowledge, jstack:self-knowledge -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for

Turn the session that just happened into candidate knowledge-base entries, screen every candidate
through independent adversarial scrutiny before it's proposed, and stop for a human decision —
never a silent write. This is the durable-knowledge counterpart to a code review: a single pass
that decides "what to write" and asks once is exactly the gap this skill closes, by forcing
disagreement between reviewer lenses to surface before anything is proposed.

- **In scope:** Reading back this session's own transcript (not a paste, not a past log) for
  candidate lessons; running independent reviewer passes per candidate; bucketing into
  Accepted/Rejected/Backlog; stopping for confirmation; handing the Accepted list to the correct
  write skill.
- **Out of scope:** Writing to gbrain/Notion itself — that is always `jstack:knowledge-process`,
  `jstack:team-knowledge`, or `jstack:self-knowledge`'s job, never this skill's. Also out of scope:
  structuring a note the user pastes from outside this session (`jstack:knowledge-intake`), and
  reading back a cross-session historical log for recurrence (`jstack:skill-creator-retro`) — this
  skill's only source is the current transcript.

## Domain rules — reflect

### Absolute rules

1. **Invoke this at the end of a task, never mid-task.** A lesson about an approach that might
   still change is not durable yet — running this before the task lands captures a guess, not a
   result. If asked to run mid-task, say so and suggest waiting for the task to actually land.
2. **No `context: fork` on this skill's own frontmatter, unlike `jstack:knowledge-search`.** A
   forked skill's content becomes an isolated subagent's entire prompt with no access to
   conversation history — exactly the one thing this skill needs, since its subject *is* the
   current session's transcript. Keep this skill running in the main context so it can actually
   read what happened.
3. **Draft each reviewer lens's verdict before reading any other lens's verdict.** Run 2–3
   independent passes per candidate — did it actually work (outcome), was the approach sound
   (soundness), was there a cheaper way (cost) — the same "isolate before reconciling" discipline
   `jstack:thermonuclear-review` applies to its six lenses. When the host's subagent dispatch can
   inherit the current conversation (a context-preserving fork, not an isolated one), dispatch one
   lens per call in a single parallel batch so each lens can actually see the transcript directly;
   otherwise paste the candidate plus the relevant transcript excerpt into each dispatched lens's
   prompt explicitly, since an isolated subagent does not inherit history by default.
4. **Search before proposing novelty, reusing `agents/knowledge-curator.md` Prime Directive 3 —
   do not reinvent that search.** Before a candidate can be marked Accepted, run
   `jstack:knowledge-search` (or the team graph) for a near-duplicate. This screening search
   answers "is this novel enough to propose," a different question from the write skill's own
   search-before-write gate, which answers "is this safe to actually persist now" — running this
   skill's search does not exempt the destination skill from running its own.
5. **A candidate that would contradict or supersede an existing canonical entry is never routed
   straight to Accepted.** Reusing Prime Directive 10's ask-before-overwrite discipline: flag the
   collision by name (which entry, what it currently says) in the handoff note itself, so the
   write skill's own confirmation gate has the context to ask the right question — this skill
   surfaces the collision, it does not resolve it.
6. **Durability requires evidence, not a vibe.** A candidate earns Accepted only if it (a) recurs —
   corroborated by ≥2 distinct moments in this session, or a prior `jstack:knowledge-reflect` run
   surfaced the same pattern — or (b) caused measurable rework this session (a redo, a revert, a
   repeated failed attempt) that a future session would plausibly hit again. Anything plausible but
   resting on a single unweighted observation goes to Backlog, not Accepted.
7. **Never write, and never auto-invoke the destination write skill.** State the Accepted list and
   stop. Handoff to `jstack:team-knowledge` or `jstack:self-knowledge` happens only after the user
   explicitly confirms — silence, a topic change, or the user moving on is not confirmation.
8. **Team vs personal is decided per candidate, not once for the whole batch.** A session mixing a
   team-relevant architecture lesson with a personal working-style observation routes each to its
   own destination (`jstack:team-knowledge` vs `jstack:self-knowledge`) — never default the whole
   batch to one target for convenience. If `notion.*` config makes Notion the configured canonical
   store for team-relevant entries (per `agents/knowledge-curator.md`), name `jstack:knowledge-
   process` as the target for those candidates instead of `jstack:team-knowledge` — check config
   before defaulting to the gbrain-based target.
9. **State which lens, if any, dissented**, even when the synthesis pass reaches a bucket decision.
   A candidate where the cost lens says "there was a cheaper way, don't generalize this" but the
   outcome lens says "it worked" is not unanimous — say so, and let that disagreement push toward
   Backlog rather than silently averaging it into Accepted.

### Thresholds

| Signal | Threshold | Source |
|---|---|---|
| Reviewer lenses per candidate | 2 minimum, 3 target (outcome / soundness / cost) | This skill (Absolute Rule 3) |
| Backlog → Accepted promotion bar | ≥2 corroborating occurrences (this session or a prior reflect run) before a pattern is durable | `jstack:skill-creator-retro`'s identical recurrence bar, applied prospectively |
| Human confirmation before handoff | 100% of Accepted-bucket items require explicit confirmation; 0 auto-writes | Absolute Rule 7 |
| Review-cadence tier once written | 90 / 180 / 365 days by risk, inherited unchanged from `agents/knowledge-curator.md` | `agents/knowledge-curator.md` Thresholds table |
| Dissent handling | 1 dissenting lens on a candidate is enough to move it from Accepted to Backlog | Absolute Rule 9 |

### Named anti-patterns

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| Single-pass self-grading | One pass decides "what to write" and asks once — the exact gap this skill exists to close in front of `agents/knowledge-curator.md`'s existing discipline | Draft 2–3 lens verdicts independently before any synthesis; require the synthesis pass to show its work, not just a verdict |
| Auto-handoff on an Accepted list | Treats "the lenses agreed" as equivalent to "the human agreed" | Stop and present the bucketed list; wait for explicit confirmation before naming the write skill in an actual handoff |
| One-occurrence promotion | A single observation dressed up as a durable lesson because it "feels" generalizable | Route to Backlog unless ≥2 occurrences or measurable rework corroborate it (Absolute Rule 6) |
| Skipping the novelty search | Assumes a candidate is new without checking, producing a near-duplicate proposal | Run `jstack:knowledge-search` per candidate before bucketing anything as Accepted (Absolute Rule 4) |
| Silent supersede | Marks a candidate Accepted despite it contradicting an existing canonical entry, leaving the collision for the write skill to discover cold | Name the colliding entry explicitly in the handoff note (Absolute Rule 5) |
| Sequential-lens anchoring | Running lenses back-to-back in one continuous context lets lens 2/3 read lens 1's framing before forming their own take | Isolate each lens's draft verdict first, the same discipline `jstack:thermonuclear-review` applies to its six lenses |
| Mid-task reflection | Captures a lesson about an approach that might still change before the task has actually landed | Wait until the task lands; if asked mid-task, say so and defer |

### Worked example

- *Weak:* "This session we learned that checking the config first is good practice. Saving that to
  the team KB."

- *Sharp:* "Candidate: 'Skill X's Step 1 silently used a stale config default because it never
  called `bun run validate-config` before reading `jstack.config.json`.' Outcome lens: confirmed —
  the transcript shows the wrong default was used and the task had to be redone once the mismatch
  was found (evidence, not assumption). Soundness lens: the fix (add an explicit `validate-config`
  call to Step 1) addresses the actual cause, not a workaround. Cost lens: no cheaper fix available
  — this is already the minimal correct change. All three lenses agree, no dissent. Recurrence: this
  is the second time this exact failure mode has shown up this session (also hit at minute 40) —
  clears the ≥2-occurrence bar. Searched `jstack:knowledge-search` for 'config validation skipped'
  — no existing entry found, so this is novel, not a duplicate. No canonical entry contradicted.
  **Bucket: Accepted.** Presenting this alongside 2 Rejected and 1 Backlog candidate from the same
  session, then stopping here — handoff to `jstack:team-knowledge` only after you confirm."

### What this skill must not do

- Does not write to gbrain, Notion, or any store itself, under any bucket — that is always
  `jstack:knowledge-process`, `jstack:team-knowledge`, or `jstack:self-knowledge`'s job.
- Does not treat its own novelty search as a substitute for the destination write skill's own
  search-before-write gate — both run, for different reasons (Absolute Rule 4).
- Does not resolve a canonical-entry collision itself — it names the collision and hands the
  decision to the write skill's own ask-before-overwrite confirmation.
- Does not run mid-task, and does not auto-invoke a write skill without explicit human
  confirmation on the Accepted list specifically.
- Does not read cross-session historical logs — that is `jstack:skill-creator-retro`'s subject,
  not this skill's.

## Config and references
- `jstack.config.json` — team ids, integrations, `skill_defaults`, `jira_rules`, `notion`, `gbrain`. Never hardcode.
- `agents/knowledge-curator.md` — the search-before-write and ask-before-overwrite discipline this skill screens candidates against, without duplicating its write logic.
- [`skills/knowledge/references/gbrain-entry-provenance.md`](../references/gbrain-entry-provenance.md) — the provenance envelope the destination write skill attaches; this skill does not stamp it.
- Questions (open-ended, one at a time): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/question-patterns.md`
- Discrete choices (when the host supports AskUserQuestion or equivalent): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/ask-user-question-patterns.md`
- Chaining: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/chaining-guide.md`

## Intake
1. The subject is always the current session's own transcript — there is no artifact to fetch. Parse `$ARGUMENTS` only for an optional topic hint ("focus on the deploy issue") that narrows which part of the session to mine; an empty `$ARGUMENTS` means mine the whole session.
2. Confirm the task this session was doing has actually landed (shipped, merged, closed, or the user says it's done). If it clearly hasn't, say so and suggest running this after it lands instead of improvising on an in-flight task.

## Procedure

### Step 1 — Load config and identify candidates
Read relevant keys from `jstack.config.json` (`knowledge_base`, `gbrain`) so the destination write skills have what they need later — this skill does not write, but should not hand off into a config gap either. Re-read the session's own transcript and draft a short list of candidate lessons: what happened, what was learned, what would help a future session avoid repeating a mistake or redoing work. Each candidate gets a one-line claim before any review starts.

### Step 2 — Plan the lens dispatch
For each candidate, plan 2–3 independent reviewer passes: outcome ("did this actually work — point to the transcript evidence, not an assumption"), soundness ("was the approach itself sound, or did it happen to work despite a shaky method"), cost ("was there a cheaper way — and if so, is the lesson actually 'avoid this approach,' not 'do this'"). State whether the host's subagent dispatch can inherit this session's context; if not, plan to paste the candidate plus its transcript excerpt into each dispatched lens's prompt.

### Step 3 — Execute
Run all lenses per candidate, drafting each verdict before reading any other lens's verdict for that candidate (Absolute Rule 3). For each candidate: run the novelty search (Absolute Rule 4), check for a canonical-entry collision (Absolute Rule 5), and check the recurrence bar (Absolute Rule 6). Synthesize one bucket per candidate — Accepted, Rejected, or Backlog — stating which lens(es) agreed or dissented and why.

### Step 4 — Validate
Confirm every candidate has a stated bucket with a named reason, every Accepted candidate cleared the novelty search and the recurrence bar with no unresolved canonical-entry collision, and every dissent was surfaced rather than averaged away. Confirm no write has happened and no destination skill has been invoked yet.

### Step 5 — Present and stop
Present the full Accepted/Rejected/Backlog list (see Output shape) and stop. Ask explicitly whether to proceed with handoff — do not treat the act of presenting the list as consent to write.

## Output shape

- **Session scope** — what was mined (whole session, or the `$ARGUMENTS` topic hint that narrowed it).
- **Accepted** — table: candidate claim, lens verdicts (outcome/soundness/cost), recurrence evidence, novelty-search result, target (`team-knowledge`, `self-knowledge`, or `knowledge-process` when Notion is the configured canonical store — Absolute Rule 8).
- **Rejected** — table: candidate claim, reason (not durable / already captured — name the existing entry).
- **Backlog** — table: candidate claim, what's missing (occurrence count so far, or the specific evidence still needed).
- **Collisions flagged** — any Accepted candidate that would contradict an existing canonical entry, named explicitly for the write skill's own confirmation gate.
- **Next step** — the single confirmation question: proceed with handoff for the Accepted list, or not.

## Failure modes

| Symptom | Recovery |
|---------|----------|
| Asked to run mid-task | Say so; suggest deferring until the task lands (Absolute Rule 1). |
| No candidates found | Say plainly that nothing durable surfaced this session — an empty Accepted/Backlog list is a valid, honest outcome, not a failure to try harder. |
| Host can't dispatch context-preserving parallel subagents | Run lenses sequentially but still isolated (draft each verdict before reading the prior one); paste the transcript excerpt into each pass; say so in Limitations. |
| `jstack:knowledge-search` finds a near-duplicate | Do not bucket as Accepted; either Reject (already captured, name the entry) or note the delta if the candidate updates the existing entry, and let the write skill's merge flow handle it after confirmation. |
| User doesn't respond to the confirmation question | Stop. Nothing gets handed off or written; treat silence as "not yet," not as approval. |
| Config missing (`knowledge_base` / `gbrain` unset) | Say so explicitly; still present the bucketed list — the review doesn't depend on the destination being configured yet. |

## Chaining

Screens and proposes only. On explicit confirmation, hand the Accepted list to `jstack:team-knowledge` (team-relevant entries), `jstack:self-knowledge` (personal working-style entries), or `jstack:knowledge-process` (team-relevant entries when Notion is the configured canonical store, per Absolute Rule 8), naming any flagged collision so the destination skill's own ask-before-overwrite gate has context. Every Accepted item still passes through the destination skill's own search-before-write step (Absolute Rule 4) — this skill's novelty search does not substitute for it. Do not auto-invoke either destination skill without the user's explicit go-ahead.

## User request

$ARGUMENTS

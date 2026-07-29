# Workflow design interview

Intake discipline for `jstack:workflow-builder` (chains, routines, policies) and
`jstack:workflows-builder` (browser definitions). Use it whenever the ask is "build me a workflow"
rather than "run this one thing."

Adapted from two proven interview patterns: reconnaissance-before-questions and an intent-capture
checklist (skill-creator), plus an explicit understanding gate, alternatives-with-a-recommendation,
and a decision log (brainstorming). Adapted, not copied — this version uses **one batched
checkpoint** instead of per-section confirmation, because stopping every 200 words to ask "does this
look right?" costs more than it catches.

## Contents

- [Phase 0 — Recon before asking](#phase-0--recon-before-asking)
- [Phase 1 — Classify the artifact](#phase-1--classify-the-artifact)
- [Phase 2 — The questions that actually block](#phase-2--the-questions-that-actually-block)
- [Phase 3 — Understanding lock](#phase-3--understanding-lock)
- [Phase 4 — Offer shapes, recommend one](#phase-4--offer-shapes-recommend-one)
- [Phase 5 — Decision log](#phase-5--decision-log)
- [Phase 6 — Verification keyed to artifact type](#phase-6--verification-keyed-to-artifact-type)
- [Exit criteria](#exit-criteria)
- [Anti-patterns](#anti-patterns)

## Phase 0 — Recon before asking

Come prepared. Every question that config already answers spends the user's patience for nothing,
and `question-patterns.md` already sets the bar: ask the fewest questions possible.

Read these first and note what each one settled:

1. **The conversation above.** If the user said "turn this into a workflow," the steps, the tools,
   and the corrections they made along the way are already in the transcript. Extract them and ask
   for confirmation — do not re-interview from zero.
2. **`jstack.config.json`** — cadence, channels, approvers, project keys, integrations,
   `skill_defaults`.
3. **Existing artifacts of the same kind** — `prompts/chains/*.md`, `routines.*`,
   `config/workflows/*.json`. A near match you extend beats a new artifact nobody maintains.
4. **The skill catalog** — every step has to resolve to a real `jstack:*` id
   (`grep -h '^name:' skills/**/SKILL.md`).

Say what recon answered before you ask anything. If recon answered everything, go straight to the
lock.

## Phase 1 — Classify the artifact

Decide which artifact this is **before** reaching for any template. The wrong shape costs more than
an extra question, and a single checklist applied to all five kinds manufactures uniformity rather
than quality.

| Signal in the request | Artifact | Destination |
|---|---|---|
| One skill, one action | none — point at that skill | — |
| ≥2 `jstack:*` skills in a fixed order with a handoff between them | chain | `prompts/chains/<name>.md` |
| …and it recurs on a clock | chain **+** routine | above **+** `routines.<name>.cron` |
| Gates who may approve an action | policy / approval chain | `policies.*`, `approval_chains` |
| Clicks a browser UI | browser definition | `config/workflows/<id>.json` |

State the classification and why. Each kind gets different questions in Phase 2 and a different gate
in Phase 6.

## Phase 2 — The questions that actually block

One question per message. Use a closed option set whenever one exists, and reach for
AskUserQuestion with `preview:` when the choice changes the shape of the output
(`ask-user-question-patterns.md`). Skip anything recon already settled.

**Always, every artifact type:**

- **Trigger** — what starts this? Manual, a schedule, an event, or another workflow's output.
- **Done** — what observable state means it worked? "It ran" is not an answer.
- **Non-goals** — what should this explicitly *not* do? The cheapest question on this list and the
  one that prevents the most rework.

**Additionally, when the artifact writes anything or recurs:**

- **Re-run safety** — if it runs twice, does the second run duplicate a ticket, a post, or a row?
  If so, what makes it idempotent?
- **Partial failure** — step 3 of 5 fails. Stop, skip, or roll back? Who gets told?
- **Approval boundary** — which steps may act without the user in the loop, and which may not?
- **Secrets** — which values come from env, and what must never appear in the file or the
  transcript?
- **Owner** — who fixes this when it breaks in three months?

If the user is unsure on any of these, propose a default and label it `[assumption]`. Never leave one
blank and never silently pick for them.

## Phase 3 — Understanding lock

One checkpoint, batched. Before drafting anything, post this block and stop:

- **Understanding** — 5–7 bullets: what gets built, what triggers it, what "done" means, key
  constraints, explicit non-goals.
- **Classification** — artifact type and destination path from Phase 1.
- **Assumptions** — every `[assumption]` gathered into one list.
- **Open questions** — anything still unresolved.

Then ask once: *"Confirm or correct this before I draft."*

Do not draft before the confirmation lands. Do not re-open the lock section by section afterwards —
if something was wrong, fix it and re-post the lock once.

## Phase 4 — Offer shapes, recommend one

Give 2–3 viable shapes with your recommendation first, and name the trade-off in each — fewer steps
versus a smaller failure surface, one chain versus two composable ones, scheduled versus
event-driven. Apply YAGNI: the smallest shape that satisfies Phase 2 wins. A shape that exists to
support a requirement nobody stated is a liability.

## Phase 5 — Decision log

Carry a running log and ship it **inside the artifact**, not just in the chat:

| Decision | Alternatives considered | Why this one |
|---|---|---|

A workflow whose shape nobody can explain six months later gets rewritten from scratch rather than
maintained. The log is what prevents that, so it is part of the deliverable.

## Phase 6 — Verification keyed to artifact type

Decide with the user whether this needs a test, and pick the check that fits the kind — do not apply
one gate to all of them:

| Artifact | The check that actually proves it |
|---|---|
| chain / routine | Every `jstack:*` id resolves and every referenced config key exists (`bun run validate-chains`); the cron fires when they think it does |
| browser definition | Parses against `WorkflowDefinitionSchema`; every `click`/`fill` is preceded by a `wait` on its selector; no credential literals |
| policy / approval chain | Names the action it gates and resolves to a real person or role in `team.members` |

Artifacts whose output is a judgment call (tone, narrative shape, which framing to lead with) usually
need no test. Say so explicitly rather than inventing a check that measures nothing.

## Exit criteria

Do not hand off until all of these hold:

- The lock was confirmed by the user.
- Exactly one shape was accepted.
- Every assumption is written down.
- Failure behavior and re-run behavior are both stated.
- The decision log is written into the artifact.
- Every step resolves to a real `jstack:*` skill or is explicitly marked `[external / custom]`.

## Anti-patterns

| Anti-pattern | Why it hurts | Instead |
|---|---|---|
| Interviewing before recon | Asks what `jstack.config.json` already says; reads as not having looked | Phase 0 first, then report what recon settled |
| One question list for every artifact type | A browser definition and an approval chain fail in unrelated ways; a shared checklist checks neither | Classify in Phase 1, then ask that kind's questions |
| Per-section "does this look right?" | Costs more turns than it catches, and the user loses the thread of the whole design | One batched lock in Phase 3 |
| Designing only the happy path | Every real workflow's cost is in partial failure and double-runs | Re-run safety and partial failure are required questions |
| Drafting during the interview | Anchors the user on a shape before the requirements exist | Nothing is drafted before the lock is confirmed |
| A chain step that posts to Slack itself | Bypasses the target skill's confirmation and redaction rails | The step names the skill to invoke; execution stays inside it |
| Inventing a `jstack:*` id that reads plausibly | Fails at execution time, after the user has committed to the design | Verify every id against `skills/**/SKILL.md` before drafting |

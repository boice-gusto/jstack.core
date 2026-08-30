---
name: jstack-figure-it-out
description: Design and run a rigorous, scoped, one-off plan for a big or unusual task that doesn't match any existing skill, playbook, or SOP in the catalog. Frames the actual goal/constraints/done-state in 1-2 sentences, picks the smallest set of steps a reviewer could verify, runs them in order checking each before the next, and hands back a plain-prose audit trail naming what was verified vs. assumed. Not for a task a real skill already covers — check the catalog first and chain to that skill instead. Not for authoring a new **permanent** skill file — use `jstack:skill-creator` instead. Not for a chain that will recur — use `jstack:workflow-builder` instead once the same one-off has run more than a couple of times.
when_to_use: "Also trigger on: 'no skill fits this', 'this is a one-off', 'figure this out', 'make a plan for this weird task', 'nothing in the catalog covers this', an ask that spans multiple unrelated systems with no existing chain, or a request explicitly declined by a more specific skill's out-of-scope note."
category: figure-it-out
effort: high
gbrain_destination: none
data_class: internal
generator: skip
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config, skill_catalog -->
<!-- outputs: framed_goal, verifiable_step_plan, audit_trail, verified_vs_assumed_summary -->
<!-- chains-to: jstack:skill-creator -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for

Design and execute a **bespoke, scoped, auditable plan** for a task that is too big or too unusual for any existing skill — without forcing a mismatched playbook onto it, and without improvising with no structure at all. This is the fallback of last resort, not a default: it exists for the gap between "a real skill covers this" and "just wing it."

- **In scope:** One-off tasks spanning multiple systems, tasks with no matching skill after a real catalog check, tasks whose shape won't repeat often enough to justify a permanent skill.
- **Out of scope:** Any task a real skill already covers — chain to that skill instead of re-deriving its procedure. Authoring a new **permanent** `SKILL.md` — that is `jstack:skill-creator`'s job, not this skill's; this skill produces a plan and an audit trail, never a persisted skill file. A single lookup or command with one obvious verification step — running this skill's five-phase overhead on a one-line task is itself the anti-pattern named below. A recurring multi-skill chain — after the same bespoke plan has run a few times, that pattern belongs in `jstack:workflow-builder`, not in a fresh ad hoc plan each time.

## Domain rules — figure-it-out

### Absolute rules

1. **Check the catalog before improvising.** Search skill names and descriptions for the task's real keywords before concluding nothing fits. A plan built on a false "nothing matches" premise wastes the user's time reviewing steps a real skill would have run in one call.
2. **Name the evidence before running the step, not after.** A step's proof (a command's real output, a file diff, a passing check) is declared at Design time. Retrofitting "proof" after execution is not verification — it's narration.
3. **The step set is the smallest one a reviewer could check.** More steps than a reviewer can hold in one pass is a signal to split the task, not a sign of thoroughness. Padding a plan with steps that produce no independent evidence just adds places for silent drift.
4. **Verified and assumed are never merged into one bucket.** Every claim in the final report is either backed by evidence produced during Run, or explicitly labeled `[assumption]` — never phrased so a reader can't tell which.
5. **A step that gets skipped stays listed with why**, per this repo's own routine-runner convention — a vanished step reads as "didn't need to happen"; a step marked `skip: <reason>` reads as "considered and deliberately not run."
6. **Escalate to `jstack:skill-creator` on repetition, not on the first run.** The third time the same bespoke plan gets re-derived for what is turning out to be a recurring task, that is the signal to formalize it — not to keep re-planning from scratch.

### Scope gate

| Signal | Verdict |
|---|---|
| A skill's description or `when_to_use` already matches the task after a real catalog search | Do not proceed — chain to that skill instead of running a bespoke plan in parallel |
| The task is a single command or lookup with one obvious, immediate check | Do not proceed — just do it; a five-phase plan for a one-step task is pure overhead |
| No skill matches, and the task chains ≥3 steps or crosses ≥2 systems with no existing playbook | Proceed — this is the gate this skill exists for |
| The same bespoke plan shape has now recurred 3+ times | Proceed this once more, but flag it for promotion to `jstack:skill-creator` in the handoff |

Keep the step count to what a reviewer can check in one pass — typically 3-7 steps; needing more than 10 is a signal to split the task or, if it will recur, hand it to `jstack:workflow-builder` instead of planning it fresh again.

## Named anti-patterns

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| Running this skill's full five-phase plan on a task a real skill already covers | Re-derives a procedure that already exists, produces a weaker result, and hides that a better tool was available | Search the catalog by real keywords first (Intake step 2); chain to the matching skill |
| Declaring a step's evidence after running it | "Proof" invented to justify what already happened is narration, not verification — it can't catch a step that actually failed | Name each step's evidence at Design time, before Run starts |
| Silently dropping a step that turned out unnecessary | A vanished step reads as "didn't need to happen," hiding that it was ever considered | Keep it listed with `skip: <reason>` (Absolute rule 5) |
| Rounding a partially-blocked run up to "done" | Implies confidence the run never earned; the next person trusts an audit trail that omitted the actual gap | Report blocked/unverified items by name in the final summary (Step 5) |
| Re-planning the same bespoke task from scratch a fourth time | Treats a now-recurring pattern as perpetually novel, burning review effort each time on a plan the reviewer has already seen | On the 3rd recurrence, flag for promotion to `jstack:skill-creator` (Absolute rule 6) |

## Worked example

**Weak plan** — "Migrate the reporting job to the new queue. Steps: update the code, test it, ship it." No named evidence per step, no stated constraint, no definition of done — a reviewer can't tell whether "test it" means a passing suite, a manual check, or nothing at all, and there's no way to tell afterward whether "ship it" actually verified the new queue received real traffic.

**Sharp plan** — Frame: "Move the nightly reporting job from the legacy queue to the new one before the legacy queue's retirement date; constraint is zero missed reports during cutover; done means three consecutive nightly runs succeed on the new queue with matching output counts to the legacy run." Design: (1) point the job's queue config at the new queue in a feature-branch config, evidence = diff of the config file; (2) run the job once against the new queue in parallel with the legacy run, evidence = both jobs' output row counts, expected equal; (3) cut the legacy job off, evidence = the job's next scheduled run log showing only the new queue was hit; (4) confirm three consecutive nightly runs, evidence = three dated log entries with matching counts. Run: step 1 done (diff shown), step 2 done (counts matched: 4,812 vs 4,812), step 3 blocked — legacy job's disable flag required an access grant not yet in hand, marked `blocked: pending access grant`, remaining steps re-planned to resume once granted. Verify and hand back: steps 1-2 verified with evidence above; step 3 explicitly unverified and blocked, not rounded up to done; step 4 not yet attempted.

## Config and references

- No org-specific config keys are required — this skill produces a plan and an audit trail in the conversation, not a persisted artifact, so there is nothing to read from `jstack.config.json` and no config wizard to trigger.
- Questions (open-ended, one at a time): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/question-patterns.md`
- Confirmations (finite branch — does this candidate skill fit or not): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/ask-user-question-patterns.md`
- Chaining mechanics: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/chaining-guide.md`

## Intake

1. Parse `$ARGUMENTS` as the task description.
2. Search the skill catalog for a real match on the task's actual keywords (not just the literal words the user used) before concluding this skill applies. If a match exists, stop here and name it — do not proceed into Frame.
3. If the task is a single lookup or one-step command, stop here and just do it — do not run the five-phase procedure on it.
4. If genuinely ambiguous whether a match exists, this is a finite confirmation, not an open-ended question — use **AskUserQuestion** (or the host's equivalent) naming the closest candidate skill and asking whether it fits, rather than silently assuming no match or defaulting to a free-text question.

## Procedure

### Step 1 — Frame

State the actual goal, the real constraints (time, access, systems involved), and what "done" looks like, in 1-2 sentences. If the user's ask is broader than what they actually need right now, name the narrower frame you're using and why.

### Step 2 — Design

Pick the smallest set of concrete steps that would let a reviewer verify the work was done right. For **each** step, name upfront what evidence will prove it — a command's real output, a file diff, a passing check, a specific line in a specific file — never "do X" with no stated proof. Order steps so each one's evidence is checkable before the next step starts.

### Step 3 — Run

Execute the steps in order. After each step, check its stated evidence before starting the next one — do not run steps 2 and 3 back to back on the assumption step 2 worked. If a step can't produce its evidence (blocked, no access, unexpected result), stop there, mark it `blocked: <reason>`, and re-plan the remainder rather than pushing forward on an unverified foundation.

### Step 4 — Audit trail

Record what was actually done, in what order, with what evidence, in plain prose — no separate file format unless the task's scope genuinely warrants one (e.g. a multi-day effort with its own tracking need). Every skipped step stays listed with its skip reason (Absolute rule 5); nothing vanishes from the record.

### Step 5 — Verify and hand back

State explicitly what was verified (with its evidence) versus what was assumed (labeled `[assumption]`) versus what is still unverified. Flag anything left unverified by name — do not imply full confidence by omitting it. Do not round an incomplete or partially-blocked run up to "done."

## Output shape

The final reply is this run's summary, not a single Q&A — it must contain:

- **Frame** — the goal, constraints, and done-state in 1-2 sentences.
- **Plan** — the step list as designed, each with its named evidence.
- **Run log** — per-step status (done / blocked / skipped-with-reason), with the evidence actually produced for each done step.
- **Verified vs. assumed** — a clear split; every `[assumption]` labeled as such.
- **Unverified / flagged** — anything left unchecked, named explicitly rather than implied to be fine.
- `result_ok: true` or `result_ok: false` + reason.

## Failure modes

| Symptom | Recovery |
|---------|----------|
| A real skill turns out to match, discovered mid-run | Stop the bespoke plan immediately and chain to the matching skill — don't finish out of momentum |
| A step's stated evidence can't actually be produced (no access, tool unavailable) | Mark the step `blocked: <reason>`; re-plan the remainder; never fabricate the evidence to keep the run looking clean |
| Scope grows mid-run past the original Frame | Stop, re-state the frame with the new scope, and get explicit confirmation before continuing — don't silently expand |
| User expects a persisted, reusable skill file, not a one-off plan | Redirect to `jstack:skill-creator` — this skill's output lives in the conversation and audit trail, not on disk |
| The same task shape has now recurred 3+ times | Say so explicitly in the handoff and suggest `jstack:skill-creator` (or `jstack:workflow-builder` if it's a multi-skill chain) instead of planning it fresh again |

## Chaining

- Intake finds a real catalog match → stop and name that skill; do not run this skill's procedure in parallel with it.
- Same bespoke plan has recurred 3+ times → suggest `jstack:skill-creator` to formalize it into a permanent skill.
- The goal is actually a recurring multi-skill chain, not a one-off → suggest `jstack:workflow-builder` instead.

## User request

$ARGUMENTS

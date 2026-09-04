---
name: jstack-engineering-verify-this
description: >-
  Prove or disprove a specific claim about running system behavior with fresh, repeatable local
  evidence: restate the claim falsifiably (condition, metric, threshold), capture a baseline
  artifact from the old state and a treatment artifact from the new state with the same command
  and environment, compare the raw artifacts, and return exactly one verdict — VERIFIED, NOT
  VERIFIED, or INCONCLUSIVE. Use when the user asks "verify this," "prove it works," "did this fix
  it," "show me the evidence," or a bug-fix/perf/behavior claim needs a real before/after, not a
  read of the diff. Do NOT use for a vague, unmeasurable claim ("the code is cleaner") — ask for a
  falsifiable claim first. Do NOT use for skill/agent regression testing — that is `evals/a2a/`
  (this repo's own fixed-case harness), not a one-off runtime claim. Do NOT use for jstack's own
  fixed structural gates (schema drift, chain integrity, name collisions) — that is
  `jstack:engineering-compatibility-check`. Inspired by Cursor's `cursor-team-kit` plugin's
  `verify-this` skill, adapted to jstack conventions.
category: engineering
effort: high
generator: skip
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config, claim -->
<!-- outputs: verdict -->
<!-- chains-to: jstack:review-code-review, jstack:engineering-blast-radius, jstack:engineering-show-me-your-work -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Turn a claim about system behavior into a falsifiable statement, then settle it with real evidence
instead of a recap of the diff or a restatement of intent. A test passing is not the same claim as
"the user-visible behavior changed" — this skill closes that gap with a captured baseline and
treatment, compared directly, ending in exactly one of three verdicts.
- **Out of scope:** Vague or unmeasurable claims ("this is cleaner," "this feels faster") — ask for
  a condition, metric, and threshold before doing anything else. Running the full `evals/a2a/`
  regression suite (a fixed case format for skill/agent behavior, not a one-off claim) or this
  repo's fixed structural gates (`jstack:engineering-compatibility-check`) — this skill is for an
  arbitrary, one-off runtime claim about any system, not a suite.

## Domain rules — verify-this
- The claim must be restated as **condition, metric, threshold** before any evidence is gathered.
  "Did this fix the race condition" is not falsifiable until it becomes "under N concurrent writers,
  zero corrupted reads across M runs" or similar. A claim that can't fail isn't a claim.
- Capture a real **baseline artifact** — the actual output, log, or measurement from the OLD state
  (merge base, parent commit, current failing repro) — before touching anything.
- Capture a real **treatment artifact** — the actual output, log, or measurement from the NEW state
  — with the same command, inputs, and environment as the baseline.
- Baseline and treatment are captured with the **same command, same inputs, same environment** —
  a baseline run on a different machine, dataset, or warmup state is not a baseline, it's a guess.
- Compare the two artifacts **concretely** (numbers, transcripts, diffs, profiles) and return
  exactly one of three words — `VERIFIED`, `NOT VERIFIED`, or `INCONCLUSIVE` — never a soft "looks
  good" or "should be fine" substituted for one of the three.
- **Never accept "it should work now" as evidence.** Only a captured artifact counts. A verdict is
  never softened: `NOT VERIFIED` is a useful, complete answer — do not reframe a failed
  verification as "mostly working" or "close enough."
- `INCONCLUSIVE` is a real, honest outcome, not a fallback for "I didn't try hard enough." It means
  the comparison itself is invalid (no baseline available, noisy signal, a confound), not that the
  result was unwelcome.
- Never claim `VERIFIED` from reading code alone. If nothing was actually executed, the verdict is
  `INCONCLUSIVE` at best, regardless of how obviously correct the code looks.

### Named anti-patterns

| Anti-pattern | Why it's wrong | Do this instead |
|---|---|---|
| Treating "the code changed" as evidence the behavior changed | A diff shows intent, not execution; the same bug can survive a well-intentioned edit | Actually execute the baseline and treatment; if execution isn't possible, return `INCONCLUSIVE` and say why |
| Accepting a re-run of the SAME broken repro as a passing baseline | If the "baseline" run already reflects the fix (wrong branch, cached build, stale binary), it will trivially match the treatment — the comparison proves nothing | Confirm the baseline actually runs against the pre-fix state (parent commit, merge base, or a build predating the change) before recording it |
| Claiming `VERIFIED` from reasoning alone, with no captured artifact | "This should work now" is a prediction, not a result — it can't be re-examined or handed to someone else to check | Capture a real baseline and treatment artifact (log, output, measurement) before naming a verdict |
| Silently downgrading `INCONCLUSIVE` to `VERIFIED` because the user wants a clean answer | Manufactures certainty that doesn't exist and hides the actual confound from whoever acts on the result | State `INCONCLUSIVE` plainly with the specific confound; a clean-sounding wrong answer is worse than an honest unresolved one |
| Treating "no error was thrown" as sufficient evidence for a positive claim | Absence of an exception is not presence of the claimed behavior — a silent no-op also throws nothing | Assert the actual claimed outcome (the returned value, the emitted event, the changed row) against the threshold, not just that execution completed |
| Softening `NOT VERIFIED` into "mostly working" or "should be fine now" | Hides a real negative result from whoever needs to act on it | State `NOT VERIFIED` plainly, with the evidence that shows the predicted direction didn't hold |
| Re-running only the treatment and eyeballing whether it "looks right" | Without a baseline captured under identical conditions, there's nothing to compare against — this is not verification, it's a vibe check | Capture both baseline and treatment under the same command/environment before comparing anything |

### Worked example

- *Weak:* "I re-read `retryClient.ts` and the idempotency key logic looks right now, so this
  should be fixed. VERIFIED."
- *Sharp:* "**Claim:** under 3 concurrent retried POSTs to `/orders/:id/charge` with an injected
  timeout, exactly 1 charge is recorded (was: up to 3). **Baseline** (parent commit, same script,
  same fixture): 3 charge rows. **Treatment** (this branch, same script): 1 charge row, 2
  `idempotency_key` conflict responses. **Verdict: VERIFIED** — delta matches the claimed
  direction and threshold exactly, no confound (same DB fixture, same timeout injection point)."

## Config and references
- `jstack.config.json` — team ids, integrations, `skill_defaults`, `jira_rules`, `notion`, `gbrain`. Never hardcode.
- Questions (open-ended, one at a time): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/question-patterns.md`
- Discrete choices (when the host supports AskUserQuestion or equivalent): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/ask-user-question-patterns.md`
- Integrations: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/integration-guide.md`
- Chaining: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/chaining-guide.md`

## Intake
1. Parse `$ARGUMENTS` for the specific claim being made and what "done" evidence would look like
   (a passing log, a benchmark number, a screenshot, a zero-failure run count). If it already names
   a condition/metric/threshold, use it; otherwise restate it into that shape and confirm before
   proceeding.
2. If the claim is unmeasurable as stated ("cleaner," "better," "should be fine"), ask **one** focused question to get a measurable version rather than guessing one.
3. If the request bundles verification with an unrelated ask (e.g., "verify this and also refactor it"), verify first and offer to continue with the second ask after.

## Procedure
### Step 1 — Load config
Read relevant keys from `jstack.config.json` only if the claim touches a configured integration (e.g. a CI check, a deployed endpoint). Most claims are purely local and need no config at all — do not force a lookup that isn't relevant.

### Step 2 — Plan the safe path
Pick the smallest local surface that could actually disprove the claim: a focused test/repro script for code behavior, a terminal transcript for CLI/TUI, a request/response diff for an API, same-machine timings for performance, heap snapshots for memory. Never run a destructive command against real data to gather evidence — use a fixture, a sandboxed copy, or a read-only probe.

### Step 3 — Execute
Capture the baseline first (old state: merge base, parent commit, or the current failing repro), then the treatment (new state), using the identical command, inputs, and environment for both. When artifacts are safe to write to disk, lay them out under `/tmp/verify-this/<claim-slug>/{claim.md, baseline/, treatment/, diff/, verdict.md}`; if artifacts could contain sensitive code, prompts, or data, keep only the minimal evidence inline instead of writing to disk.

### Step 4 — Validate
Compare the raw artifacts directly (numbers, transcripts, diffs, profiles) — not a summary of what you expect them to show. Confirm baseline and treatment really did run under matching conditions; if they didn't (different machine, different fixture, different warmup), the result is `INCONCLUSIVE`, not a verdict with an asterisk.

### Step 5 — Summarize and hand off
Output exactly one verdict — `VERIFIED`, `NOT VERIFIED`, or `INCONCLUSIVE` — with the claim, the evidence (metric: baseline=…, treatment=…, delta=…, threshold=…), and one tight paragraph of reasoning naming any confound. Suggest `jstack:review-code-review` next if the verification surfaced a defect worth a full review, `jstack:engineering-blast-radius` if the claim raised a question about impact beyond what was tested, or a decision-trail skill (e.g. `jstack:engineering-show-me-your-work`, if present in the catalog) when this verification is one step inside a longer autonomous run a human will review later.

## Output shape
Use a domain-appropriate heading, then:
- **Summary** — its **first word** must be the verdict, exactly one of `VERIFIED`, `NOT VERIFIED`,
  or `INCONCLUSIVE`, followed by 2–4 sentences: the claim, and why
- **Details** — the evidence table (metric/artifact: baseline, treatment, delta, threshold) and the reasoning paragraph
- **Next steps** with owner + timeline if known
- **Limitations** (partial data, no write access, environment differences)
- For eval-gated skills, end with `result_ok: true` or `result_ok: false` + reason

## Failure modes

| Symptom | Recovery |
|---------|----------|
| The claim wasn't falsifiable as stated ("cleaner," "better," "should work") | Stop and ask the user to restate it as condition/metric/threshold before gathering any evidence. |
| No valid baseline exists (e.g. the "before" state can't be reproduced) | Return `INCONCLUSIVE` and say what would be needed to establish one — never guess a baseline. |
| Baseline and treatment ran under different conditions | Return `INCONCLUSIVE`, naming the confound (different machine, fixture, warmup) explicitly. |
| The treatment step requires something not run yet (fix not deployed, build not cut, migration not applied) | Say so plainly; either apply/confirm the treatment state first or return `INCONCLUSIVE` — never capture a treatment artifact from a state that doesn't actually reflect the claimed change. |
| Evidence would require a destructive action against real data | Stop; use a fixture or sandboxed copy instead, or say the claim can't be safely verified here. |
| Signal is inherently flaky or nondeterministic (e.g. a timing measurement, a race condition) | State that explicitly and report a failure rate across N runs rather than picking one lucky run and calling it `VERIFIED`. |

## Chaining
Complete the work here. If the verdict surfaces a defect worth a deeper read, suggest
`suggested_next: jstack:review-code-review`; if it raises an impact question beyond what was
tested, suggest `jstack:engineering-blast-radius`; if this verification is one step inside a
longer autonomous or multi-phase run that a human will review after the fact, suggest a
decision-trail skill (e.g. `jstack:engineering-show-me-your-work`, if present in the catalog) so
the verdict lands in a reviewable trail rather than only in this reply. Do not auto-invoke without
user intent.

## User request

$ARGUMENTS

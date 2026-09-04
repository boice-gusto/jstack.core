---
name: jstack-review-maintainability-audit
description: >-
  Single-lens, deep structural-maintainability audit of a diff: hunts for a "code-judo"
  restructuring that deletes complexity rather than rearranging it, treats a file crossing the
  1,000-line threshold as a presumptive blocker needing a stated reason, flags spaghetti-growth
  (ad-hoc conditionals bolted onto an unrelated flow) as a design problem rather than a style nit,
  is skeptical of thin/pass-through wrapper abstractions and cast-heavy type boundaries, and pushes
  on type/boundary cleanliness (unnecessary `any`/`unknown`/casts) when it affects maintainability.
  Use for "how maintainable is this," "is there a simpler way to structure this," "audit this for
  code-judo opportunities," or "is this file getting too big." `jstack:thermonuclear-review` can
  invoke this skill as its code-quality lens for extra structural depth beyond that lens's general
  complexity/debt pass; it can also run standalone on a diff/PR with no six-lens process at all. Do
  NOT use as a substitute for `jstack:thermonuclear-review`'s six-lens dispatch (security,
  compliance, performance, code quality, QA, AI-slop) when the ask is broader than structure — this
  is one deep structural lens, not a seventh lens in that roster, and does not touch
  security/compliance/performance/QA at all. Do NOT use for a routine PR with no
  structural-complexity question — `jstack:review-code-review` is lighter and sufficient there.
  Inspired by the Thermos plugin's `thermo-nuclear-code-quality-review` skill, adapted to jstack
  conventions.
category: review
effort: high
generator: skip
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config, diff_or_artifact -->
<!-- outputs: structured_result -->
<!-- chains-to: jstack:thermonuclear-review, jstack:review-code-review -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md
Load the policy this domain is governed by (do not restate it from memory):
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/policies/review-policy.md

## What this skill is for

Push hard on one question a routine review usually skips: not "does this work" but "is this the
simplest correct structure, and if not, what restructuring would make it so." Actively search for a
**code-judo move** — a reorganization that uses the existing architecture more effectively and
makes the change dramatically simpler, not just locally tidier — before accepting a working
implementation as good enough.

- **Out of scope:** Security, compliance, performance, or QA/testability findings —
  `jstack:thermonuclear-review` dispatches those as separate lenses; this skill is deliberately
  narrower and deeper on structure alone. Approving, merging, or writing the restructuring itself
  without the user's go-ahead — this names the move and its cost, the user decides whether to take
  it. A routine PR with no structural-complexity question (`jstack:review-code-review` is enough).

## Domain rules — maintainability audit

This is a single deep lens, not a dispatcher — it does not fan out to other agents the way
`jstack:thermonuclear-review` does, and it explicitly does not duplicate that skill's roster. Where
`jstack:thermonuclear-review`'s "code quality" lens (routed to `staff-engineer`) covers general
complexity/debt/maintainability across six lenses in one severity-ranked pass, this skill goes
deep on five specific structural questions and nothing else.

### Absolute rules

1. **Be ambitious, not merely tidy.** "This could be a bit cleaner" is not a finding on its own —
   name the specific restructuring (extraction, reframing, deletion) that would make the change
   dramatically simpler, or say plainly that no such move is visible.
2. **A file crossing from under 1,000 lines to over 1,000 lines in one diff is a presumptive
   blocker**, not a nit. State the before/after line count and ask explicitly whether the new code
   should be decomposed first. Only waive it when the author gives a compelling structural reason
   and the result is still clearly organized — state that reason back, don't silently accept it.
3. **New ad-hoc conditionals or scattered special cases tangled into an existing, previously
   cohesive flow are a design problem, not a style comment.** Name the specific branch/flag and
   propose where it belongs instead (a dedicated abstraction, helper, state machine, or separate
   module) — don't just say "this could be extracted."
4. **Prefer deleting complexity over rearranging it.** A refactor that moves the same complexity to
   a different file has not fixed anything — say so explicitly when a proposed or actual change
   only relocates the problem.
5. **Be skeptical of thin, pass-through, or "magic" abstractions.** A new interface, wrapper,
   factory, or generic mechanism that hides a simple data-shape assumption instead of stating it
   directly is a maintainability cost, not free architecture. Flag an abstraction that adds a layer
   of indirection without buying clarity — name what it wraps and ask whether the direct, boring
   call would read better than the wrapper.
6. **Question unnecessary `any`, `unknown`, or cast-heavy code when a clearer type boundary would
   remove the need for it** — but only when it actually affects maintainability (an unclear
   invariant, a silent fallback papering over an ambiguous shape), not as a blanket type-purity
   pass unrelated to this diff.
7. **A working implementation is not automatically an approved one.** Never rubber-stamp "it works"
   when a clearly better structure is visible — but never invent a restructuring that isn't
   actually simpler just to have something to say.

### Thresholds

| Signal | Threshold | Source |
|---|---|---|
| File-size blocker | Crossing from <1,000 to >1,000 lines in one diff — presumptive blocker, needs a stated reason | This skill's Absolute Rule 2 |
| Diff size before splitting the audit | ~200–400 LOC per pass finds the most defects; state size and consider splitting above it | Same ceiling `jstack:review-code-review`/`jstack:thermonuclear-review` use |
| Confidence band | High ≥80% (directly verified by reading the code) · Medium 50–79% (plausible restructuring, unverified cost/benefit) · Low <50% (speculative) | judgment convention shared with `jstack:counsel-review` |

### Named anti-patterns

| Anti-pattern | Why it's wrong | Do this instead |
|---|---|---|
| Rubber-stamping "it works" | Leaves the codebase messier than it needed to be when a clearly better structure was visible | Name the specific restructuring; if none is visible, say so explicitly rather than defaulting to approval |
| Stopping at "this could be a bit cleaner" | Names a feeling, not a fix — gives the author nothing to act on | Name the concrete move: extract this helper, delete this wrapper, collapse these branches into one typed dispatch |
| Letting a file cross 1,000 lines silently | The threshold exists precisely to force a decomposition conversation before a file becomes unreviewable | State the before/after count and ask directly whether to decompose first |
| Relocating complexity instead of deleting it | A refactor that moves the same tangle to a new file looks like progress but changes nothing real | Distinguish "moved" from "deleted" explicitly; credit only genuine complexity reduction |
| Adding a generic wrapper/factory for one call site | A single-implementation interface or pass-through helper adds a layer a reader must open before finding the real logic, for no reuse payoff | Name what the wrapper hides; propose calling the direct implementation unless a second real caller already exists |
| Flagging every `any`/cast as a defect regardless of context | Turns this into generic type-purity nagging unrelated to maintainability | Only flag a type escape when it actually obscures an invariant or papers over an unclear boundary |

### Worked example

- *Weak (vague):* "This function is a bit long and could probably be cleaner. Consider breaking it
  up."
- *Weak (concrete but not code-judo):* "Extract the flag-handling logic in `processOrder()` into a
  `runOrderSteps(flags)` helper." This rearranges the same six flags and four branches into a new
  function — every combination that could run before can still run after, including the untested
  `validate=false, notify=true` one. Nothing was deleted; the complexity just moved one call frame
  deeper.
- *Sharp:* "`processOrder()` is 340 lines and handles four unrelated concerns (validation, pricing,
  inventory reservation, notification) behind one function, with six boolean flags controlling
  which paths run. **Code-judo move:** split into `validateOrder`, `priceOrder`,
  `reserveInventory`, `notifyOrderPlaced` — each takes the order and returns a typed result; the
  six flags disappear entirely because each caller now calls only the steps it needs, instead of
  one function branching on flags to skip steps. This isn't a style preference: the flag
  combination currently untested (`validate=false, notify=true`) becomes structurally
  impossible — there is no longer a flag to set — instead of merely untested."

## Config and references
- `jstack.config.json` — team ids, integrations, `skill_defaults`, `jira_rules`, `notion`, `gbrain`. Never hardcode.
- Questions (open-ended, one at a time): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/question-patterns.md`
- Discrete choices (when the host supports AskUserQuestion or equivalent): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/ask-user-question-patterns.md`
- Integrations: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/integration-guide.md`
- Chaining: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/chaining-guide.md`

## Intake
1. Parse `$ARGUMENTS` — get the artifact (diff, PR link/number, or file set) before doing anything
   else. No artifact means no audit; ask for one rather than improvising.
2. Confirm this is the right tool: if the actual ask is security/compliance/performance/QA
   coverage or a routine PR read, say so and suggest `jstack:thermonuclear-review` or
   `jstack:review-code-review` instead of running this narrower lens anyway.
3. If a required id (PR number, branch, file path) is missing, ask **one** focused question.

## Procedure
### Step 1 — Load config
Read relevant keys from `jstack.config.json` and `prompts/policies/review-policy.md`. If an
integration is missing, say so and point to `jstack setup` / `jstack doctor` instead of faking data.

### Step 2 — Plan the safe path
Read the whole artifact before forming an opinion — a code-judo move proposed from a skim is a
guess, not a finding. State the artifact's size (files, LOC, before/after line counts per touched
file); if it exceeds the ~200-400 LOC ceiling, say so and either split the audit or disclose
partial coverage explicitly.

### Step 3 — Execute
Go file by file through the diff, checking every numbered standard against that file before moving
to the next:
1. **Code-judo pass.** Before accepting the current shape, ask whether a restructuring would make
   whole branches, helpers, or conditionals disappear rather than just move.
2. **1k-line check — run a real command, don't eyeball it.** For each touched file:
   ```bash
   git diff --stat -- <file>              # +/- line delta for this file in the diff
   git show <base>:<file> | wc -l         # line count before the change
   wc -l <file>                            # line count after the change (working tree)
   ```
   Flag any file whose before count was <1000 and after count is >1000.
3. **Spaghetti-growth scan.** Look for new ad-hoc conditionals or special cases tangled into a
   previously cohesive flow.
4. **Thin-wrapper / magic-code scan.** Look for a new interface, factory, or generic mechanism with
   exactly one real caller, or brittle "magic" behavior standing in for a direct data-shape check.
5. **Type/boundary scan.** Check type/boundary cleanliness only where it actually bears on
   maintainability, not everywhere.
For each finding, name the file/line, the specific mechanism (what makes it messier or what the
cleaner structure would look like), and the concrete remedy — never "consider cleaning this up."

### Step 4 — Validate
Confirm every finding names a concrete restructuring or a specific threshold breach, not a vibe.
Confirm no finding actually belongs to security/compliance/performance/QA (route those to
`jstack:thermonuclear-review` instead of absorbing them here). Confirm the file-size check covers
every touched file, not just the largest one.

### Step 5 — Summarize and hand off
State the top structural findings, ranked by how much complexity a fix would actually remove (not
by file size or LOC touched). Suggest `jstack:thermonuclear-review` if the user also wants the
other five lenses, or `jstack:review-code-review` if a routine merge verdict is what's actually
needed next.

## Output shape
Use a domain-appropriate heading, then:
- **Summary** (2–4 sentences: artifact reviewed, size, overall structural read)
- **Details** — findings ranked by complexity removed, each with file/line, mechanism, and remedy
- **Next steps** with owner + timeline if known
- **Limitations** (partial coverage, files not touched, artifact size cut)
- For eval-gated skills, end with `result_ok: true` or `result_ok: false` + reason

## Failure modes

| Symptom | Recovery |
|---------|----------|
| No artifact to review | Ask for a diff, PR link, or file paths. Do not improvise an audit on empty input. |
| Artifact exceeds the per-pass size ceiling | State the size, split the audit by file/module, or disclose partial coverage explicitly. |
| No code-judo move is actually visible | Say so plainly rather than inventing a restructuring that isn't genuinely simpler. |
| A finding is really security/compliance/performance/QA, not structural | Route it to `jstack:thermonuclear-review` instead of reporting it here as a structural finding. |
| Missing config / integration | Point to `jstack setup` or `jstack doctor`; do not continue with invented ids. |

## Chaining
This skill has two entry points, and both are legitimate — state which one applies when you hand
off:
- **Standalone.** Invoked directly for a routine PR's structural health, with no need for the
  other five lenses. If the user then wants security/compliance/performance/QA coverage too,
  suggest `jstack:thermonuclear-review` instead of expanding scope here.
- **Escalation target.** `jstack:thermonuclear-review`'s own "code quality" lens (routed to
  `staff-engineer`, covering complexity/debt/maintainability broadly across six lenses in one
  pass) can flag something that deserves a second, more rigorous, single-lens pass — that escalation
  reaches for this skill by name rather than trying to go deeper inside its own six-lens dispatch.
  When picking up that handoff, treat the flagged file/finding as the starting artifact, not the
  whole original diff, unless the user asks for the full surface again.

Use `jstack:review-code-review` instead for a routine PR with no structural-complexity question.
Once findings are resolved, `suggested_next: jstack:jira` to track remediation. Do not auto-invoke
without user intent.

## User request

$ARGUMENTS

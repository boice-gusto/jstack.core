---
name: jstack-engineering-fix-ci
description: >-
  Diagnose why a specific, already-open PR's or branch's CI check is red: pull the actual
  failing log (not just the summary line) via `gh pr checks`, `gh run view --log-failed`, or a
  third-party check's own external details URL, root-cause it, and apply exactly one focused
  fix. This is the single-iteration diagnose-and-fix unit that `jstack:engineering-loop-on-ci`
  calls repeatedly until every check is green — use this skill directly for one failing check,
  one pass; use `jstack:engineering-loop-on-ci` when the ask is to drive every currently-failing
  check to green automatically, across however many rounds that takes. Do NOT use for a
  pre-merge correctness review of a diff whose CI hasn't run yet or is currently green — that is
  `jstack:review-code-review` (or `jstack:thermonuclear-review` for a high-stakes pass), which
  hunts for defects in a diff rather than diagnosing why an already-red check is red. Do NOT use
  to make a check pass by adding `continue-on-error`, disabling the check, or `--no-verify` —
  none of those are an acceptable outcome here, even when the underlying issue turns out to be
  flaky or environmental rather than a real defect. Inspired by Cursor's `cursor-team-kit`
  plugin's `fix-ci` skill, adapted to jstack conventions.
category: engineering
effort: high
generator: skip
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config, pr_url_or_branch -->
<!-- outputs: structured_result -->
<!-- chains-to: jstack:engineering-loop-on-ci -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Take one currently-failing check on an already-open PR or branch, read its actual failure output
(the real log or the third-party check's own details page — never just the red-X summary line),
root-cause it, and apply exactly one focused fix. This is a single diagnose-and-fix pass, not a
loop: it does the work `jstack:engineering-loop-on-ci` calls on each of its rounds.
- **Out of scope:** Driving multiple rounds of "keep fixing until green" automatically (that's
  `jstack:engineering-loop-on-ci`, which calls this skill once per round); reviewing a diff for
  defects before CI has even run, or re-litigating a check that's already green (that's
  `jstack:review-code-review`); making a check pass without addressing its cause — `continue-on-error`,
  disabling the check, or `--no-verify` are never a "fix" this skill applies, regardless of
  whether the underlying cause turns out to be a real defect or environmental flakiness.

## Domain rules — CI failure diagnosis
- Read the actual failure output before diagnosing anything. `gh pr checks` and a red X only
  report `bucket`/`state` — pulling the failed job's real log (`gh run view <run-id> --log-failed`
  for GitHub Actions, or opening a third-party check's own external details URL) is mandatory
  before naming a root cause. A truncated summary line is not a diagnosis.
- Classify every failure as exactly one of three things, and never blur them together: (a) a
  real defect in product code or a test — fix the code; (b) a test-fixture or environment
  assumption bug — the test or its fixture assumes something true on a dev machine but not on a
  fresh CI checkout — fix the test's assumption, not the product; (c) flaky or environmental —
  name it as such explicitly, retry a bounded number of times, or flag it for a human.
- Never silently paper over (a), (b), or (c) with a skip/disable. Adding `continue-on-error`,
  disabling the check, or `--no-verify` as "the fix" is an anti-pattern regardless of which of
  the three the failure turns out to be — it removes the signal instead of resolving what it was
  telling you.
- Apply exactly one focused fix per iteration. Don't fold in a second, unrelated fix just because
  you noticed it while in the file — bundling makes it impossible to tell which change actually
  turned the check green, and complicates the re-check in Step 4.
- Verify before trusting the fix, especially for a category-(b) fixture/environment bug:
  reproduce the CI checkout's actual before-state locally (move the file aside, unset the env
  var, whatever the test wrongly assumed was present) and re-run the test before pushing.

### Named anti-patterns

| Anti-pattern | Why it's wrong | Do this instead |
|---|---|---|
| Diagnosing from the check's summary line or red X alone | `bucket: FAIL` and a truncated title are metadata, not the failure — the real cause is usually several lines into the log | Pull the failed job's real log (`gh run view <run-id> --log-failed`) or open the third-party check's own details URL before naming a cause |
| Adding `continue-on-error`, disabling the check, or `--no-verify` as the fix | Removes the signal without resolving what it was reporting — the next person inherits a red condition masked as green | Fix the diagnosed root cause; if it's genuinely flaky/environmental, name that explicitly and retry or flag for a human instead of muting it |
| Treating a fresh-checkout failure as a product regression without checking environment assumptions | Many "regressions" are test-fixture bugs — a file, env var, or state that's present on a dev machine but absent on a clean CI checkout | Diff CI's actual checkout state against what the test assumes before touching product code |
| Bundling a second, unrelated fix into the same push | Makes it impossible to tell which change actually turned the check green, and muddies the re-check | Apply exactly one focused fix, push, re-check that specific check before touching anything else |
| Retrying a flaky check indefinitely without ever naming it | Hides an infra problem forever and wastes CI minutes on every future PR | Retry a bounded number of times, then explicitly flag it as flaky/environmental for a human |

### Worked example

- **Weak:** A "check" workflow is red on a cancellation test. The fix applied: wrap the failing
  assertion in a broader try/catch, or add `continue-on-error: true` to the job so the pipeline
  reports green — without ever pulling the actual failed-job log to see what the assertion said.
- **Sharp:** Same red check. Pull the real log first: `gh run view <run-id> --log-failed`. It
  shows the cancellation test failing inside a `readFileSync` call against a repo-root
  `jstack.config.json` fixture — but that file is intentionally gitignored (per this repo's own
  `.gitignore`), so a fresh CI checkout never has it; the test only ever passed on a dev machine
  that happened to have run real setup locally before. Root cause is category (b) — a
  test-fixture assumption bug, not a product regression. Fix: change the test to treat "file
  absent" as a valid before-state instead of assuming the fixture is always there. Verified by
  moving the local fixture aside to simulate CI's fresh-checkout state and re-running the test
  before trusting the fix and pushing.

## Config and references
- `jstack.config.json` — team ids, integrations, `skill_defaults`, `jira_rules`, `notion`, `gbrain`. Never hardcode.
- Questions (open-ended, one at a time): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/question-patterns.md`
- Discrete choices (when the host supports AskUserQuestion or equivalent): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/ask-user-question-patterns.md`
- Integrations: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/integration-guide.md`
- Chaining: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/chaining-guide.md`

## Intake
1. Parse `$ARGUMENTS` for a PR reference (`owner/repo#number`, a full URL, or a bare number
   resolved against `gh repo view --json nameWithOwner`) or a branch name; if neither is given,
   check the currently checked-out branch for an open PR via `gh pr status` before asking.
2. If more than one check is currently failing, default to the first one `gh pr checks` lists
   and say so explicitly — don't silently pick a different one, and don't try to fix all of them
   in a single pass (that's the job `jstack:engineering-loop-on-ci` does across rounds).
3. If the request is actually "keep fixing CI until it's green" (implying repeated rounds), do
   one diagnose-and-fix pass here and hand off to `jstack:engineering-loop-on-ci` for the repeat
   loop rather than looping inside this skill.

## Procedure
### Step 1 — Load config
Resolve the PR/branch and confirm `gh` is authenticated against the right repo. If the repo
can't be inferred from the git remote, check `integrations.github.org` /
`integrations.github.default_repo` in `jstack.config.json` before asking the user.

### Step 2 — Identify the failing check and pull the real log
Run `gh pr checks {pr} --json name,bucket,state,workflow,link,description` and find the entries
with `bucket: FAIL`. For a GitHub Actions check, take the run id from its `link` and run
`gh run view <run-id> --log-failed` to get only the failed job's lines. For a third-party check
(not run through Actions), its `link` is the external details URL — open it and read that
system's own failure detail. Do not diagnose from `bucket`/`state`/a truncated title alone.

### Step 3 — Diagnose root cause
Read the actual failing assertion, stack trace, or error — not adjacent noise from a passing
step. Classify it as (a) real defect, (b) test-fixture/environment assumption bug, or (c)
flaky/environmental, per Domain rules above. State which one it is and why before moving to a fix.

### Step 4 — Apply one focused fix and verify
Apply exactly one change addressing the diagnosed root cause. For category (b), reproduce CI's
actual before-state locally (move/rename the file or unset the env var the test wrongly assumed)
and re-run the test before trusting the fix. For category (c), do not add `continue-on-error`,
disable the check, or use `--no-verify` — retry a bounded number of times and/or flag it for a
human with the evidence gathered in Step 3. Push the fix, then re-run `gh pr checks` (or
`gh run view`) to confirm that specific check now passes — don't assume from the diff alone.

### Step 5 — Summarize and hand off
State which check failed, the actual root cause (not the summary line), the one fix applied, and
the confirmed status after re-checking. If other checks are still red, or the user's real intent
is "drive everything to green," hand off with `suggested_next: jstack:engineering-loop-on-ci`
rather than looping here — this skill's contract is one diagnose-and-fix pass.

## Output shape
Use a domain-appropriate heading, then:
- **Summary** (2–4 sentences: which check failed, the diagnosed root cause category, the fix applied)
- **Details** — the actual log excerpt that grounded the diagnosis, and the fix's diff or description
- **Next steps** with owner + timeline if known
- **Limitations** (checks not yet re-verified, other checks still failing and left untouched)
- For eval-gated skills, end with `result_ok: true` or `result_ok: false` + reason

## Failure modes

| Symptom | Recovery |
|---------|----------|
| `gh` not authenticated / repo not found | Point to `gh auth login`; do not fabricate check state. |
| Check's `link` is a third-party dashboard, not a GitHub Actions run | Open the external URL directly and read that system's own failure detail before diagnosing. |
| `--log-failed` output is truncated or missing context | Fall back to `gh run view <run-id> --log` for the full log, or fetch the specific failed step via `gh api`. |
| Root cause turns out to be flaky or environmental, not a real defect | Name it explicitly; retry a bounded number of times or flag it for a human — never add `continue-on-error`, disable the check, or `--no-verify`. |
| Fix touches more than the one diagnosed root cause | Split into one focused fix per push; back the extra scope out before pushing. |
| Multiple checks are failing at once | Diagnose and fix one at a time (Intake step 2); suggest `jstack:engineering-loop-on-ci` if the ask is to drive all of them to green. |

## Chaining
Complete the work here — one diagnose-and-fix pass. If checks are still red after re-verifying,
or the user wants every currently-failing check driven to green automatically, hand off with
`suggested_next: jstack:engineering-loop-on-ci`, including the PR/branch ref, the check name just
fixed, and the current re-checked status so the loop can pick up the next failing check without
repeating this diagnosis. If no failures remain, say so plainly and stop — do not auto-invoke
`jstack:review-code-review`; that's a separate judgment call the user opts into on its own.

## User request

$ARGUMENTS

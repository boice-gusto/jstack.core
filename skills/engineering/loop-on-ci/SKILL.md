---
name: jstack-engineering-loop-on-ci
description: >-
  Watch a branch or pull request's CI checks and iterate — inspect each failure, delegate the
  actual diagnose-and-patch work to `jstack:engineering-fix-ci`, re-check, and repeat until every
  check is green or a stopping condition is hit. Use when the user says "loop on CI," "keep fixing
  this until it's green," "watch this PR and fix failures," or pastes a PR/branch and asks you to
  babysit it through to a passing build. Do NOT use for a single diagnose-and-patch pass on one
  already-known failure — that unit of work is `jstack:engineering-fix-ci`, which this skill calls
  repeatedly; if the user only wants that one pass, invoke it directly instead. Do NOT use for a
  read-only health snapshot across all configured repos (CI status, PR queue, flaky tests, revert
  risk) — that is `jstack:engineering`, which never actively loops on or fixes one specific PR.
  Inspired by Cursor's `cursor-team-kit` plugin's `loop-on-ci` skill, adapted to jstack conventions.
category: engineering
effort: medium
generator: skip
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config, pr_url_or_branch -->
<!-- outputs: structured_result -->
<!-- chains-to: jstack:engineering-fix-ci -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Watch a branch or PR's checks and iterate on failures until everything is green — inspecting what
broke each round, handing that one failure to `jstack:engineering-fix-ci` to diagnose and patch,
re-checking the full check set, and repeating. This skill is the **loop**, not the fix: it decides
what to check and when to stop; `jstack:engineering-fix-ci` decides how to fix what's broken.
- **Out of scope:** Reimplementing the diagnose-and-patch mechanics that belong to
  `jstack:engineering-fix-ci` (log parsing, root-causing a specific failure, writing the patch) —
  this skill calls that skill once per iteration instead of duplicating it; inventing a custom
  polling/scheduling primitive for long unattended runs (see Domain rules); running unattended past
  the agreed stopping condition without checking back in with the user.

## Domain rules — CI loop

### Absolute rules
1. `gh pr checks` is the source of truth for what's attached to a PR, never `gh run list` alone —
   `gh run list` only enumerates GitHub Actions runs and silently misses external/third-party
   checks (a required Buildkite pipeline, a status check posted by a third-party app) that are
   still attached to the PR and still block merge. Every iteration re-reads `gh pr checks`, not a
   cached run list from the last round.
2. Each iteration is exactly one call to `jstack:engineering-fix-ci` for the failures currently
   showing on `gh pr checks`, not a hand-rolled fix inline in this skill. If this skill starts
   parsing logs and writing patches itself, it has silently absorbed the sibling skill's job.
3. Stop on one of three conditions, and name which one triggered: (a) all checks green, (b) the
   configured max-iteration count is reached, or (c) a failure that isn't fixable without user
   input (a missing secret, an infra outage, a design decision, an intentionally-failing check).
   Never keep looping past (b) or (c) hoping the next attempt differs.
4. Do not invent a busy-poll loop. CI runs take minutes, not seconds — poll on a sensible interval
   (e.g. every 60-120s, or use `gh pr checks --watch` which already backs off sensibly) and cap the
   number of iterations up front. If the ask is to run this unattended over a long period, note
   that the host environment (Claude Code) may already have its own loop/scheduling mechanism
   (e.g. the `loop` or `schedule` skill) and prefer that over a hand-rolled wait/retry inside this
   skill's own procedure.
5. Never bypass a failing check to force progress — no `--no-verify`, no admin-merge override, no
   quieting a check by disabling it. If a failure is unrelated to the branch's own diff and already
   fixed on the base branch, the fix is merging/rebasing latest base, not suppressing the check.

### Anti-overcorrection notes
- A flaky check (passes on retry with no code change) is not the same as a real failure — retry
  once, and if it goes green, report the flake with evidence (which check, which run) rather than
  spending an iteration having `jstack:engineering-fix-ci` patch code that wasn't the problem.
- Don't treat "checks are still pending" as a failure needing a fix iteration — pending is not
  failing; wait for the check to resolve before deciding whether to loop.
- Don't collapse three genuinely independent failing checks into one `jstack:engineering-fix-ci`
  call with three unrelated asks bundled in — but *do* treat multiple checks that clearly share one
  root cause (same lint rule tripping in three jobs) as a single call, the same cross-gate
  root-cause-collapsing judgment `jstack:engineering-compatibility-check` applies to its own gates.

### Named anti-patterns

| Anti-pattern | Why it's wrong | Do this instead |
|---|---|---|
| Using `gh run list` as the only signal for "is CI green" | Only covers GitHub Actions; a required external check (Buildkite, a third-party app status) can be red while `gh run list` shows all green | Read `gh pr checks --json name,bucket,state,workflow,link` every iteration — it's the actual PR-attached check set |
| Diagnosing and patching the failure inline in this skill | Duplicates `jstack:engineering-fix-ci`'s job with none of its rigor, and drifts the two implementations apart over time | Hand the current failure set to `jstack:engineering-fix-ci` each iteration; this skill only decides what to check and when to stop |
| Looping indefinitely with no iteration cap | An unfixable failure (missing secret, infra outage) turns into an infinite loop that burns time and, if scripted, cost | Set a max-iteration count up front; stop and report when a failure needs user input |
| Busy-polling `gh pr checks` in a tight loop | CI runs take minutes; sub-second polling wastes calls and rate-limit budget for no earned signal | Poll every 60-120s, or use `gh pr checks --watch --fail-fast`, which already paces itself |
| Bypassing a stubborn check with `--no-verify` or an admin merge to "get to green" | Defeats the entire point of the loop — the check is now false-green, not actually passing | Keep the check red and reported until it's genuinely fixed or the user explicitly accepts the override |

### Worked example

- *Weak:* "Checked `gh run list`, all green, done." — while a required Buildkite check attached
  directly to the PR (not a GitHub Actions run) is still red, because `gh run list` never surfaced
  it.
- *Sharp:* "Iteration 1: `gh pr checks --json name,bucket,state,workflow,link` shows 4 checks —
  `build` (pass), `lint` (fail), `test` (fail), `buildkite/integration` (fail, external). Handed all
  three failures to `jstack:engineering-fix-ci` in one call since `lint` and `test` share a root
  cause (a renamed export breaking both) and `buildkite/integration` is a separate, unrelated flake
  candidate. `jstack:engineering-fix-ci` patched the renamed-export break and pushed. Iteration 2:
  re-ran `gh pr checks` — `lint`/`test` now pass; `buildkite/integration` still failing with the
  same error as before the push (unrelated to this branch's diff, confirmed still red on base too).
  Retried once per the flake/unrelated-failure rule — still red on base — so this is a pre-existing
  base-branch break, not something this PR should carry a fix for; reported to the user with the
  Buildkite run link instead of consuming another iteration patching around it. Stopped at
  iteration 2 of a 5-iteration cap: condition (c), a failure not fixable without user input (base
  branch itself is broken)."

## Config and references
- `jstack.config.json` — team ids, integrations, `skill_defaults`, `jira_rules`, `notion`, `gbrain`. Never hardcode.
- Questions (open-ended, one at a time): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/question-patterns.md`
- Discrete choices (when the host supports AskUserQuestion or equivalent): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/ask-user-question-patterns.md`
- Integrations: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/integration-guide.md`
- Chaining: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/chaining-guide.md`

## Intake
1. Parse `$ARGUMENTS` for an `owner/repo#number`, a full PR URL, a bare PR number (resolve
   `owner/repo` from the current git remote via `gh repo view --json nameWithOwner`), or a branch
   name with no PR yet opened.
2. If no PR or branch is identifiable, ask **one** focused question rather than guessing which
   branch to watch. If a branch has no open PR, say so and ask whether to open one first or just
   watch local/pushed CI another way.
3. If the request also specifies an iteration cap or poll interval, use it; otherwise default to a
   small, explicit cap (e.g. 5 iterations) and a 90s poll interval, and state the default you used
   rather than looping silently on an unstated assumption.

## Procedure
### Step 1 — Load config
Resolve the PR via `gh pr view --json number,url,headRefName`. Confirm `gh` is authenticated
against the right repo. Read any `skill_defaults` override for iteration cap or poll interval from
`jstack.config.json` if present; otherwise use the Intake defaults.

### Step 2 — Plan the safe path
State the stopping conditions (max iterations, green, unfixable-without-user-input) and the
iteration cap **before** the first loop iteration runs, not after. Confirm no step in this
procedure bypasses a check (`--no-verify`, admin merge) to force progress.

### Step 3 — Execute
Repeat until a stopping condition is hit:
```bash
# Source of truth for PR-attached checks — not gh run list
gh pr checks --json name,bucket,state,workflow,link
```
1. If any checks are still `pending`, wait one poll interval and re-check — pending is not a
   failure (Anti-overcorrection notes).
2. If checks are all `pass`, stop: condition (a), report green.
3. If one or more checks are `fail`, group failures by shared root cause where evident, then hand
   each group to `jstack:engineering-fix-ci` as its own call, describing the failing check(s), the
   link to logs, and which files/workflow they belong to.
4. After `jstack:engineering-fix-ci` returns (patch applied and pushed, or reports it can't fix
   without user input), re-run `gh pr checks` and repeat from the top.
5. If a failure repeats unchanged after a retry and is also red on the base branch, treat it as
   condition (c) — not fixable by this PR — and stop rather than spending another iteration on it.
6. Increment the iteration counter each pass through this loop; stop at the cap (condition (b)).

### Step 4 — Validate
Confirm the final `gh pr checks` read (not a stale one from an earlier iteration) backs whatever
status is reported. Confirm every failure handed to `jstack:engineering-fix-ci` is named with its
actual check name and link, not paraphrased. Confirm the stopping condition reported (a/b/c)
matches what actually happened — never report "green" without a check run that shows it.

### Step 5 — Summarize and hand off
State the final check status, how many iterations ran, what each `jstack:engineering-fix-ci` call
fixed, and which stopping condition ended the loop. If it stopped on (b) or (c), name exactly what
still needs attention and from whom.

## Output shape
Use a domain-appropriate heading, then:
- **Summary** (2–4 sentences: PR/branch, final check status, how many iterations, which stopping condition)
- **Details** — per-iteration failure summary and the fix each `jstack:engineering-fix-ci` call applied
- **Next steps** with owner + timeline if known
- **Limitations** (checks left red and why, anything needing user input)
- For eval-gated skills, end with `result_ok: true` or `result_ok: false` + reason

## Failure modes

| Symptom | Recovery |
|---------|----------|
| `gh` not authenticated / PR not found | Point to `gh auth login`; do not fabricate check status. |
| A required check exists only as a third-party status, not a GitHub Actions run | Confirm it shows in `gh pr checks`; never rely on `gh run list` alone to call CI green. |
| Same failure repeats after a fix attempt, unchanged | Retry once for flake; if still failing and also red on base, stop as condition (c) and report — don't loop indefinitely. |
| Iteration cap reached with checks still red | Stop, report condition (b), and summarize what's still failing and what's been tried. |
| A failure needs a secret, credential, or product decision only the user can supply | Stop immediately as condition (c); do not have `jstack:engineering-fix-ci` guess at a workaround. |
| User asks for this to run unattended for hours/days | Point at the host's own loop/scheduling mechanism (e.g. the `loop` or `schedule` skill) instead of a hand-rolled busy-poll inside this procedure. |

## Chaining
Each iteration hands the current failure set to `suggested_next: jstack:engineering-fix-ci` and
resumes this loop with its result. Complete the work here once a stopping condition is hit — do
not keep looping past green, the iteration cap, or a failure that needs user input.

## User request

$ARGUMENTS

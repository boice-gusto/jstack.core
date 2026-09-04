---
name: jstack-engineering-fix-merge-conflicts
description: >-
  Resolve merge/rebase/cherry-pick conflicts non-interactively where the correct resolution is
  genuinely unambiguous — reading every conflicting hunk with real git commands (`git status`,
  `git diff`, `git log --merge`, conflict-marker greps) before choosing a side — regenerate
  lockfiles with the package manager rather than hand-editing them, then validate by actually
  running the target repo's build/typecheck/test command before calling it done. Use when a branch
  has unresolved conflicts and needs a reliable path to a buildable state. Do NOT use to guess
  through a real semantic conflict — when both sides made substantively different logical changes
  to the same code, stop and ask rather than picking a side. Do NOT use for the deep line-level
  correctness/security read of the merged result — that is `jstack:review-code-review` (single
  deep read) or `jstack:thermonuclear-review` (high-stakes, six-lens); this skill's job stops at a
  clean, buildable, non-conflicted state. Do NOT use to force-push or discard uncommitted/unpushed
  work as a shortcut — check what's actually there before touching anything, and never run a
  destructive git operation without explicit human confirmation. Inspired by Cursor's
  `cursor-team-kit` plugin's `fix-merge-conflicts` skill, adapted to jstack conventions.
category: engineering
effort: high
generator: skip
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config, branch_or_merge_target -->
<!-- outputs: structured_result -->
<!-- chains-to: jstack:review-code-review, jstack:thermonuclear-review -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Get a branch with merge/rebase/cherry-pick conflicts back to a buildable, tested state —
resolving what's genuinely unambiguous (both sides add independent lines, a rename on one side
with an unrelated edit on the other), regenerating lockfiles rather than hand-merging them, and
validating with a real build/test run before calling it done.
- **Out of scope:** Guessing through a real semantic conflict — when two sides made substantively
  different logical changes to the same code, that is a decision for a human, not a coin flip. The
  deep line-level correctness/security review of the merged result once conflicts are gone
  (`jstack:review-code-review` or `jstack:thermonuclear-review` own that read; this skill stops at
  "clean, buildable, non-conflicted"). Pushing or force-pushing the result. Broad refactors "while
  I'm in here." Discarding anyone's uncommitted or unpushed work as a shortcut to a clean state.

## Domain rules — merge conflict resolution

### Absolute rules
1. **`git status` first, always** — before touching anything, confirm what's actually conflicted
   (`git status --porcelain=v1 | awk '/^(UU|AA|DD|AU|UA|UD|DU) /{print $2}'`) and whether any
   unfamiliar branch state might represent real in-progress work rather than something safe to
   overwrite. Unfamiliar state gets investigated, not bulldozed.
2. **A conflict is resolved by reading both hunks**, not by picking `--ours`/`--theirs` wholesale.
   Run `git diff` (shows both sides between the conflict markers) and, per file,
   `git log --merge --oneline -- <file>` to see the diverging commits' actual intent before
   choosing. Prefer keeping both sides' changes when they're independent; when they collide, take
   the variant that compiles and preserves both sides' intended behavior, not just the one that
   applies cleanly.
3. **Lockfiles are regenerated with the package manager, never hand-edited.** `bun.lock`,
   `package-lock.json`, `yarn.lock`, `Cargo.lock`, `Gemfile.lock` — resolve the manifest
   (`package.json`/`Cargo.toml`/etc.) first, then regenerate with `bun install` / `npm install` /
   `cargo generate-lockfile` / `bundle lock`. A hand-resolved lockfile silently drifts from what
   the manifest actually resolves to.
4. **No conflict markers survive in any file after this skill finishes.** Grep for markers before
   calling it done: `grep -rn '^<<<<<<<\|^=======\|^>>>>>>>' $(git status --porcelain=v1 | awk '{print $2}')`.
5. **Validation is a real command run, not an assumption.** Run the target repo's actual
   build/typecheck/test command — for this repo (jstack.core) that's `bun run check`; for any
   other repo, look up its `package.json` scripts / README / CI config, or ask the user if it
   isn't obvious — and show the real result before finishing.
6. **A hunk with real logic changes on both sides is a semantic conflict** — name it explicitly
   and ask, rather than resolving it silently in either direction.
7. **Never force-push, `git reset --hard`, `git checkout .`/`git restore .`, or discard
   uncommitted/unpushed work without explicit human confirmation.** Never skip hooks (`--no-verify`)
   or bypass signing (`--no-gpg-sign`) unless explicitly asked. If unrelated uncommitted changes are
   in the way, prefer `git stash` over discarding them. This mirrors this repo's own Git Safety
   Protocol: check status before any destructive op, resolve/stash over discard, never `--force`
   without explicit confirmation.

### Named anti-patterns

| Anti-pattern | Why it's wrong | Do this instead |
|---|---|---|
| Running `git checkout --ours`/`--theirs` on a whole file without reading both hunks | Silently discards one side's real change; the file may compile but ship a regression | Read both hunks; keep both when independent, or name the collision explicitly when they conflict |
| Resolving and pushing without ever running the build/tests | "It applied cleanly" is not the same claim as "it still works" | Run the repo's own check/build/test command and show the real result before finishing |
| Hand-editing a lockfile to make the conflict markers go away | Produces a lockfile that doesn't match what the package manager would actually resolve | Regenerate the lockfile with the package manager after resolving the manifest |
| Silently dropping a hunk that has real logic on both sides | Treats a genuine semantic conflict (two different intended behaviors) as a formatting nuisance | Flag it explicitly as a real decision for a human; do not guess which behavior should win |
| Discarding an unfamiliar stash, branch, or uncommitted change to "get to a clean state" | It may be someone's real in-progress work, not merge debris | Investigate what it is first; stash or set aside rather than delete if its origin is unclear |

### Worked example

- *Weak:* Conflict in `orders.ts` between two branches — run `git checkout --theirs orders.ts` and
  move on because it made the marker disappear.
- *Sharp:* Read both hunks: one side added input validation on `createOrder`, the other side added
  a new `discountCode` field to the same function. Neither invalidates the other. Kept both —
  validation logic plus the new field — then ran `bun run check` and confirmed the full suite
  passes before considering the file resolved.

## Config and references
- `jstack.config.json` — team ids, integrations, `skill_defaults`, `jira_rules`, `notion`, `gbrain`. Never hardcode.
- Questions (open-ended, one at a time): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/question-patterns.md`
- Discrete choices (when the host supports AskUserQuestion or equivalent): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/ask-user-question-patterns.md`
- Integrations: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/integration-guide.md`
- Chaining: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/chaining-guide.md`

## Intake
1. Parse `$ARGUMENTS` for the branch/merge/rebase in question. If ambiguous, run `git status` to
   see what's actually in progress rather than asking first.
2. If conflicts span files clearly outside what the user described, ask **one** focused question
   before resolving anything unexpected.
3. If the request bundles conflict resolution with an unrelated ask, resolve conflicts first and
   offer to continue with the second ask after.

## Procedure
### Step 1 — Load config
No config lookup is typically needed — this is a local git operation. Only read
`jstack.config.json` if the resolution touches a configured integration (rare).

### Step 2 — Plan the safe path
`git status` before anything else. Confirm every conflicting file and read both sides of every
hunk (`git diff` shows both with conflict markers) before resolving any of them. Never assume a
clean-looking `git status` elsewhere in the tree means nothing else is in progress.

### Step 3 — Execute
1. List every conflicting file (`git status` / `git diff --name-only --diff-filter=U`).
2. For each file, read both hunks fully. Resolve: keep both when independent; pick the compiling,
   behavior-preserving variant when they collide; flag explicitly and ask when both sides changed
   real logic in the same place.
3. Regenerate any conflicted lockfile with the package manager (e.g. `bun install`), never by hand.
4. Confirm no `<<<<<<<`/`=======`/`>>>>>>>` markers remain in any file.
5. Run the repo's own build/test/check command and confirm it passes.

### Step 4 — Validate
Show the real command and its real output for the build/test run — not an assumption it would
pass. Confirm every resolved hunk's decision is stated with a reason, not just "resolved."

### Step 5 — Summarize and hand off
List every file resolved, the decision made per file (kept both / picked a variant / flagged for a
human), and the validation result. This skill's job ends at a clean, buildable, non-conflicted
tree — it does not perform the correctness/security pass itself. Suggest
`jstack:review-code-review` (single deep read) or `jstack:thermonuclear-review` (high-stakes,
six-lens) as the natural next step if the user wants the merged result reviewed.

## Output shape
Use a domain-appropriate heading, then:
- **Summary** (2–4 sentences: how many files, how they were resolved, current build/test status)
- **Details** — per-file resolution decisions and why
- **Next steps** with owner + timeline if known
- **Limitations** (any hunk flagged for a human instead of resolved)
- For eval-gated skills, end with `result_ok: true` or `result_ok: false` + reason

## Failure modes

| Symptom | Recovery |
|---------|----------|
| A hunk has real logic changes on both sides | Stop; name the collision explicitly and ask the user which behavior should win, rather than guessing. |
| Lockfile conflict | Resolve the manifest, then regenerate the lockfile with the package manager — never hand-edit it. |
| Build/test fails after resolution | Do not call it done; diagnose against the actual failure (consider `jstack:engineering-fix-ci` if it's a CI-shaped failure) before finishing. |
| Unfamiliar uncommitted changes or a stash appear mid-resolution | Stop; investigate what they are before doing anything that could discard them. |
| No build/test command is knowable for this repo | Say so explicitly; do not claim a resolution is validated when nothing was actually run. |

## Chaining
Complete the work here — resolve, validate, and stop at a clean/buildable/non-conflicted state.
This skill does not perform the deep correctness pass itself: if the user wants the merged result
reviewed, suggest `suggested_next: jstack:review-code-review` (single deep read) or
`jstack:thermonuclear-review` (high-stakes, six-lens). Do not auto-invoke without user intent.

## User request

$ARGUMENTS

---
name: jstack-create-plugin-pr
description: Open a PR to jstack.core or jstack.gusto using distribution.github from config; block secrets via path_deny_globs.
category: plugin
gbrain_destination: inherit
data_class: internal
when_to_use: Contributor has local changes and wants a PR against the configured core or gusto distribution repo.
disable-model-invocation: true
---

<!-- Chain Contract -->
<!-- inputs: user_request, changed_paths, jstack_config -->
<!-- outputs: pr_url optional, structured_result -->
<!-- chains-to: (none required) review or ship skills if org uses them -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for

Guide a contributor from a **local branch** to a **pull request** against the repo declared in **`distribution.github`** (`core` or `gusto`). **Never** guess `owner`/`repo` — read merged `jstack.config.json` (or defaults). **Block** changes that match **`distribution.plugin_pr.path_deny_globs`**.

## Out of scope

- Merging the PR (use org ship/land process).
- Writing code for the user; this skill is **process + safety gates** only.

## Domain rules — distribution PRs

- **Config truth:** Empty `owner` or `repo` means stop and run **`jstack setup`** or hand-edit config — do not construct GitHub URLs from memory.
- **Denylist:** If any **staged** path matches `path_deny_globs` (e.g. `.mcp.json`, `.env`, secrets), **stop** and ask to unstage or split.
- **Enterprise / mirror** hosts: follow gusto **`references/distribution-updates.md`** and **`references/distribution/pr-conventions.md`** when those files exist.

## Config and references

- `distribution.github.core` / `distribution.github.gusto` — `owner`, `repo`, `default_branch`
- `distribution.plugin_pr.path_deny_globs`
- Optional: `jstack.gusto` **`references/distribution-updates.md`**, **`references/distribution/pr-conventions.md`**
- `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/response-artifacts.md`

## Intake

1. Confirm **target** package: `core` vs `gusto` from user intent and which paths they edited.
2. Collect or assume **branch name**; prefer user-provided.

## Procedure

### Step 1 — Load config

Load merged config. If `owner` or `repo` is empty for the chosen target, tell the user to run `jstack setup` or edit config.

### Step 2 — Path safety

From `git status` / diff, list paths; if any path matches `path_deny_globs`, **refuse** until resolved.

### Step 3 — Open PR

Push branch and open the PR to `owner/repo` on `default_branch` with: summary, **test plan** (e.g. `bun run check` in the touched package from repo README), and risk notes.

### Step 4 — Link

Add **## Links** with the PR URL when known.

## Output shape

- **Summary** — Target repo, branch, and whether deny globs passed.
- **PR** — Link under **## Links** or explicit “user must open in browser” with URL parts from config.
- **Checklist** — Tests to run, copied from org conventions if any.

## Failure modes

| Symptom | Recovery |
|---------|----------|
| Deny glob hit | List matching paths; ask to unstage or move secrets out of PR. |
| Wrong remote | Re-read `distribution.github.*`; do not fix with guessed URLs. |
| No git write access | Give exact `git push` and `gh pr create` (or web) steps. |

## Chaining

- `suggested_next:` org **review** or **ship** skills if the user wants merge/deploy follow-up.

## User request

$ARGUMENTS

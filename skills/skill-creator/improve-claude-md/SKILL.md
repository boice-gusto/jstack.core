---
name: jstack-improve-claude-md
description: Audit a project's CLAUDE.md against commits, session transcripts, and working-tree state, then propose ranked edits as a unified diff. Read-only by default; --apply is opt-in. Use when CLAUDE.md feels stale, when you have been correcting Claude on the same thing, or as a monthly hygiene routine.
category: skill-creator
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config, project_root -->
<!-- outputs: structured_result (recommendations, filtered_out, patch_path) -->
<!-- chains-to: jstack:update-config (if persisting new defaults only) -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for

**Audit and improve** the project-root `CLAUDE.md` (and `CLAUDE.local.md` if present) by surfacing drift, vagueness, and missing rules. Output is a unified diff against `CLAUDE.md` plus a markdown report. Read-only unless the user passes `--apply`.

- **In scope:** project-root `CLAUDE.md`, `CLAUDE.local.md`, signals from commits / session transcripts / working tree / lockfiles / README / `jstack.config.json`.
- **Out of scope:** authoring **new skills** (use `jstack-skill-creator`); editing global `~/.claude/CLAUDE.md`; running `git` mutations (only `--apply` writes, behind a confirmation).

## Domain rules

- **Default is propose-as-diff.** Never write to `CLAUDE.md` without `--apply` AND a confirmation.
- **Every edit must cite ≥1 piece of evidence** (commit, session, file path, or another rule). No hallucinated rules.
- **PII redaction is always-on** in evidence excerpts (see `cli/src/lib/claude-md-improver.ts` `PII_PATTERNS`).
- **Declined edits are remembered** in `.jstack/claude-md-improver-history.json` and skipped on subsequent runs unless evidence materially changes.
- **Persona review is mandatory** before showing edits to the user — at least 3 of 4 personas (CEO/PM/ENG/QA) must score ≥8.

## Config and references

- `jstack.config.json` keys: `claude_md_improver.{enabled, transcript_lookback_days, commit_lookback_count, min_priority, persona_threshold, report_path, patch_path, high_correction_session_threshold}`.
- Detectors: `${CLAUDE_PLUGIN_ROOT}/skills/skill-creator/improve-claude-md/references/detectors.md`
- Scoring: `${CLAUDE_PLUGIN_ROOT}/skills/skill-creator/improve-claude-md/references/scoring.md`
- Persona rubric: `${CLAUDE_PLUGIN_ROOT}/skills/skill-creator/improve-claude-md/references/persona-review.md`
- Output schema: `${CLAUDE_PLUGIN_ROOT}/skills/skill-creator/improve-claude-md/references/output-schema.md`
- Output formats: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/output-formats.md`

## Intake

1. Parse `$ARGUMENTS` — note any flags: `--apply`, `--yes`, `--output={prose|json|patch}`, `--persona-mode={llm|rubric-only}`, `--redact`.
2. If `claude_md_improver.enabled` is false, exit with: *"claude-md-improver disabled in config. Set `claude_md_improver.enabled=true` in `jstack.config.json` to use this skill."*
3. If `CLAUDE.md` is missing, suggest `jstack-skill-creator` to scaffold a starter and exit.

## Procedure

### Step 1 — Scan (deterministic)

Run:

```bash
jstack claude-md scan --output json > .jstack/claude-md-issues-$(date +%F).json
```

This reads `CLAUDE.md`, lockfiles, transcripts, commit log, README and emits all detected `Issue`s, scored by priority. **No LLM** is called yet.

If the JSON `meta.notes` includes "No transcripts found", emit a one-line warning to stdout: *"Running without session-derived detectors — recommendations are limited to drift and vagueness."*

### Step 2 — Propose (LLM, one prompt per Issue)

For each `Issue` in the JSON `issues[]` array, write a `ProposedEdit` (see `cli/src/lib/claude-md-improver.ts`). The prompt for each is:

> You are an editor sharpening a CLAUDE.md rule. Given the issue below and the surrounding CLAUDE.md context (lines `[anchor.line_start - 3, anchor.line_end + 3]`), produce a `ProposedEdit` JSON object with these fields: `before`, `after`, `rationale`, `diff_hunk` (unified-diff format), `benefit` (one sentence starting with "Claude…"), `example` (one sentence: a concrete next-session scenario where the rule helps). Cite the evidence verbatim in the rationale. Do not invent new rules.

Reject any LLM output where `before`/`after` types do not match the issue's category (e.g. `add-rule` requires `before: null`).

### Step 3 — Persona review (LLM × 4)

For each `ProposedEdit`, run the four-persona rubric in `references/persona-review.md`. Score sub-scores per the table; compute `average`; emit `verdict`. If any persona's `verdict == revise`, apply its `edit_for_revise` to the named field and re-run that persona once. Drop any edit that fails the acceptance rule (≥3 of 4 average ≥8).

### Step 4 — Render

Pipe the accepted edits back into the deterministic CLI:

```bash
jstack claude-md render --input .jstack/final-edits.json --output prose > .jstack/claude-md-improvements-$(date +%F).md
jstack claude-md render --input .jstack/final-edits.json --output patch > .jstack/claude-md-improvements-$(date +%F).patch
```

### Step 5 — Selection / apply

Print the prose report to the user. Then prompt:

```
Apply edits: [a]ll, [n]one, or numbered hunks (e.g. 1,3,5).
Or run with --apply to apply all without prompting (one git commit will be created).
```

- `[n]one`: write declined IDs to `.jstack/claude-md-improver-history.json` and exit.
- `[a]ll` or numbered: print the exact `git apply` command. Do not run it.
- `--apply`: validate `CLAUDE.md` mtime vs scan time. If unchanged, run `git apply <patch>` then `git add CLAUDE.md && git commit -m "chore: apply CLAUDE.md improver patch <date>"`. If changed, abort with: *"CLAUDE.md changed since scan — re-run the improver."*

## Output shape

- **Summary** — N issues, M accepted, K filtered.
- **Files** — Report path + patch path.
- **Recommendations** — Numbered list (priority desc) with category, benefit, example, persona scores, diff hunk inline.
- **Filtered out (transparency)** — Each rejected edit with the rejecting persona and reason.
- `result_ok: true` or `result_ok: false` + reason.

## Failure modes

| Symptom | Recovery |
|---------|----------|
| `claude-md-improver disabled in config` | Set `claude_md_improver.enabled=true` and re-run. |
| No CLAUDE.md found | Suggest scaffolding via `jstack-skill-creator`. |
| No transcripts found | Continue with confidence=medium ceiling; emit a warning. |
| `git apply` fails (file changed since scan) | Re-run; do not attempt a 3-way merge. |
| Persona review accepts 0 edits | Surface rejected list; suggest `--persona-threshold=2`. |
| LLM proposes a previously-declined rule | Skipped automatically via `.jstack/claude-md-improver-history.json`. |

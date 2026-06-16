# Persona Review Rubric — CLAUDE.md Improvements

This rubric makes the four-persona pass reproducible enough to test (`--persona-mode=rubric-only`) and consistent enough to trust in production (LLM-driven).

## Inputs

- One `ProposedEdit` (see `cli/src/lib/claude-md-improver.ts` types).
- The four persona files: `prompts/personas/{ceo,pm,engineer,qa}.md`.

## Output per persona

```yaml
persona: ceo | pm | engineer | qa
sub_scores:
  s1: 1..10        # see table below for what s1/s2/s3 mean per persona
  s2: 1..10
  s3: 1..10
average: number    # mean of s1..s3
verdict: accept | revise | reject
edit_for_revise:   # present iff verdict=revise; one-line text edit applied to the ProposedEdit field named in 'edit_target'
edit_target: rationale | after | example
reason: string     # one sentence
```

## Sub-score definitions

| Persona | s1 | s2 | s3 |
|---------|----|----|----|
| CEO     | Strategic value | Avoids over-prescription | Risk profile |
| PM      | Trigger clarity | Outcome observability | Workflow fit |
| ENG     | Technical accuracy | Convention fit | No conflict with another rule |
| QA      | Testability | Reversibility | Failure-mode coverage |

## Acceptance rule

An edit is **accepted** iff:

- ≥3 of 4 personas have `average ≥ 8` AND `verdict ≠ reject`, **OR**
- All 4 personas have `average ≥ 8` after one auto-revision pass (apply the persona's `edit_for_revise` to the ProposedEdit field named by `edit_target`, then re-score).

## Rubric-only test mode

When invoked with `--persona-mode=rubric-only`, the LLM is bypassed. Each sub-score is computed by these rules:

| Persona | s1 rule | s2 rule | s3 rule |
|---------|---------|---------|---------|
| CEO     | `+2` if `priority_score ≥ 20`; `+2` if confidence=high; base 5 | `+3` if `after.length ≤ 200`; base 6 | `+3` if `category != "remove-stale-rule"` else +1; base 6 |
| PM      | `+3` if `example` is non-empty AND contains a verb; base 5 | `+3` if `benefit` includes the word "stop", "avoid", "reduce", or "eliminate"; base 5 | `+2` if evidence has ≥1 commit OR ≥1 session excerpt; base 6 |
| ENG     | `+2` if `diff_hunk` parses as unified diff; base 6 | `+2` if `before`/`after` types match category (e.g. add-rule has `before=null`); base 6 | `+2` if no other accepted edit shares the same `claude_md_anchor.line_start`; base 6 |
| QA      | `+3` if `example` is non-empty; base 5 | `+2` if `category != "fix-contradiction"` else +0 (contradictions are higher-risk to apply); base 6 | `+3` if `confidence != "low"`; base 5 |

Each sub-score is clamped to `[1, 10]`.

## Hard rejects (override accept)

- **CEO:** `category == "add-rule"` AND `after` mentions a specific vendor without justification → `verdict: reject`.
- **PM:** `example` is empty OR `benefit` is empty → `verdict: reject`.
- **ENG:** `diff_hunk` does not include `@@` → `verdict: reject`.
- **QA:** `confidence == "low"` AND `category == "fix-contradiction"` → `verdict: reject`.

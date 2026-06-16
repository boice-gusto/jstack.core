<p align="center">
  <img src="../assets/logo-placeholder.png" alt="jstack" width="240" height="240" />
</p>

# Skill evals (jstack.core)

## Commands

| Script | Purpose |
|--------|---------|
| `bun run eval:quick` | Structural inventory + chain + YAML lint + coverage (default CI) |
| `bun run eval:semantic` | Claude CLI + grader (needs `ANTHROPIC_API_KEY`) |
| `bun run eval:scenarios` | Scenario pack (`scenarios/packs/*.yaml`) — heavier |
| `bun run generate-evals-json` | Regenerate `evals.json` from all `skills/**/SKILL.md` |

**CI:** `bun run check` runs quick + `evals/assert.test.ts` (programmatic assert helpers).

## Eval YAML

- Each case: `prompt`, `criteria[]`, optional `assert` (hard checks merged after LLM grade in `grade.ts`).
- **`assert`** fields (see `eval-config.ts` / `discover.ts`):
  - `response_contains`, `response_contains_any`, `response_not_contains`, `response_min_length`
  - `response_match_regex` — list of JS regex **patterns** tested against the full model response

## Fixtures

- Optional `files:` array in a case loads workspace files for `execute.ts`.
- Keep secrets out of YAML; use fake ids and example.com URLs.

## Gate + merge

- Per-skill `evals/eval-config.yaml` can set `gate` rules merged in `mergeGateRule`.

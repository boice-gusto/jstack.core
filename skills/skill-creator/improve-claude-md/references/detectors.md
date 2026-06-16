# Detectors D1–D10 — Implementation Notes

Each detector is a pure function in `cli/src/lib/claude-md-improver.ts`. Tests (`cli/src/lib/claude-md-improver.test.ts`) pin the contract.

| # | Function | Source | Output category |
|---|----------|--------|-----------------|
| D1 | `detectD1StalePackageManager(collected)` | CLAUDE.md + lockfiles | `remove-stale-rule` |
| D2 | `detectD2StalePath(collected)` | CLAUDE.md + working tree | `remove-stale-rule` |
| D3 | `detectD3VagueRule(collected)` | CLAUDE.md | `sharpen-rule` |
| D4 | `detectD4RepeatedCorrection(prompts)` | session JSONL | `add-rule` |
| D5 | `detectD5RepeatedReask(prompts, claudeMd)` | session JSONL | `add-rule` |
| D6 | `detectD6ContradictionCandidates(parsed)` | CLAUDE.md (pairs) | `fix-contradiction` |
| D7 | `detectD7MissingExample(collected)` | CLAUDE.md | `add-example` |
| D8 | `detectD8UnmentionedCommand(prompts, commits, md)` | commits + transcripts | `add-rule` |
| D9 | `detectD9ReadmeDuplication(collected)` | CLAUDE.md + README | `dedupe` |
| D10 | `detectD10DontGap(prompts, md)` | session JSONL + CLAUDE.md | `add-rule` |

## Adding a new detector

1. Add a function `detectDN<Name>(...)` in `cli/src/lib/claude-md-improver.ts`.
2. Add a fixture + unit test in `cli/src/lib/claude-md-improver.test.ts`.
3. Wire it into `detect()`'s spread.
4. Update this table.

## Confidence guidance

- `high`: deterministic + multi-source evidence (e.g. D1 lockfile + CLAUDE.md text).
- `medium`: deterministic + single-source.
- `low`: heuristic / requires LLM judgment to confirm (e.g. D6 candidate pairs).

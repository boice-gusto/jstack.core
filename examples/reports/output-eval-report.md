# Eval report (example output)

**Period:** 2026-04-01 — 2026-04-26  
**Team:** Platform  
**Evaluator:** Manager (lightweight)

## Summary

Skill evals covered **recon → prioritize → jira-intake** chain. Gate pass rate **87%** (13/15). Two failures were missing `action_items:` line format.

## Metrics

| Gate            | Pass |
|-----------------|------|
| recon_list      | 7/8  |
| prioritize_order| 8/8  |
| jira_fields     | 6/8  |

## Recommendations

1. Add one eval example with explicit `action_items: 0` for empty recon
2. Document `time_window` default in recon skill

## Artifacts

- Log: `evals/logs/2026-04-26-platform.json` (local, not committed)

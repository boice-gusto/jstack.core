# Scoring & Priority

`priority_score = monthly_savings_min × confidence_weight`

- `monthly_savings_min = estimated_corrections_avoided_per_week × 2.5 × 4`
- `confidence_weight: high=1.0, medium=0.7, low=0.4`

The default `min_priority` floor is `5.0` (configurable via `claude_md_improver.min_priority`). Scores below the floor are dropped before persona review.

When showing the report to the user, sort descending by `priority_score`. The displayed line:

```
## N. <raw_summary>   [priority: <score>]
```

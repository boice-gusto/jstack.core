# Chain: Intake → Sprint

> **Owner:** PM or scrum master. Edit this to match your actual intake-to-sprint flow, including which scoring rubric you use and how capacity is calculated.

**Flow:** `jstack:intake` → `jstack:prioritize` → `jstack:sprint-planning`

## Steps

1. **Intake** — shape raw request(s) into structured ticket fields. Split bundles into individual items. Output: candidate payload(s) ready for scoring.
2. **Prioritize** — rank the candidates using the configured rubric. Output: scored table with a cutline.
   <!-- [CUSTOMIZE] Which rubric does your team use? -->
   - RICE (default), WSJF, value/effort matrix, or custom
3. **Sprint planning** — merge top-ranked items into the current sprint scope, accounting for capacity and spill. Output: sprint commit list + deferred parking lot.

## Handoff rules

- Each step waits for user confirmation before proceeding to the next.
- If intake produces multiple candidates, prioritize scores **all** of them — do not filter before scoring.
- Sprint planning may reject items that exceed capacity; move them to the parking lot with a reason.

## Your customizations

<!-- [CUSTOMIZE] Adapt these to your team -->

| Setting | Default | Your value |
|---------|---------|------------|
| Scoring rubric | RICE | <!-- RICE, WSJF, value/effort? --> |
| Sprint capacity source | Team velocity average | <!-- Story points? Hours? Team member count? --> |
| Spill threshold | >10% of velocity | <!-- When do you flag spill risk? --> |
| Auto-create tickets? | No (draft only) | <!-- Does your team want tickets auto-created? --> |

## Config hook

```json
{
  "chains": {
    "intake_to_sprint": {
      "rubric": "RICE",
      "capacity_source": "velocity_average",
      "spill_threshold_pct": 10,
      "auto_create_tickets": false
    }
  }
}
```

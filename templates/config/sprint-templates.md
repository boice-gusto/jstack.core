# Sprint templates

Predefined sprint configurations. The config wizard presents these when `sprint` is not configured.

## Light

For teams that want minimal process. 1-week iterations, no formal ceremonies beyond planning.

```json
{
  "sprint": {
    "cadence_weeks": 1,
    "ceremonies": ["planning"],
    "capacity_metric": "tickets",
    "velocity_window": 3
  }
}
```

## Standard

The most common setup. 2-week sprints with planning and retrospective.

```json
{
  "sprint": {
    "cadence_weeks": 2,
    "ceremonies": ["planning", "retro"],
    "capacity_metric": "story_points",
    "velocity_window": 3
  }
}
```

## Scaled

For larger teams or teams with multiple stakeholders. Adds demo and grooming to the ceremony list.

```json
{
  "sprint": {
    "cadence_weeks": 2,
    "ceremonies": ["planning", "retro", "demo", "grooming"],
    "capacity_metric": "story_points",
    "velocity_window": 5
  }
}
```

## Kanban (no sprints)

Continuous flow. No fixed cadence. Use with reporting on a weekly or biweekly cycle instead.

```json
{
  "sprint": {
    "cadence_weeks": 0,
    "ceremonies": [],
    "capacity_metric": "throughput",
    "velocity_window": 4
  }
}
```

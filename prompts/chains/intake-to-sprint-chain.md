# Chain: Intake → Sprint

> **Maintainer:** PM or scrum master.

This file is injected verbatim into prompts. It contains no invented rubric choice or
capacity numbers beyond this repo's own defaults — treat any org-specific value not present
in config or the conversation as unknown, and ask rather than assume.

**Flow:** `jstack:intake` → `jstack:prioritize` → `jstack:sprint-planning`

## Steps

1. **Intake** — shape raw request(s) into structured ticket fields. Split bundles into individual items. Output: candidate payload(s) ready for scoring.
2. **Prioritize** — rank the candidates using the configured rubric (RICE, WSJF, value/effort matrix, or a custom one the team has agreed on — RICE is the default if nothing else is specified). Output: scored table with a cutline.
3. **Sprint planning** — merge top-ranked items into the current sprint scope, accounting for capacity and spill. Output: sprint commit list + deferred parking lot.

## Handoff rules

- Each step waits for user confirmation before proceeding to the next.
- If intake produces multiple candidates, prioritize scores **all** of them — do not filter before scoring.
- Sprint planning may reject items that exceed capacity; move them to the parking lot with a reason.

## Defaults and overrides

| Setting | Default | Where it's configured |
|---------|---------|-------------------------|
| Scoring rubric | RICE | No dedicated config key; state the rubric you're using in the output, and treat any rubric the team names in conversation as an override |
| Sprint capacity source | Team velocity average | `sprint.capacity_metric` (default `"story_points"`); cadence comes from `sprint.cadence_weeks` (default `2`) |
| Spill threshold | Flag anything that doesn't fit the current sprint's capacity | No dedicated config key; use a specific threshold only if the team has stated one |
| Auto-create tickets | No — draft only | No dedicated config key; this chain never auto-creates tickets on its own |

## Config hook

There's no dedicated config section for this chain. Capacity math reads `sprint.capacity_metric` and `sprint.cadence_weeks` (see `config/defaults.json`). Everything else in this file is edited directly.

## Adapting this file

Edit this file directly to lock in a rubric, spill threshold, or ticket-creation behavior your team has actually agreed to. For capacity metric and sprint cadence, use `sprint.capacity_metric` and `sprint.cadence_weeks` in `jstack.config.json` instead.

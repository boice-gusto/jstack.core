# Chain: Sprint close

> **Maintainer:** Scrum master, EM, or PM.

This file is injected verbatim into prompts. It contains no invented velocity numbers or
demo links — treat any org-specific value not present in config or the conversation as
unknown, and use `[no data]` rather than filling in a plausible-looking placeholder.

**Flow:** `jstack:routines-sprint-close` → `jstack:reports-team-report` → `jstack:notion-sprint`

## Steps

1. **Sprint close** — calculate velocity, spill count + reasons, carry-forward items. Trigger retro hook if configured.
2. **Team report** — generate the weekly team report using sprint close data. Apply tone from `prompts/tones/executive.md` if audience is leadership, `prompts/tones/internal.md` if team-only. Include risks and asks.
3. **Notion sprint update** — update the Notion sprint page with final status, velocity, and link to team report.

## Handoff rules

- Do not fabricate demo links or velocity numbers. Use `[no data]` for missing metrics.
- If retro hook is configured, suggest scheduling the retro as the final step.
- The Notion update happens last so it reflects the final, reviewed data.

## Defaults and overrides

| Setting | Default | Configured via |
|---------|---------|------------------|
| Velocity metric | Story points completed | `sprint.capacity_metric` (default `"story_points"`) |
| Report audience | Team + EM | `skill_defaults.reports.default_audience` (default `"team"`) |
| Report destination | Notion | `notion_defaults.post_targets.sprint` (parent-page key, default `"private_sprints"`) |
| Retro trigger | Automatic for every sprint | Runs when `"retro"` is in `sprint.ceremonies` (default: yes) |
| Sprint duration | 2 weeks | `sprint.cadence_weeks` (default `2`) |

## Config hook

```json
{
  "routines": {
    "sprint_close": {
      "enabled": false,
      "cron": "",
      "chain": ["sprint", "reports", "announcements"]
    }
  }
}
```

`routines.sprint_close` is declared in `config/defaults.json` and matches the defaults shown; set `enabled: true` and a `cron` to run this chain on a schedule instead of on demand. The per-setting keys in the table above (`sprint.*`, `skill_defaults.reports.default_audience`, `notion_defaults.post_targets.sprint`) are also declared there.

## Adapting this file

Edit this file directly to change step order or add a step. Set `sprint.capacity_metric`, `sprint.cadence_weeks`, `skill_defaults.reports.default_audience`, `notion_defaults.post_targets.sprint`, and `routines.sprint_close` in `jstack.config.json` for the values this file deliberately doesn't hardcode.

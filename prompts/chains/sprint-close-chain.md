# Chain: Sprint close

> **Owner:** Scrum master, EM, or PM. Edit this to match your actual sprint close workflow — metrics source, report audience, and where records live.

**Flow:** `jstack:routines-sprint-close` → `jstack:reports-team-report` → `jstack:notion-sprint`

## Steps

1. **Sprint close** — calculate velocity, spill count + reasons, carry-forward items. Trigger retro hook if configured.
2. **Team report** — generate the weekly team report using sprint close data. Apply tone from `prompts/tones/executive.md` if audience is leadership, `prompts/tones/internal.md` if team-only. Include risks and asks.
3. **Notion sprint update** — update the Notion sprint page with final status, velocity, and link to team report.

## Handoff rules

- Do not fabricate demo links or velocity numbers. Use `[no data]` for missing metrics.
- If retro hook is configured, suggest scheduling the retro as the final step.
- The Notion update happens last so it reflects the final, reviewed data.

## Your customizations

<!-- [CUSTOMIZE] Adapt these to your team -->

| Setting | Default | Your value |
|---------|---------|------------|
| Velocity metric | Story points completed | <!-- Points? Tickets? T-shirt sizes? --> |
| Report audience | Team + EM | <!-- Who reads the sprint report? --> |
| Report destination | Notion | <!-- Notion? Confluence? Google Docs? Slack post? --> |
| Retro trigger | Automatic for every sprint | <!-- Every sprint? Only on spill? Manual? --> |
| Sprint duration | 2 weeks | <!-- 1 week? 2 weeks? Monthly? --> |

## Config hook

```json
{
  "chains": {
    "sprint_close": {
      "velocity_metric": "story_points",
      "report_audience": ["team", "EM"],
      "report_destination": "notion",
      "retro_trigger": "every_sprint",
      "sprint_duration_weeks": 2
    }
  }
}
```

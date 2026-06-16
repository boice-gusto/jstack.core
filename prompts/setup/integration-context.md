# Integration context (runtime template)

> **Owner:** Engineering lead or DevOps. This file documents which integrations jstack expects and how skills should behave when one is missing.

## Expected config shape

```json
{
  "integrations": {
    "slack": { "team_id": "T0...", "channels": { "eng": "#eng", "incidents": "#sev" } },
    "jira": { "base_url": "https://yourorg.atlassian.net", "project_key": "PLAT" },
    "notion": { "workspace_id": "..." },
    "github": { "org": "yourorg", "repos": ["api", "frontend", "infra"] }
  },
  "mcp_servers": {
    "slack": { "enabled": true },
    "jira": { "enabled": true },
    "notion": { "enabled": true },
    "github": { "enabled": true }
  }
}
```

## How skills handle missing integrations

| Situation | Skill behavior |
|-----------|---------------|
| Integration key exists + MCP enabled | Use it silently |
| Integration key exists + MCP disabled | Warn user, suggest `jstack doctor` |
| Integration key missing entirely | Name the missing integration, point to `jstack setup`, do not fabricate data |
| MCP server unreachable at runtime | Retry once, then degrade gracefully with `[integration unavailable]` in output |

## Adding a new integration

1. Add the integration config to `jstack.config.json` under `integrations`.
2. If it requires an MCP server, add an entry under `mcp_servers`.
3. Run `jstack doctor` to verify connectivity.
4. Update this file with the new integration's expected shape.

See `skills/_core/references/integration-guide.md` for full implementation guidance.

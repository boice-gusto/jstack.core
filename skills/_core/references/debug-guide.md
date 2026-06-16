# Debug guide

## Enabling debug mode

Set `debug.enabled: true` in `jstack.config.json`:

```json
{
  "debug": {
    "enabled": true,
    "verbose": false
  }
}
```

## Log format

When debug is enabled, prefix log lines:

```
[JSTACK:DEBUG:<skill-name>] <message>
```

Example: `[JSTACK:DEBUG:jira-create] Resolved project key PROJ from config`

## What to log

- Config resolution: which keys were read, which defaults were used.
- Integration calls: which MCP tool or API was called, response status (not the full payload).
- Chain handoffs: from-skill, to-skill, payload summary.
- Assumptions: any `[assumption]` labels and what they defaulted to.

## What to never log

- Secrets, tokens, API keys, or OAuth credentials.
- Full MCP request/response payloads (too large, may contain PII).
- User PII beyond what is necessary for the operation.
- Raw Jira/Notion/Slack message bodies (summarize instead).

## Verbose mode

When `debug.verbose` is also true, include timing information and intermediate state. This is useful for diagnosing slow chains or MCP timeouts.

## Using with `jstack doctor`

`jstack doctor` runs integration health checks and reports status per integration. Combine with debug logs to diagnose failures:

1. Run `jstack doctor` to identify which integration is unhealthy.
2. Enable debug, re-run the failing skill.
3. Check logs for the specific call that failed and the error code.

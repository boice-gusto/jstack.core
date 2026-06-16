# MCP integration (task intake)

Task intake uses MCP for Jira, Confluence, Slack, and optionally Notion. **Server identifiers are defined in the host agent’s MCP config** (e.g. Cursor `.mcp.json` / Claude Desktop config), not in this skill.

## Typical integrations

| Area        | Purpose                          | Example tool names (vary by server implementation) |
| ----------- | -------------------------------- | ------------------------------------------------ |
| Atlassian   | Jira issues, Confluence pages   | `createJiraIssue`, `searchJiraIssuesUsingJql`, `searchConfluenceUsingCql` |
| Slack       | Announcements, channel discovery | Often prefixed e.g. `slack_send_message`, `slack_search_channels` |
| Notion      | Pages / databases                | Varies by MCP package |

Always read the tool schema for your registered server before calling. Use the MCP filesystem tool descriptors under the host project’s `mcps/` folder when available.

## Optional `config.json` map

You may add a top-level `mcp` object documenting **logical role → server id** for operators (the skill does not parse it for auth):

```json
"mcp": {
  "atlassian": "user-atlassian-example",
  "slack": "user-slack-example",
  "notion": "user-notion-example"
}
```

Authentication and tokens are handled entirely by the MCP runtime, not by task intake `config.json`.

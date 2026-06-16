<p align="center">
  <img src="../assets/logo-placeholder.png" alt="jstack" width="240" height="240" />
</p>

# jstack MCP mock fixture

Stdio server: **`server.ts`**. Scenarios live under **`scenarios/<id>/scenario.json`**.

## Defaults

- **`JSTACK_MCP_SCENARIO`** — scenario id (directory name). Omit or empty → **`default`**.
- **`JSTACK_MCP_FIXTURE_ROOT`** — usually `<plugin-root>/mcp-mock` (set by `jstack mcp add jstack-mock`).

## `default` scenario: integration stubs

These tool names are **representative** — upstream MCP packages often use different names. Use this bundle to exercise hosts and evals offline; align skill prompts or add a **custom scenario** that mirrors your exact provider’s tool names.

| Prefix / domain | Stub tools |
|-----------------|------------|
| Slack | `slack_read_stub`, `jstack_stub_slack_channels_list`, `jstack_stub_slack_chat_post_message` |
| Jira | `jstack_stub_jira_search_issues`, `jstack_stub_jira_get_issue` |
| Datadog | `jstack_stub_datadog_logs_query`, `jstack_stub_datadog_metric_query` |
| DX (GetDX) | `jstack_stub_dx_snapshot` |
| Google Drive | `jstack_stub_gdrive_list_files` |
| Google Calendar | `jstack_stub_gcal_events_list` |
| Google Docs | `jstack_stub_gdocs_get_document` |
| Google Sheets | `jstack_stub_gsheets_get_values` |
| Glean | `jstack_stub_glean_search` |
| Notion | `jstack_stub_notion_search` |
| GitHub | `jstack_stub_github_search_issues` |
| Debug | `echo` (reflects arguments; no canned row in `responses`) |

CLI presets for real servers (not mocks) are listed in **`cli/src/lib/mcp-templates.ts`** (`github`, `notion`, `glean`, `gdrive`, …).

## Authoring

See **`skills/_core/references/mcp-mock-testing.md`**. Prefer **`responses`** as plain strings or **`{ "text": "..." }`**; the server wraps them as MCP text content.

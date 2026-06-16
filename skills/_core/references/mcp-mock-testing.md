# Mock MCP testing (`debug.mock_mcp`)

Use this path when you need **deterministic MCP tool responses** for local development, CI smoke tests, or semantic evals — without calling live Slack, Jira, or other integrations.

## When to use

- **Smoke tests**: Verify Claude CLI (or another host) loads `.mcp.json` and can call tools end-to-end with canned JSON.
- **Eval iteration**: Align tool return shapes with graded scenarios (`evals/`) by setting **`JSTACK_MCP_SCENARIO`** or **`debug.mock_mcp_scenario`** in `jstack.config.json`.
- **Offline work**: No API keys for a given integration yet; still exercise skills that invoke MCP tools.

## Configuration

- **`debug.enabled`** — Verbose traces / logging hooks (canonical boolean; separate from mock MCP).
- **`debug.mock_mcp`** — Default **`false`**. When **`true`**, operators expect the mock server to be registered in **`.mcp.json`**; **`jstack doctor`** warns if wiring or scenario files are wrong.
- **`debug.mock_mcp_scenario`** — Optional string; selects **`mcp-mock/scenarios/<id>/scenario.json`**. Resolution order: if **`jstack-mock`** in **`.mcp.json`** sets **`env.JSTACK_MCP_FIXTURE_ROOT`**, that directory is used (so a project in **`/tmp/...`** still finds bundled scenarios); otherwise the path is under the **plugin root** Claude/Cursor resolves (same folder as **`mcp-mock/`**). Empty scenario id uses **`default`**.

Register the fixture server:

```bash
jstack mcp add jstack-mock
```

That merges a **`jstack-mock`** entry pointing at **`bun run <plugin>/mcp-mock/server.ts`** with **`JSTACK_MCP_FIXTURE_ROOT`** and **`JSTACK_MCP_SCENARIO`** set from config.

## Environment overrides

| Variable | Purpose |
|----------|---------|
| **`JSTACK_MCP_SCENARIO`** | Scenario id (directory name under `mcp-mock/scenarios/`). Overrides empty config when set in the shell; eval subprocess also receives this when **`JSTACK_MCP_SCENARIO`** or **`debug.mock_mcp_scenario`** is set. |
| **`JSTACK_MCP_FIXTURE_ROOT`** | Normally the plugin’s **`mcp-mock`** directory (written by **`jstack mcp add jstack-mock`**). **`jstack doctor`** reads this from **`.mcp.json`** so mock scenario checks work when the CLI’s plugin root is the **project cwd** (e.g. a scratch folder) rather than **`jstack.core`**. |

## Scenario file shape

See **`mcp-mock/scenarios/default/scenario.json`** (bundled stubs for Slack, Jira, Datadog, DX, Google Workspace surfaces, Glean, Notion, GitHub — names are **representative**; real MCP servers may differ).

Full stub inventory: **`mcp-mock/README.md`**.

- **`responses`**: easiest for debugging is **plain text** — either a JSON **string** value per tool name, or **`{ "text": "..." }`**. The server wraps that as MCP **`content: [{ type: "text", text }]`** so you do not hand-author nested MCP JSON.
- **`{ "result": { ... } }`** remains supported when you need **`isError`**, multiple content parts, or non-text chunks.
- **`tools`**: each entry needs **`name`** (and usually **`description`**). **`inputSchema`** helps hosts show arguments; omitting it is OK — the mock defaults to **`{ type: "object", properties: {} }`**. Keeping a small schema per tool is still useful so Claude picks plausible arguments in traces.

## Ethics and production safety

- **`debug.mock_mcp` must not** ship in production team configs as a silent default — it is for **explicit test/dev** setups.
- Skills such as **`recon`** forbid inventing API data when integrations are missing; **mock MCP is an explicit exception** only when **`debug.mock_mcp`** is **`true`** and the host uses the fixture server. Do not pretend mock output is live data.

## CI / prove-e2e

Set **`JSTACK_MOCK_MCP=1`** when running **`bun run prove`** so the script enables **`debug.mock_mcp`**, runs **`jstack mcp add jstack-mock`**, then **`doctor`** — wiring smoke without live MCP credentials.

## Related

- Host MCP discovery: **`integration-guide.md`** § MCP tools.
- JSON schema: **`config-schema.md`** (`debug` block).

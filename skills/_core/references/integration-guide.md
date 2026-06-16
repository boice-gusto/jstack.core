# Integrations

## Where integration config lives

Org-specific values live in `jstack.config.json` (team-visible file must stay free of personal secrets — see `repo-and-privacy.md`). Common top-level blocks:

- **`integrations`** — Slack, Jira, GitHub, Notion, etc.
- **`mcp_servers`** — which MCP integrations are enabled
- **`team_context`** — optional directory of team-owned markdown slices (channels, Jira scope, PagerDuty, observability, GitHub, escalation). See `templates/config/team-context/README.md` and copy `*.md.example` stubs.
- **`org_context`** — optional org-wide slices (org structure, ethics, engineering handbook, HR-safe public guidance, coaching, self-review / critical-review rubrics) under `local.base_path` + `local.files`, plus optional **`notion_pages`** and **`google_drive_folders`** ids and **`mcp_labels`** for which MCP servers supply docs vs people lookups. Contract: `skills/_core/references/org-context.md`. **Starter files:** `templates/config/org-context/` (README + `*.md.example` + merge example JSON).
- **`levels_and_expectations`** — `markdown_path` and/or `canonical_url` to IC/EM ladder text maintained by your org (not shipped in base jstack). Example template: `templates/config/levels-expectations.example.md`.
- **`kickoff_workflows`** — executable morning (or other) step lists. Point `morning.path` at a YAML/JSON file; see `templates/config/kickoff/morning.example.yaml`.

Illustrative `integrations` + `mcp_servers` shape:

```json
{
  "integrations": {
    "slack": { "team_id": "T...", "channels": { "eng": "C..." } },
    "jira": { "base_url": "https://org.atlassian.net", "project_key": "PROJ" },
    "notion": { "workspace_id": "..." },
    "github": { "org": "myorg", "repos": ["api", "web"] }
  },
  "mcp_servers": {
    "slack": { "enabled": true },
    "jira": { "enabled": true }
  }
}
```

**Never hardcode** team ids, channel ids, project keys, or base URLs. Always read from config.

### `integrations.share_html` (hosted HTML / “share-some-html” style)

For **`jstack:share-html-publish`**: publish, download, or save HTML snapshots using an MCP `update` / `get` tool or JSON-RPC `curl` to your org’s endpoint. Keys (see `config/defaults.json`):

- **`output_dir`** — where previews, publishes, and downloads are written (default `/tmp`).
- **`mcp_url`**, **`public_base_url`**, **`default_slug`**, **`default_owner_key`** — host-specific; keep `owner_key` out of logs.
- **`access_password`** — optional; merged into publish arguments when the server supports a password gate. Use **`password_argument_name`** if the API expects `access_code` or `access_password` instead of `password`.

Register the MCP server in the host (e.g. `share-some-html`) per your deployment; never commit tokens.

### Notion gallery templates vs jstack JSON

Notion **standup**, **team report**, **performance**, and **1:1** skills use `templates/notion/*.json` and optional **`notion_defaults.template_pages`** (duplicate-from-gallery flow). See [`skills/notion/references/notion-template-strategy.md`](../../notion/references/notion-template-strategy.md).

### Notion private vault + team hub + `post_targets`

For **manager-private** vs **team-visible** destinations and dynamic routing (transcripts, projects, sprints, standups, etc.), use **`notion_defaults.parent_pages`**, **`notion_defaults.post_targets`**, **`notion_defaults.private_vault`**, and **`notion_defaults.team_notion`**. Full key list and setup contract: [`skills/notion/references/notion-vault-and-routing.md`](../../notion/references/notion-vault-and-routing.md). Format checklist for pages and evals: [`skills/notion/references/notion-page-format-rules.md`](../../notion/references/notion-page-format-rules.md).

### Team roster and canonical group

Optional **`team.members`** (with per-person **Notion** 1:1 parent / template ids) and **`team.canonical_group`** (Slack user group vs Google Group + **`mode`**). Discovery and wizard contract: [`skills/team/references/team-canonical-identity.md`](../../team/references/team-canonical-identity.md).

### 1:1 prepare / after from transcripts (Lattice or Notion)

For **paired** pre- and post-meeting notes sourced from **`one_on_one_cycle.transcript_sources`** (or paste), use **`jstack-meetings-one-on-one-transcript`**. If **`lattice.enabled`** and the host exposes matching **MCP** tools, prefer Lattice for 1:1 artifacts; otherwise write under **`notion_defaults.parent_pages.pe_index`** (private PE / management) or **`one_on_ones`**. Always apply **`one_on_one_cycle.ai_attribution`** to AI-drafted bodies. See [`skills/meetings/one-on-one-transcript/references/config-shape.md`](../../meetings/one-on-one-transcript/references/config-shape.md). **Lattice:** jstack does not ship an MCP server — see [`skills/meetings/one-on-one-transcript/references/lattice-mcp-placeholder.md`](../../meetings/one-on-one-transcript/references/lattice-mcp-placeholder.md).

### `team_context` shape (illustrative)

```json
{
  "team_context": {
    "base_path": "./config/jstack-team",
    "files": {
      "slack_channels": "slack-channels.md",
      "jira_incidents": "jira-and-incidents.md",
      "pagerduty": "pagerduty.md",
      "observability": "observability.md",
      "github": "github.md",
      "escalation": "escalation.md"
    }
  }
}
```

### `kickoff_workflows` shape (illustrative)

```json
{
  "kickoff_workflows": {
    "morning": { "path": "./config/kickoff/morning.yaml" },
    "state_path": ".jstack/state/last-kickoff.json"
  }
}
```

Use **`morning-kickoff`** skill to interpret the file; narrative-only descriptions may still live under `prompts/chains/` (see `chaining-guide.md`).

## MCP tools

Prefer MCP tools when the host exposes them (check `mcp_servers` in config). MCP tools provide direct API access without requiring the user to paste data.

For deterministic tests with a local stdio MCP fixture instead of live integrations, see [`mcp-mock-testing.md`](./mcp-mock-testing.md) (`debug.mock_mcp`, `jstack mcp add jstack-mock`).

If an MCP tool is available but the call fails:
1. Report a one-line error (e.g. "Slack MCP: 403 — token may be expired").
2. State whether the error is **retryable** (rate limit, timeout) or **permanent** (auth, not found).
3. Keep raw JSON payloads out of the chat.

### Glean (enterprise search)

- **MCP:** Official [`@gleanwork/mcp-server`](https://www.npmjs.com/package/@gleanwork/mcp-server) — env `GLEAN_INSTANCE` + `GLEAN_API_TOKEN` (user-scoped token with search/chat per your admin).
- **jstack:** Run `jstack mcp add glean` or copy the `glean` block from repo [`.mcp.json.example`](../../../.mcp.json.example).
- **Role:** Company-wide answers (wikis, docs, people). Complements repo-local `knowledge_base` paths — do not assume Glean replaces filesystem search for the current workspace.

### Lattice (1:1 / performance data)

- **MCP:** Lattice does not ship a single universal npm binary. Teams use a **Lattice Talent API** MCP (build from source, internal package, or vendor-hosted URL). Example env pattern: `LATTICE_API_KEY`, optional `LATTICE_REGION` (`us` | `emea`).
- **jstack config:** `one_on_one_cycle.lattice.enabled`, `one_on_one_cycle.lattice.mcp_server_label` should match the server **key** in `.mcp.json` when you want Lattice-first routing for [`jstack-meetings-one-on-one-transcript`](../../meetings/one-on-one-transcript/SKILL.md).
- **Fallback:** If tools are missing or auth fails, use Notion parents from `notion_defaults.parent_pages` per [`lattice-mcp-placeholder.md`](../../meetings/one-on-one-transcript/references/lattice-mcp-placeholder.md).

### Google Workspace (Drive + Calendar)

- **Drive MCP:** [`@modelcontextprotocol/server-gdrive`](https://www.npmjs.com/package/@modelcontextprotocol/server-gdrive) — `jstack mcp add gdrive`. OAuth / `gcp-oauth.keys.json` flow is **per Google Cloud project**; see upstream README. Align folder scope with `integrations.google_drive.transcripts_folder_id` for transcript ingest workflows.
- **Calendar:** `integrations.gcal.primary_calendar_id` in config. Prefer your host’s calendar integration or an org-approved Google Calendar MCP; jstack does not pin one package (OAuth policies differ by company).

### DX — GetDX (optional developer insights)

- **MCP:** [DX MCP Server](https://github.com/get-dx/dx-mcp-server) — local `dx-mcp-server` with `DB_URL` (DX Data Cloud Postgres) and `WEB_API_TOKEN`, or **hosted** `https://ai.getdx.com/mcp` where your client supports HTTP transport (see vendor docs).
- **Role:** Org metrics / catalog queries for PE and engineering health narratives — **optional** tier; keep tokens out of `jstack.config.json`.

### PE / team report JSON

- Structured report context (teams, projects, tone) lives in `pe.*` — see [`docs/PE_AND_TEAM_CONFIG.md`](../../../docs/PE_AND_TEAM_CONFIG.md) and skill [`jstack-pe-report-context`](../../pe/report-context/SKILL.md). Integrations above feed **inputs**; the PE block is **routing + narrative**, not secrets.

### Sprint planning / Jira boards

- **New sprint:** Confirm carryover policy (bulk move incomplete work vs backlog vs split) before MCP transitions — procedure lives in [`sprint/planning`](../../sprint/planning/SKILL.md) with the sprint router [`jstack-sprint`](../../sprint/SKILL.md).
- **Board clone / admin steps** differ between Jira **Cloud** and **Data Center**; read MCP tool schemas (or REST metadata) instead of hardcoding transition ids — see Jira skills and future field-metadata docs.

## CLI helpers (workflows + transcripts)

- **`jstack workflow`** — CRUD on `config/workflows/*.json` (`list --json`, `show`, `create`, `run --yes`, `delete --force`, `export`, `import`, `edit`). Execution is still **stub** until Playwright is wired; skills **`workflows/workflow-wizard`** and **`workflows/execute`** document the flow.
- **`jstack transcripts status|ingest`** — prints config snapshot and points to **`jstack-transcripts-ingest`** / **`jstack-ingest-all`** (MCP runs in the agent).

## Health checking

- **`jstack doctor`** — validates all configured integrations are reachable. Point users here when a required integration is missing or broken.
- **`jstack mcp refresh`** — restarts MCP servers. Useful after config changes or token rotation.
- **`jstack setup`** — first-time onboarding wizard for adding integrations.

## When an integration is missing

If a skill needs an integration that is not configured:
1. State what is missing: "Slack integration not found in config."
2. Point to the fix: "`jstack setup` or add the `slack` block to `jstack.config.json`."
3. **Do not continue with invented data.** Offer to proceed with user-pasted content as a fallback.

## Secrets

- Never print tokens, API keys, or OAuth secrets in chat or markdown.
- If the user pastes a secret, tell them to move it to their env/secret store and **rotate** the exposed credential.
- Integration auth is handled by the host environment, not by jstack config files.

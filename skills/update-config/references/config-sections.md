# jstack.config.json sections

| Section | Purpose | Templates |
|---------|---------|-----------|
| `team` | name, timezone, business_hours, `members` (roster: `id`, nested `metadata` / `github` / `email` / `jira` / `notion` 1:1+hubs / `slack` / `misc`), `canonical_group` (mode + Slack/Google group) | `skills/team/references/team-canonical-identity.md` |
| `knowledge_base` | roots, doc URLs, GitHub scope, retrieval prompts, optional GBrain merge | `skills/knowledge/search/references/config-shape.md` |
| `sprint` | cadence, ceremonies, capacity metric, velocity window | `templates/config/sprint-templates.md` |
| `approval_chains` | per-action approval sequences with role-based routing | `_core/references/approval-chains.md` |
| `integrations` | jira, slack, notion, github, gcal, sheets | — |
| `mcp_servers` | discovered MCP registry (label, tools, status) | — |
| `gbrain` | team + personal URLs, trust, **`provenance`** (config_label, entry_fields, Slack resolution) | `skills/knowledge/references/gbrain-entry-provenance.md` |
| `session` | default_gbrain_target, metrics_on_end | — |
| `jira_rules` | enforcement for transitions, required fields | — |
| `notion_defaults` | `parent_pages`, `post_targets`, `private_vault`, `team_notion`, `template_pages`, `database_ids`, tags | `skills/notion/references/notion-vault-and-routing.md`, `notion-page-format-rules.md` |
| `one_on_one_cycle` | Transcript paths, Lattice vs Notion, AI attribution for 1:1 prep/after | `skills/meetings/one-on-one-transcript/references/config-shape.md` |
| `policies` | review, announcements, incidents, sdlc | `templates/config/incident-templates.md`, `templates/config/sdlc-templates.md` |
| `tones` | runtime overrides for `prompts/tones/*.md` | — |
| `personas` | runtime overrides for `prompts/personas/*.md` | — |
| `channels` | routing rules | — |
| `cross_plugins` | gstack + superpowers toggles | — |
| `routines` | cron chains (standup, digest, sprint close, health) | — |
| `workflows` | default output format, artifacts dir | — |
| `telemetry` | opt-in metrics | — |
| `evals` | gates and budgets | — |
| `skill_defaults` | per-skill parameter overrides | — |
| `debug` | logging | — |

Full schema reference: `_core/references/config-schema.md`

Predefined full-config templates: `templates/config/{startup,scaleup,enterprise}.json`

Personal overlay example (not committed to team repo): `config/personal.example.json`

Use `jstack:update-config` with dot paths, e.g. `sprint.cadence_weeks`.

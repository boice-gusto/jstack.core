# GBrain entry provenance (jstack)

When jstack (or a host) **writes** to GBrain, attach a small **envelope** so entries are filterable and auditable: who, which session, which config, which skill.

GBrain’s product may store this as frontmatter, JSON sidecar, or custom fields—match what your GBrain version supports. This doc is the **recommended** shape for interoperability across skills.

## Envelope (required vs optional)

| Field | Type | Source | Required |
|-------|------|--------|----------|
| `jstack_session_id` | string | Set at `jstack:session-init` (or host-injected). Opaque, no PII in the value itself. | If session exists |
| `gbrain_target` | `"team"` \| `"personal"` | `session` / user choice at init | **Yes** |
| `config_label` | string | `gbrain.provenance.config_label` in `jstack.config.json`, or basename of the active config file (e.g. `work`, `home`) | If multiple configs in use |
| `slack_user_id` | string | `integrations.slack` or `team.members[]` when `resolve_slack_from_team_members` is true | If Slack is the org’s primary identity |
| `slack_handle` | string | e.g. `@sara` — human-readable; may duplicate `display_name` | **Recommended** for team reads |
| `display_name` | string | `team.members[].metadata.name` (or legacy flat `name`) or OS user display name (optional) | Optional |
| `source_skill` | string | e.g. `jstack:session-end`, `jstack:remember` | **Yes** for automated writes |
| `team_name` | string | `team.name` from config (denormalized) | If team target |
| `written_at` | string (ISO 8601) | Client time at write | **Yes** |
| `host` | string | e.g. `claude-code`, `cursor` (if host provides) | Optional |

**Privacy:** do not put API tokens, full workspace paths, or customer data in the envelope. Session ids should be **opaque** (UUID-style), not the raw transcript id if that leaks content.

## Example: JSON envelope prepended to body

```json
{
  "jstack_provenance": {
    "jstack_session_id": "7f1c9b2a-4e33-4d1b-8c0a-0e1f2a3b4c5d",
    "gbrain_target": "team",
    "config_label": "acme-prod",
    "slack_user_id": "U0123456",
    "slack_handle": "@alex",
    "source_skill": "jstack:session-end",
    "team_name": "Platform",
    "written_at": "2026-04-27T14:32:00Z",
    "host": "claude-code"
  }
}
```

## Example: markdown frontmatter (if GBrain stores notes as MD)

```yaml
---
jstack_provenance:
  jstack_session_id: "7f1c9b2a-4e33-4d1b-8c0a-0e1f2a3b4c5d"
  gbrain_target: team
  config_label: acme-prod
  slack_handle: "@alex"
  source_skill: jstack:remember
  written_at: "2026-04-27T14:32:00Z"
---
Your note content starts here.
```

## Resolving `slack_handle` / `slack_user_id`

1. If `gbrain.provenance.resolve_slack_from_team_members` is `true` and the host has a way to know **current user**, match the first `team.members` row (by **`slack.user_id`**, **`slack.handle`**, **`metadata.name`**, or **`github.login`**; for legacy configs also try flat `slack_handle`, `name`, `github` string).
2. Else use `gbrain.provenance.identity` overrides (see `config/defaults.json`).
3. If unknown, set `slack_handle: "[unknown]"` and still write `jstack_session_id` + `source_skill`.

## Querying

Filters you may want in GBrain or downstream:

- `gbrain_target=personal` → never show in team report jobs.
- `config_label=work` vs `home` → separate laptops or clients.
- `jstack_session_id` → all entries from one coding session.
- `source_skill=jstack:session-end` → session summaries only.

## See also

- `gbrain-patterns.md` — team vs personal URL and session
- `skills/_core/references/repo-and-privacy.md` — do not commit personal `gbrain` URLs to a team repo

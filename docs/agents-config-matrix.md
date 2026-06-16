# Agents: rewrite priority and configuration matrix

This document supports **research-backed agent specialization**: primary namespaces from [`config/schema.json`](../config/schema.json), defaults in [`config/defaults.json`](../config/defaults.json), and evidence chains in [`skills/_core/references/config-schema.md`](../skills/_core/references/config-schema.md), [`skills/workflow-builder/references/domain-map.md`](../skills/workflow-builder/references/domain-map.md), and `prompts/`.

## Rewrite priority (blast radius)

Higher rank = broader orchestration or higher-privilege automation touched first when deepening agent specs.

| Rank | Agent | Rationale |
|------|-------|-----------|
| 1 | `sprint-lead` | Sprint ceremonies; `routines.sprint_close.chain`; sprint/report/notion surfaces |
| 2 | `jira-coordinator` | Ticket/board truth for execution across integrations |
| 3 | `workflows-coach` | Workflow authoring (YAML, recorder) affects automation footprint |
| 4 | `workflow-executor` | Browser/Playwright runs; production-adjacent risk |
| 5 | `routine-runner` | Scheduled chains (`routines.*`, `config/schedules/`) |
| 6 | `recon-scanner` | Cross-integration sweep; gate for prioritize/jira |
| 7 | `chain-orchestrator` | Multi-hop handoffs; shapes how other agents compose |
| 8 | `staff-engineer` | Review + health + silo risk; engineering bar |
| 9 | `product-pm` | Intake, prioritize, project narrative |
| 10 | `design-lead` | Figma handoff + counsel review |
| 11 | `analytics-lead` | Metrics + reports; leadership-facing numbers |
| 12 | `executive-brief` | Exec tone + recon/reports/incidents |
| 13 | `review-counsel` | Multi-persona governance (`policies.review`) |
| 14 | `report-generator` | Template-backed artifacts (`skill_defaults.reports`, `reports.branding`) |
| 15 | `backend-specialist` | Scoped technical lens |
| 16 | `frontend-specialist` | Scoped UI/browser lens |
| 17 | `knowledge-curator` | KB intake/process; gbrain destinations |
| 18 | `authoring-helper` | Maintainer workflows (skill-creator, workflow-builder) |

## Configuration matrix

| Agent | Primary config namespaces | Key prompts / policies | When unset / degradation |
|-------|---------------------------|-------------------------|---------------------------|
| `sprint-lead` | `sprint.*`, `policies.*`, `notion_defaults`, `team.members`, `routines.sprint_close`, `standup` | `prompts/setup/preamble.md`; sprint chains in `prompts/chains/` | No sprint id → ask once or label `[assumption]` from config; Jira writes only after approval; missing Notion parents → markdown-only |
| `jira-coordinator` | `jira_rules`, `projects`, `team.members`, MCP Jira metadata | `prompts/personas/` if intake-shaped | Missing project key / transitions → read `skills/jira/references/field-metadata.md`; no invented IDs |
| `workflows-coach` | `workflows.*`, `kickoff_workflows`, `cross_plugins` | `prompts/setup/preamble.md` | `workflows.artifacts_dir` empty → repo-relative paths; integrations down → `integration-guide` + doctor |
| `workflow-executor` | `workflows.*`, `debug.trace_*` | — | Flow missing → list CLI workflows; no prod writes without confirm |
| `routine-runner` | `routines.*`, `weekly_digest`, `standup`, `schedules/` | Chain narratives under `prompts/chains/` | Routine disabled → explain enable path; integration fail → report fail line + doctor |
| `recon-scanner` | `channels.routing`, Slack/Jira slices in config, `team.*` | — | Empty integration → say what is disconnected; read-only default |
| `chain-orchestrator` | `skills`, `skill_defaults`, `debug.trace_chains` | `prompts/chains/*`, `chaining-guide.md` | Missing skill → suggest closest `jstack:*` by description; stop chain on auth failure |
| `staff-engineer` | `engineering_health`, `silo_scan`, `code_review`, `levels_and_expectations`, `policies.review` | `prompts/personas/` for counsel | Health unavailable → `[no data]`; levels path empty → generic IC framing |
| `product-pm` | `pe.*`, `impact.*`, `prioritize` skill defaults, `team_context` | `prompts/tones/`, `prompts/personas/` | No IDs → `[assumption]`; conflicting stakeholders → tensions table only |
| `design-lead` | `reports.branding` (when publishing), team Notion/Figma context | `prompts/personas/*`, `html-spa-design` refs | No Figma MCP → screenshot + `[blocked]`; tokens unknown → flag gaps |
| `analytics-lead` | `engineering_health`, `weekly_digest.window_days`, `skill_defaults.reports`, `metrics` paths | `prompts/tones/` | No BI integration → paste-only; strip IC names when `skill_defaults.reports.redact_ic_names` |
| `executive-brief` | `policies.incidents`, `skill_defaults.reports`, recon scopes | `prompts/tones/executive` | No facts → ask for paste or approve recon; tone missing → `[tone: default]` |
| `review-counsel` | `policies.review` (required_approvals, counsel_roles) | `prompts/personas/*`, review policies | No artifact → stop; roles use defaults from schema when personas unset |
| `report-generator` | `skill_defaults.reports`, `reports.branding`, `team_context`, `notion_defaults` | `prompts/tones/*`, template shells under `templates/reports/` | Template missing → list closest file; metrics invented → forbidden |
| `backend-specialist` | `policies.incidents`, `policies.sdlc`, `engineering_health` | Incident chains | Logs missing → state gap; Jira after approval only |
| `frontend-specialist` | `workflows.*`, `cross_plugins` | — | No browser tools → manual repro steps |
| `knowledge-curator` | `gbrain` slices, `notion_defaults`, `ingest_all`, team vs personal | Knowledge eval policies | No KB target → structured markdown only; merge writes → ask first per skill |
| `authoring-helper` | Full schema (`update-config` validated), `evals.*`, `skills`, `routines`, `workflows` | `skill-conventions`, `domain-map` | Never paste secrets; generator SKIP set warnings |

## Verification

After editing any `agents/*.md`, run from `jstack.core`:

```bash
bun run agents-check
```

See [`docs/MARKDOWN_SYSTEM.md`](MARKDOWN_SYSTEM.md) for citation patterns and audit expectations.

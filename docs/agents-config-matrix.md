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
| 11 | `analytics-lead` | Metric definition + measurement validity; certifies figures before they're published |
| 12 | `executive-brief` | Exec tone + recon/reports/incidents |
| 13 | `review-counsel` | Multi-persona governance (`policies.review`) |
| 14 | `report-generator` | Template-backed artifacts (`skill_defaults.reports`, `reports.branding`) |
| 15 | `backend-specialist` | Scoped technical lens |
| 16 | `frontend-specialist` | Scoped UI/browser lens |
| 17 | `knowledge-curator` | KB intake/process; gbrain destinations |
| 18 | `authoring-helper` | Maintainer workflows (skill-creator, workflow-builder) |
| 19 | `architect` | System decomposition; writes team-visible ADRs behind a `policies.*` approval gate |
| 20 | `brainstorm-facilitator` | Divergent-then-convergent option generation; can land an ADR |
| 21 | `qa-engineer` | Test-strategy and flake judgment; advisory, no writes |
| 22 | `technical-writer` | Reference/doc authoring; code is the source of truth, advisory only |
| 23 | `security-auditor` | OWASP-lens vulnerability review; advisory, no writes |
| 24 | `compliance-officer` | Data-handling/regulatory-risk lens; advisory, no writes, no legal advice |

Ranks 19–24 are appended rather than interleaved, so the existing priority order above is unchanged.

## Configuration matrix

| Agent | Primary config namespaces | Key prompts / policies | When unset / degradation |
|-------|---------------------------|-------------------------|---------------------------|
| `sprint-lead` | `sprint.*`, `projects`, `policies.*`, `routines.sprint_close`, `standup`, `notion_defaults` | `prompts/setup/preamble.md`; sprint chains in `prompts/chains/` | No sprint id → ask once or label `[assumption]` from config; Jira writes only after approval; missing Notion parents → markdown-only |
| `jira-coordinator` | `jira_rules`, `projects`, `team.members`, `policies.*` (approval gates), MCP Jira metadata | `prompts/personas/` if intake-shaped | Missing project key / transitions → read `skills/jira/references/field-metadata.md`; no invented IDs |
| `workflows-coach` | `workflows.*`, `routines.*`, `kickoff_workflows`, `cross_plugins`, `team_context` | `prompts/setup/preamble.md` | `workflows.artifacts_dir` empty → repo-relative paths; integrations down → `integration-guide` + doctor |
| `workflow-executor` | `workflows.*`, `debug.trace_*` | — | Flow missing → list CLI workflows; no prod writes without confirm |
| `routine-runner` | `routines.*`, `weekly_digest`, `standup`, `schedules/`, `kickoff_workflows` | Chain narratives under `prompts/chains/` | Routine disabled → explain enable path; integration fail → report fail line + doctor |
| `recon-scanner` | `channels.routing`, Slack/Jira slices in config, `team.*`, `policies.*` (redaction) | — | Empty integration → say what is disconnected; read-only default |
| `chain-orchestrator` | `skills`, `skill_defaults`, `debug.trace_chains`, `kickoff_workflows` | `prompts/chains/*`, `chaining-guide.md` | Missing skill → suggest closest `jstack:*` by description; stop chain on auth failure |
| `staff-engineer` | `engineering_health`, `silo_scan`, `code_review`, `levels_and_expectations`, `team.members`, `policies.*` (jira-write approval gates) | `prompts/personas/` for counsel | Health unavailable → `[no data]`; levels path empty → generic IC framing |
| `product-pm` | `projects`, `sprint.*`, `policies.*`, `skill_defaults.prioritize.*`, `notion_defaults` | `prompts/tones/`, `prompts/personas/` | No IDs → `[assumption]`; conflicting stakeholders → tensions table only |
| `design-lead` | `notion_defaults` / integration slices (when publishing), `team_context` | `prompts/personas/*`, `html-spa-design` refs | No Figma MCP → screenshot + `[blocked]`; tokens unknown → flag gaps |
| `analytics-lead` | `team.*` / `metrics` slices (audience filters + rollup scope), `policies.*` (IC-name redaction), org day boundary / timezone | `prompts/tones/` on handoff to `report-generator` only | No integration → paste-only with unverified cells marked `[no data]`, never blank or zero; scope unset → ask aggregate vs. per-team once; day boundary unset → state `[assumption: UTC day boundary]` |
| `executive-brief` | `policies.*` (redaction), `channels.routing` | `prompts/tones/executive`, `prompts/personas/ceo` | No facts → ask for paste or approve recon; tone missing → `[tone: default]` |
| `review-counsel` | `policies.review` (required_approvals, counsel_roles) | `prompts/personas/*`, review policies | No artifact → stop; roles use defaults from schema when personas unset |
| `report-generator` | `team.*`, `sprint.*`, `reports.branding`, `skill_defaults.reports`, `notion_defaults` | `prompts/tones/*`, template shells under `templates/reports/` | Template missing → list closest file; metrics invented → forbidden |
| `backend-specialist` | `policies.incidents`, `policies.sdlc`, `engineering_health`, `projects`, `jira_rules` | Incident chains | Logs missing → state gap; Jira after approval only |
| `frontend-specialist` | `workflows.*`, `debug.trace_*`, `cross_plugins` | — | No browser tools → manual repro steps |
| `knowledge-curator` | `knowledge_base`, `gbrain.*` (incl. `provenance.identity`, `team.members`), `ingest_all`, `notion.*` | Knowledge eval policies | No KB target → structured markdown only; merge writes → ask first per skill |
| `authoring-helper` | `SKIP` set (`apply_detailed_skills.py`), `apply_detailed_skills_data.py` generator dicts, `jstack.config.json`, `JSTACK_EVAL_COVERAGE_MIN` | `skill-conventions`, `domain-map` | Never paste secrets; generator SKIP set warnings |
| `architect` | `knowledge_base.roots` / `.globs`, `team.members`, `engineering_health`, `policies.*` | — | No prior ADRs → say `[no prior ADRs found]` rather than inventing precedent; ownership unknown → ask once or label `[assumption]`; health unset → code/config evidence only, no invented metrics; approval gate unset → ADR stays `Status: Proposed` until confirmed |
| `brainstorm-facilitator` | `skill_defaults.prioritize.*`, `policies.*`, `notion_defaults` | — | No configured rubric → default to a 1–5 scale stated explicitly; approver unset → note the assumption and proceed; no Notion target → local markdown ADR only |
| `qa-engineer` | `skill_defaults.qa` (test runner / framework hints), `policies.*` (release gate), `engineering_health` | `prompts/personas/qa` | Stack hints unset → infer from the repo's existing test files or ask once, never assume a stack; gate policy unset → describe the evidence a gate needs without inventing an approver; health unset → pasted CI output only |
| `technical-writer` | The code itself (primary source), `jstack.config.json` / `config/schema.json` for documented behavior | `prompts/tones/` — default register is `internal`, not `executive`/`formal` | Code and an existing doc disagree → code wins; config field unset → state that it's unset and the default behavior, never invent a value; requested tone applies but must not soften reference-mode precision |
| `security-auditor` | `policies.*` (approval gates), `engineering_health` (optional corroboration), dependency manifests/lockfiles | — | Approver unset → describe the evidence a sign-off needs without inventing one; health unset → rely on code/config evidence only; manifest missing/unreachable → `[no data]`, never assert a CVE from memory |
| `compliance-officer` | `policies.*` (approval gates before treating a finding as resolved), `data_class` (skill/agent frontmatter convention), `knowledge_base` / prior ADRs | — | Approver unset → describe the evidence a sign-off needs; `data_class` unset → infer classification from the code/schema and label it `[assumption]`, never trust an unverified label alone |

## Verification

After editing any `agents/*.md`, run from `jstack.core`:

```bash
bun run agents-check
```

See [`docs/MARKDOWN_SYSTEM.md`](MARKDOWN_SYSTEM.md) for citation patterns and audit expectations.

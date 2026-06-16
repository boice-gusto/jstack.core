---
name: jstack-task-intake
description: "Config-driven task intake wizard — from idea to ticket, sizing, prioritization, and optional announcements."
category: workflows
gbrain_destination: team
data_class: internal
when_to_use: "User asks to intake work, run a task wizard, size/prioritize, or announce a project."
---

<!-- Chain Contract -->
<!-- end Chain Contract -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md
# Task Intake Wizard

Config-driven workflow for taking a task from idea to actionable ticket with optional stakeholder notification. Each phase is modular — load only what the user needs per run.

## Quick Start

1. Read `${CLAUDE_PLUGIN_ROOT}/skills/task-intake/config.json` to load active steps and defaults.
2. Present the wizard intro and use `AskQuestion` to let the user toggle optional steps.
3. Execute enabled steps in order, collecting outputs into a running context object.
4. Produce a final summary linking all artifacts created.

## Configuration

`${CLAUDE_PLUGIN_ROOT}/skills/task-intake/config.json` controls step enablement, MCP preferences, sizing scale, priority factors, and template paths. All authentication is handled by MCP servers — the config stores behavioral preferences only. Any blank preference triggers an interactive prompt during the relevant step.

## Wizard Phases

### Phase 0: Setup

Read config. Present enabled steps. Use `AskQuestion` to let the user toggle optional steps on/off. Required steps (marked in config) cannot be skipped.

### Phase 1: Intake

Read `${CLAUDE_PLUGIN_ROOT}/skills/task-intake/steps/01-intake.md` for the full process. Capture the core request: what, who, why, acceptance criteria, constraints.

### Phase 2: Context

Read `${CLAUDE_PLUGIN_ROOT}/skills/task-intake/steps/02-context.md`. Search codebase for related files. Query Jira for related tickets, Confluence for docs, Slack for recent discussions.

### Phase 3: Research (optional)

Read `${CLAUDE_PLUGIN_ROOT}/skills/task-intake/steps/03-research.md`. Trace execution paths, review prior art, assess risk and coupling. Suggested when context reveals significant complexity.

### Phase 4: Ticket (optional)

Read `${CLAUDE_PLUGIN_ROOT}/skills/task-intake/steps/04-ticket.md`. Assemble a structured Jira ticket from accumulated data. Load template from `${CLAUDE_PLUGIN_ROOT}/skills/task-intake/templates/ticket.md`. Always present to user for review before creating via MCP.

### Phase 5: Sizing (optional)

Read `${CLAUDE_PLUGIN_ROOT}/skills/task-intake/steps/05-sizing.md`. Estimate effort using the configured scale (t-shirt, fibonacci, or custom). Factor in research complexity and dependencies.

### Phase 6: Prioritize (optional)

Read `${CLAUDE_PLUGIN_ROOT}/skills/task-intake/steps/06-prioritize.md`. Assess priority using weighted factors from config. Compute score and map to priority level.

### Phase 7: Schedule (optional)

Read `${CLAUDE_PLUGIN_ROOT}/skills/task-intake/steps/07-schedule.md`. Assign to sprint or milestone based on priority and sizing. Check for blocking dependencies.

### Phase 8: Announce (optional)

Read `${CLAUDE_PLUGIN_ROOT}/skills/task-intake/steps/08-announce.md`. Post to Slack channels using the announcement template. Supports draft mode for review before sending.

### Phase 9: Summary

Produce a final summary of all artifacts: intake summary, ticket links, size estimate, priority level, schedule assignment, announcement links, and open questions.

## MCP Integration

All MCP servers handle authentication automatically. The wizard calls tools directly — no credentials in config.

| Integration | Purpose |
|---|---|
| Atlassian (Jira/Confluence) — MCP server id from host `.mcp.json` | Tickets, wiki/docs |
| Slack — MCP server id from host `.mcp.json` | Announcements, channel discovery |
| Notion — MCP server id from host `.mcp.json` | Pages, databases |

Optional: document logical labels in `skills/task-intake/config.json` → `mcp` so operators know which server id maps to each integration.

For detailed MCP tool names, discovery patterns, and parameter resolution, read `references/mcp-integration.md`.

## References

Consult these for detailed procedures:

- **`references/mcp-integration.md`** — MCP tool names, discovery patterns, parameter resolution
- **`references/extending.md`** — Adding new steps, custom templates, per-team config overrides

## Step Files

Each phase has a detailed step file with process, questions, and output schema:

- `${CLAUDE_PLUGIN_ROOT}/skills/task-intake/steps/01-intake.md` through `${CLAUDE_PLUGIN_ROOT}/skills/task-intake/steps/08-announce.md`
- `${CLAUDE_PLUGIN_ROOT}/skills/task-intake/steps/README.md` — Extension guide

## Templates

- `${CLAUDE_PLUGIN_ROOT}/skills/task-intake/templates/ticket.md` — Jira ticket template (Handlebars-style)
- `${CLAUDE_PLUGIN_ROOT}/skills/task-intake/templates/announcement.md` — Slack announcement template
- `${CLAUDE_PLUGIN_ROOT}/skills/task-intake/templates/summary.md` — Final summary template

## Examples

See `examples/` for worked scenarios:

- `examples/full-intake-run.md` — Complete wizard run from idea to announcement

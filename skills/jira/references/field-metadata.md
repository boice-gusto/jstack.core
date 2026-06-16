# Jira field metadata (create / transition)

Use this before **blind** `createIssue` or `transitionIssue` calls when custom fields, workflows, or required screens differ by project.

## Cloud vs Data Center

- **Cloud:** REST `/rest/api/3/issue/createmeta`, `/rest/api/3/issue/{key}/transitions`, and field metadata endpoints evolve — read your MCP tool’s description or the live OpenAPI docs for your site version.
- **Data Center:** Same concepts; base path and feature flags may differ — never assume Cloud-only JSON shapes.

## Procedure

1. **Resolve project + issue type** from `integrations.jira` and user intent.
2. **Create metadata:** list required fields and allowed values (components, custom select options). If the MCP exposes `getFields` / `createmeta` / similar, call those first.
3. **Transitions:** fetch allowed transitions for the issue; map user intent (“Done”, “In Progress”) to **transition id** from the response, not from memory.
4. **Skills:** [`jstack-jira-create`](../create/SKILL.md), [`jstack-jira-transition`](../transition/SKILL.md) — extend procedures to reference this doc when tools return metadata.

## Config

- `jira_rules.required_fields`, `jira_rules.transitions` in `jstack.config.json` are **hints** only; the API is authoritative when MCP tools are available.

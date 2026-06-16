# Example: scaffolding a full plugin

## User request

> Scaffold a new plugin called "integration-health" for monitoring integration jobs and data pipelines.

## What the skill creates

### Directory structure

```
plugins/integration-health/
├── .claude-plugin/
│   └── plugin.json
├── .cursor-plugin/
│   └── plugin.json
├── skills/
├── agents/
├── hooks/
│   ├── hooks.json
│   └── scripts/
└── CHANGELOG.md
```

### plugins/integration-health/.cursor-plugin/plugin.json

Same JSON object as `.claude-plugin/plugin.json` (name, description, version, author, repository, license, keywords).

### plugins/integration-health/.claude-plugin/plugin.json

```json
{
  "name": "integration-health",
  "description": "Operational checklists and diagnostics for integration jobs, failures, and bulk API usage.",
  "version": "0.1.0",
  "author": {
    "name": "<Your Team>",
    "email": "<team@example.com>"
  },
  "repository": "https://github.com/your-org/your-repo",
  "license": "UNLICENSED"
}
```

### plugins/integration-health/hooks/hooks.json

```json
{
  "description": "Integration health guardrails",
  "hooks": {}
}
```

### plugins/integration-health/CHANGELOG.md

```markdown
# Changelog

All notable changes to this plugin will be documented in this file.

## [0.1.0] - 2026-04-01

### Added
- Initial plugin scaffold
```

### Added to .claude-plugin/marketplace.json (and mirrored in `.cursor-plugin/marketplace.json`)

```json
{
  "name": "integration-health",
  "source": "./plugins/integration-health",
  "description": "Operational checklists and diagnostics for integration jobs, failures, and bulk API usage.",
  "version": "0.1.0",
  "author": {
    "name": "<Your Team>",
    "email": "<team@example.com>"
  },
  "category": "integrations",
  "tags": ["integrations", "bulk-api", "monitoring"]
}
```

Then from repo root: `make validate` and `make sync-marketplace`. See `references/marketplace-registry-checklist.md`.

## Post-scaffold output

```
## Scaffold complete: plugin "integration-health"

Files created:
- plugins/integration-health/.claude-plugin/plugin.json
- plugins/integration-health/.cursor-plugin/plugin.json
- plugins/integration-health/hooks/hooks.json
- plugins/integration-health/CHANGELOG.md
- .claude-plugin/marketplace.json (updated)
- .cursor-plugin/marketplace.json (updated)

Next steps:
- [ ] Add skills to plugins/integration-health/skills/
- [ ] Add agents to plugins/integration-health/agents/ (if needed)
- [ ] Add hooks to plugins/integration-health/hooks/ (if needed)
- [ ] Run `make validate` from the repo root
- [ ] Run `make sync-marketplace` after marketplace changes
- [ ] Test with `claude --plugin-dir ./plugins/integration-health`
```

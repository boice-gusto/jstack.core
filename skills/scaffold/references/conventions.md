# Scaffold Conventions

Rules to follow when creating any component in this marketplace.

## Naming

- **Plugin names**: kebab-case, no spaces, no uppercase (e.g., `my-plugin`)
- **Skill names**: kebab-case, matching the directory name (e.g., `soql-bulk-patterns`)
- **Agent names**: kebab-case (e.g., `integration-orchestrator`)
- **Hook script names**: kebab-case with `.sh` extension (e.g., `pre-edit-soql-warning.sh`)
- **Frontmatter `name`**: must match the directory name exactly

## Frontmatter Requirements

### Skills (SKILL.md)

Required fields:
- `name`: matches directory name
- `description`: specific enough for Claude to trigger on the right queries. Include domain terms, example queries, and related concepts. Err on the side of too specific rather than too vague.

Optional but recommended:
- `argument-hint`: shows the user what to pass (e.g., `[topic or question]`)
- `allowed-tools`: comma-separated list of tools the skill needs (e.g., `Read, Grep, Glob, Shell, WebFetch`)

### Agents (AGENT.md)

Required fields:
- `name`: matches directory name
- `description`: states the trigger clearly (e.g., "multi-ticket feature work", "epic-level planning")

## Style Rules

These apply to all content in the repo:

- **No hardcoded usernames** -- use `{username}` placeholders or `$USER`
- **No absolute paths** -- use `~/` or relative paths; use `${CLAUDE_SKILL_DIR}` or `${CLAUDE_PLUGIN_ROOT}` in scripts
- **No personal preferences** -- skills should work for any engineer
- **Keep skills generic** -- make JIRA projects and similar references configurable
- **Comments explain why, not what** -- no narrative comments describing the development process

## Directory Structure

Every skill should have:
```
skills/<name>/
├── SKILL.md              # Required
├── references/           # Recommended: domain docs
└── examples/             # Recommended: worked scenarios
```

Every agent should have:
```
agents/<name>/
├── AGENT.md              # Required
├── references/           # Recommended: domain docs
├── sub-agents/           # Optional: delegated agents
└── examples/             # Recommended: worked scenarios
```

## Marketplace Registration

After creating a new plugin, always add it to `.claude-plugin/marketplace.json` in the `plugins` array. The `name` must match the plugin's `plugin.json` name exactly. The `source` must be `./plugins/<plugin-name>`.

Mirror the same catalog in **`.cursor-plugin/marketplace.json`** whenever `.claude-plugin/marketplace.json` changes (add/remove plugin or edit listing fields). See **`references/marketplace-registry-checklist.md`** for the full checklist and Make targets.

## Validation

Run **`make validate`** from the repo root after scaffolding (or `claude plugin validate .`). After any change to `.claude-plugin/marketplace.json`, run **`make sync-marketplace`** so `index.html` stays in sync. Fix any errors before committing.

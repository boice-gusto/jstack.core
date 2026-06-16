---
name: jstack-scaffold
description: "Scaffold a new skill or plugin using org conventions and checklists."
category: workflows
gbrain_destination: team
data_class: internal
when_to_use: "User wants to create a new skill pack or plugin structure."
---

<!-- Chain Contract -->
<!-- end Chain Contract -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md
# Scaffold

Generate boilerplate for new components in this marketplace repo. Follow these instructions exactly.

**Catalog hygiene:** Any time `.claude-plugin/marketplace.json` changes (new plugin, removed plugin, or edits to listing fields), mirror updates in **`.cursor-plugin/marketplace.json`**, then run **`make validate`** and **`make sync-marketplace`**. Full matrices and PR checks: read **`references/marketplace-registry-checklist.md`** first when touching the catalog.

## Step 1: Determine what to scaffold

Determine from the user request (or infer from context) what to create:

| Command | What it creates |
|---------|----------------|
| `scaffold plugin <name>` | Full plugin under `plugins/<name>/` |
| `scaffold skill <name> --plugin <plugin>` | Skill under `plugins/<plugin>/skills/<name>/` |
| `scaffold agent <name> --plugin <plugin>` | Agent under `plugins/<plugin>/agents/<name>/` |
| `scaffold hook <name> --plugin <plugin>` | Hook script + hooks.json entry in `plugins/<plugin>/` |

If `--plugin` is omitted for skill/agent/hook, ask which plugin to add it to. List the plugins under `plugins/` to help them choose.

## Step 2: Gather required info

For each component type, ask for:

**Plugin**: name, one-line description, category, tags
**Skill**: name, description (be specific -- this is how Claude decides when to trigger), allowed-tools, argument-hint
**Agent**: name, description (state the trigger clearly), what it orchestrates
**Hook**: name, event (PreToolUse or SessionStart), matcher pattern, what it checks, timeout

## Step 3: Create the files

Use the templates from `references/templates.md`. Read that file first.

### Scaffolding a full plugin

1. Create `plugins/<name>/.claude-plugin/plugin.json` using the plugin.json template, and **`plugins/<name>/.cursor-plugin/plugin.json`** with the same core fields (see `references/templates.md`)
2. Create `plugins/<name>/skills/` directory (empty, ready for skills)
3. Create `plugins/<name>/agents/` directory (empty, ready for agents)
4. Create `plugins/<name>/hooks/hooks.json` using the hooks.json template (empty hooks)
5. Create `plugins/<name>/hooks/scripts/` directory
6. Create `plugins/<name>/CHANGELOG.md` using the CHANGELOG template
7. Register the plugin in `.claude-plugin/marketplace.json` by adding an entry to the `plugins` array (match shape of existing entries: `version`, `author`, `category`, `tags`; add `mcpServers` only when defining real MCP server configs per Claude marketplace schema)
8. Mirror the same catalog in `.cursor-plugin/marketplace.json` (simplest: keep both files’ `plugins` arrays identical; align top-level `name`, `owner`, `metadata` with the canonical file)
9. From repo root: run **`make validate`**, then **`make sync-marketplace`**

### Scaffolding a skill

1. Create `plugins/<plugin>/skills/<name>/SKILL.md` using the SKILL.md template
2. Create `plugins/<plugin>/skills/<name>/references/` with a placeholder `.gitkeep`
3. Create `plugins/<plugin>/skills/<name>/examples/` with a placeholder `.gitkeep`
4. Remind the user to add reference docs and at least one worked example

### Scaffolding an agent

1. Create `plugins/<plugin>/agents/<name>/AGENT.md` using the AGENT.md template
2. Create `plugins/<plugin>/agents/<name>/references/` with a placeholder `.gitkeep`
3. Create `plugins/<plugin>/agents/<name>/sub-agents/` with a placeholder `.gitkeep`
4. Create `plugins/<plugin>/agents/<name>/examples/` with a placeholder `.gitkeep`
5. Remind the user to define phases, input format, and output format

### Scaffolding a hook

1. Read the existing `plugins/<plugin>/hooks/hooks.json`
2. Add a new entry under the appropriate event (PreToolUse or SessionStart)
3. Create `plugins/<plugin>/hooks/scripts/<name>.sh` using the hook script template
4. Make the script executable: `chmod +x plugins/<plugin>/hooks/scripts/<name>.sh`

## Step 4: Post-scaffold checklist

After creating files, print this checklist for the user. If the work included **only** a new skill/agent/hook on an existing plugin, omit marketplace rows; still run **`make validate`**.

```
## Scaffold complete: <type> "<name>"

Files created:
- [ list each file created ]

Next steps:
- [ ] Fill in the SKILL.md / AGENT.md body with real instructions
- [ ] Add reference docs to references/
- [ ] Add at least one worked example to examples/
- [ ] If you added or changed marketplace listings: update BOTH `.claude-plugin/marketplace.json` AND `.cursor-plugin/marketplace.json`
- [ ] If you added a plugin: both `.claude-plugin/plugin.json` and `.cursor-plugin/plugin.json` exist with matching `name` and `version`
- [ ] Run `make validate` from the repo root
- [ ] If marketplace.json changed: run `make sync-marketplace` (and before PR: `make check-marketplace-embed`)
- [ ] Test with `claude --plugin-dir ./plugins/<plugin>` (adjust plugin path)
```

Registry reference: `references/marketplace-registry-checklist.md`

## Conventions

Read `references/conventions.md` for naming rules and style requirements. Always follow them.

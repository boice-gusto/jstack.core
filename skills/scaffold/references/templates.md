# Scaffold Templates

Use these templates verbatim when scaffolding. Replace all `<placeholders>` with actual values from the user.

## plugin.json

```json
{
  "name": "<plugin-name>",
  "description": "<one-line description of what the plugin does>",
  "version": "0.1.0",
  "author": {
    "name": "<author-name>",
    "email": "<author-email>"
  },
  "repository": "<https://github.com/org/repo>",
  "license": "UNLICENSED",
  "keywords": ["<tag1>", "<tag2>"]
}
```

## `.cursor-plugin/plugin.json` (Cursor)

Create **`plugins/<plugin-name>/.cursor-plugin/plugin.json`** with the **same** `name`, `description`, `version`, `author`, `repository`, `license`, and `keywords` as `.claude-plugin/plugin.json`. Cursor merges this manifest with the marketplace entry; see [Cursor plugins reference](https://cursor.com/docs/reference/plugins).

## SKILL.md

```markdown
---
name: <skill-name>
description: "This skill should be used when the user asks to <specific trigger phrases>. Include concrete trigger words, domain terms, and example queries. The more specific, the better Claude is at knowing when to activate it."
# sdlc_phases — pick one or more from: plan, design, build, test, review, deploy, operate.
# Drives the phase badge/filter in the Claude Toolbox skill dashboard. Author-declared overrides AI classification.
sdlc_phases:
  - <phase>
version: 0.1.0
argument-hint: "[<what the user passes>]"
allowed-tools: <comma-separated list, e.g. Read, Grep, Glob, Shell, WebFetch>
---

# <Skill Title>

<Brief paragraph explaining what this skill does and when to use it.>

## Instructions

<Step-by-step instructions for Claude to follow when this skill is activated.>

## References

Read the reference docs in `references/` for domain-specific data:

- `references/<topic>.md` -- <what it covers>

## Examples

See `examples/` for worked scenarios:

- `examples/<scenario>.md` -- <what it demonstrates>
```

## AGENT.md

```markdown
---
name: <agent-name>
description: "<description stating what triggers this agent. Be specific: e.g., 'multi-ticket feature work', 'epic-level planning'.>"
---

# <Agent Title>

Orchestration agent that <what this agent does>. Coordinates <what it coordinates>.

## Input Format

The user provides:

- <what the agent expects as input>

## Phases

### Phase 1: <Name>

<What happens in this phase>

### Phase 2: <Name>

<What happens in this phase>

### Phase 3: <Name>

<What happens in this phase>

## Output Format

When complete, the agent produces:

- <what the agent outputs>

## References

- `references/<topic>.md` -- <what it covers>

## Sub-Agents

- `sub-agents/<name>.md` -- <what it does>

## Examples

- `examples/<scenario>.md` -- <what it demonstrates>
```

## hooks.json (empty starter)

```json
{
  "description": "<one-line description of what these hooks do>",
  "hooks": {}
}
```

## hooks.json entry (PreToolUse)

Add this object to the appropriate event array:

```json
{
  "matcher": "<tool pattern, e.g. Edit|Write|MultiEdit or Bash>",
  "hooks": [
    {
      "type": "command",
      "command": "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/<script-name>.sh",
      "timeout": 5
    }
  ]
}
```

## hooks.json entry (SessionStart)

```json
{
  "matcher": "",
  "hooks": [
    {
      "type": "command",
      "command": "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/<script-name>.sh",
      "timeout": 10
    }
  ]
}
```

## Hook script

```bash
#!/usr/bin/env bash
# <description of what this hook does>
# Event: <PreToolUse|SessionStart>
# Matcher: <matcher pattern>

set -euo pipefail

# TODO: Implement hook logic here
# Exit 0 for success (allow), non-zero to warn/block

exit 0
```

## CHANGELOG.md

```markdown
# Changelog

All notable changes to this plugin will be documented in this file.

## [0.1.0] - <YYYY-MM-DD>

### Added
- Initial plugin scaffold
```

## marketplace.json entry

Add this object to the `plugins` array in **`.claude-plugin/marketplace.json`**. **Duplicate the same entry** into **`.cursor-plugin/marketplace.json`** so both files stay aligned. Add **`mcpServers`** only if the plugin declares MCP servers in the marketplace entry using the official command-based shape; otherwise omit it.

Then run from repo root: **`make validate`** and **`make sync-marketplace`**. See **`references/marketplace-registry-checklist.md`**.

```json
{
  "name": "<plugin-name>",
  "source": "./plugins/<plugin-name>",
  "description": "<one-line description>",
  "version": "0.1.0",
  "author": {
    "name": "<author-name>",
    "email": "<author-email>"
  },
  "category": "<category>",
  "tags": ["<tag1>", "<tag2>"]
}
```

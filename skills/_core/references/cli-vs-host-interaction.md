# CLI vs agent host interaction

Skills often combine three surfaces:

| Surface | Mechanism | When to use |
|--------|-----------|-------------|
| **Agent hosts** (Claude Code, Cursor, Codex, …) | **AskUserQuestion** or equivalent structured pickers — see [`ask-user-question-patterns.md`](./ask-user-question-patterns.md) | Discrete branches (which skill next?, confirm destructive steps, template pick). Maps cleanly from Markdown numbered lists in [`config-wizard.md`](./config-wizard.md). |
| **`jstack` CLI** | **Clack** (`@clack/prompts`) for TTY; plain stdout + `--json` / `--help-json` in CI or pipes — see `jstack.core/cli/README.md` | Scripted installs, repo-local automation, parity when users run terminals outside chat (`setup`, `skills browse`, `workflow create`, `mcp add` preset picker). |
| **Free-form chat** | Natural language clarifiers — [`question-patterns.md`](./question-patterns.md) | Open-ended intent (“what does success look like?”); avoid pretending chat supports constrained keyboards. |

## User goal mapping

| User goal | Host (AskUserQuestion) | `jstack` CLI | Chat-only |
|-----------|------------------------|--------------|-----------|
| Pick which MCP preset to add | Options list per preset with descriptions | `jstack mcp add` (interactive picker) or `jstack mcp add notion` | Explain presets if MCP UI unavailable |
| Find a skill path in-repo | Not ideal — paths vary | `jstack skills browse`, `jstack skills pick`, `jstack skills index --json` | Paste outputs |
| Create workflow with start URL | N/A | `jstack workflow create <id>` prompts URL when TTY | Describe workflow YAML manually |
| Run workflow safely | N/A | `jstack workflow run <id>` preview + confirm without `--yes` | Warn before destructive browser automation |

## Author checklist

1. If instructions assume **`jstack` CLI**, cite the **subcommand that matches** (e.g. guided `skills browse`, not only generic “run jstack”).
2. If instructions assume **structured picks**, align option labels with **AskUserQuestion** conventions (`label` + short `description`).
3. Never imply **TTY-specific UX** (Clack spinners) in hosts that only expose AskUserQuestion; phrase as “confirm” / “pick one”.
4. For CI/scripts, always mention **`--json`** where the CLI exposes it — identical payloads skip prompts.

## Superpowers-style parity

Hosts may expose menus (“verification”) unrelated to jstack; for **jstack-owned flows**, prefer documenting **`--help-json`** + **`CLI_COMMANDS`** (`cli-registry.ts`) so agents resolve commands without guessing flags.

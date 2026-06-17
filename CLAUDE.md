# CLAUDE.md — jstack.core

Conventions and constraints for working in this repo. Loaded into every Claude Code session — keep rules concrete (every rule should name a tool, path, command, or file).

## Stack

- **Language:** TypeScript (strict). Bun runtime.
- **Package manager:** `bun` (lockfile: `bun.lock`). Use `bun install`, `bun add`, `bun remove`. Do not use `npm`, `yarn`, or `pnpm`.
- **Test runner:** `bun:test`. Tests live next to source as `*.test.ts` (e.g. `cli/src/lib/foo.test.ts`).
- **Module system:** ESM. Imports of local TypeScript files use the `.js` suffix even though the source is `.ts` (e.g. `import { x } from "./foo.js"`). Match this in new files.
- **Config schema:** Zod. JSON schema at `config/schema.json`; defaults at `config/defaults.json`.
- **CLI framework:** `commander`. CLI entry: `cli/src/index.ts`.

## Commands you'll use most

| What | Command |
|------|---------|
| Run all CLI/lib tests | `bun test cli/src` |
| Run one test file | `bun test cli/src/lib/foo.test.ts` |
| Run one test by name | `bun test cli/src/lib/foo.test.ts -t "fixture name"` |
| Typecheck (CLI) | `bun run typecheck:cli` |
| Validate config schema + defaults | `bun run validate-config` |
| Validate skill chain refs | `bun run validate-chains` |
| Validate router-skill matrix | `bun run eval:routers` |
| Full CI pipeline | `bun run check` |
| Quick eval pass | `bun run eval:quick` |

`bun run check` is what CI runs. Land changes through it before committing if your edit touches code, config, or skill chaining.

## Skill authoring

- Hand-maintained skills must be added to the `SKIP` set in `scripts/apply_detailed_skills.py`. Otherwise running `python3 scripts/apply_detailed_skills.py` regenerates the body and overwrites your work.
- The current SKIP entries are: `advice`, `adr`, `recon`, `skill-creator` (+ `skill-creator/improve-claude-md`), `computer-use/cua`, `workflow-builder`, `knowledge/search`, `shortcuts/ceo-brainstorm`, `shortcuts/executive-research-brief`. Anything else is auto-regenerated.
- Every `SKILL.md` needs three frontmatter keys: `name` (kebab-case, prefixed `jstack-`), `description` (one to three sentences naming when to invoke and when not to), `category` (folder name). See `skills/_core/references/skill-conventions.md`.
- Every `SKILL.md` should `!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md` before its procedure, so config defaults are loaded.
- Write skills in directives style — see `skills/skill-creator/references/anthropic-alignment.md` for the rubric.
- Full frontmatter field reference with jstack conventions: `skills/_core/references/skill-frontmatter-guide.md`.

### Key frontmatter rules

- **`disable-model-invocation: true`** — Required on all write/operational skills (jira creates/updates, notion writes, announcements, sprint-close, workflow-execute). Prevents Claude from auto-triggering actions that change external state.
- **`context: fork` + `agent: Explore`** — Add to pure read/research skills (recon, knowledge/search, research/*, engineering/health). Runs the skill in an isolated subagent, protecting the main context window.
- **`effort:`** — Set on every skill. Tier: `low` for routines/automation, `high` for analysis/advice/review, `max` for recon and deep research. See `skills/_core/references/skill-frontmatter-guide.md` for the full table.
- **`disallowed-tools: AskUserQuestion`** — Add to all routines and scheduled skills. Prevents blocking on interactive prompts in automated runs.
- **`argument-hint:`** — Add whenever the skill takes a well-defined positional input (ticket ID, sprint ID, person name).
- **`allowed-tools:`** — Declare MCP tools for Jira/Slack/Notion write skills to suppress per-call approval prompts.

### AskUserQuestion with `preview:`

When a skill has a meaningful intake choice that determines the output shape (tone, template, ADR kind, report format), use the **AskUserQuestion** tool with `preview:` on each option. The `preview:` field renders markdown side-by-side so users can see what they're choosing before committing.

Pattern: instruct Claude in the body to call AskUserQuestion at intake time. See `skills/_core/references/ask-user-question-patterns.md` for full examples. Tier 1 skills with wizards:
- `announcements` — tone selector (Executive / Internal / Formal)
- `adr` — kind selector (Engineering / Design / Team / Org)
- `advice` — format selector (Decision brief / Stakeholder script / Principle tradeoff)

To add a wizard to a skill: replace the prose "ask once if unclear" pattern in the Intake/Step 1 section with an explicit AskUserQuestion call block.

### Skill context budget

`settings.json` sets `skillListingBudgetFraction: 0.02` (2% of model context). At 134 skills this is intentionally generous. If `/doctor` reports overflow: (1) trim `description` + `when_to_use` to ≤1,536 chars each; (2) add rarely-used background skills to `skillOverrides: "name-only"` in `.claude/settings.local.json`.

## Config-first

- Org-specific values (sprint length, approvers, channels, integration ids) live in `jstack.config.json`. Never hardcode them in skill prose or TS source.
- Schema lives in `config/schema.json` + `config/defaults.json` — keep them in sync. `bun run validate-config` enforces the parity.
- Skill defaults you want users to override go under `skill_defaults.<skill-id>`.

## Editing rules

- **Never** run `python3 scripts/apply_detailed_skills.py` unless you intend to regenerate every non-`SKIP` skill body. The script overwrites; review the diff before committing.
- **Never** commit changes to `jstack.config.json` test fixtures from CI runs. Treat fixture configs as read-only.
- For multi-file refactors, prefer many small commits over one large one. Pre-commit hooks aren't reinstrumented for skipping; if a hook fails, fix the cause and create a new commit.
- Skill chain references (`<!-- chains-to: jstack:foo -->`) must point to a live skill in the catalog. `bun run validate-chains` will fail otherwise.

## Don't

- Don't use `console.log` for CLI output that should be machine-parseable. Use `cliUi.ts` helpers (`renderTable`, `renderJson`, etc.) so `--output=json` continues to work.
- Don't ship a new skill without an entry in `skill-catalog.json` — the file is regenerated by `bun run scripts/build-skill-catalog.mjs` (run after every skill add).
- Don't introduce a new third-party dependency without checking whether a sibling util in `cli/src/lib/` already covers it.
- Don't auto-commit. Wait for the user to ask for a commit or PR.
- Don't push to `main` directly. All work goes through a PR.

## Dogfood

When you've made a substantive change to a skill or to the CLI surface that affects users, run `bun run cli/src/index.ts claude-md scan --output prose` from a real project to see whether this very file (`CLAUDE.md`) needs updating. If you can name a recurring correction or stale rule, propose an edit before merging.

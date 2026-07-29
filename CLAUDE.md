# CLAUDE.md — jstack.core

# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

Conventions and constraints for working in this repo. Loaded into every Claude Code session — keep rules concrete (every rule should name a tool, path, command, or file).

## Stack

- **Language:** TypeScript (strict). Bun runtime.
- **Package manager:** `bun` (lockfile: `bun.lock`). Use `bun install`, `bun add`, `bun remove`. Do not use `npm`, `yarn`, or `pnpm`.
- **Test runner:** `bun:test`. Tests live next to source as `*.test.ts` (e.g. `cli/src/lib/foo.test.ts`).
- **Module system:** ESM. Imports of local TypeScript files use the `.js` suffix even though the source is `.ts` (e.g. `import { x } from "./foo.js"`). Match this in new files.
- **Config schema:** Zod, in `cli/src/types/config.ts` — the single source of truth and the only schema any code enforces. `config/schema.json` is **generated** from it by `bun run schema:generate`; `bun run schema:check` (in `bun run check`) fails on drift. Never hand-edit `config/schema.json`. `config/defaults.json` supplies runtime defaults.
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
- Read the current SKIP set from the source rather than a list here (it has gone stale repeatedly):
  `python3 -c "import sys; sys.path.insert(0,'scripts'); from apply_detailed_skills import SKIP, SKILLS; print(sorted(str(p.relative_to(SKILLS).parent) for p in SKIP))"`
  Everything not in that set is auto-regenerated.
- Every `SKILL.md` needs: `name` (kebab-case, prefixed `jstack-`), `description` (one to three sentences naming when to invoke **and when not to**), `category` (folder name), and `effort`. See `skills/_core/references/skill-conventions.md`.
- `category` is a jstack-internal field — the Claude Code platform ignores it. It drives `skill-catalog.json` and the docs site, so it still has to be right.
- Every `SKILL.md` should `!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md` before its procedure, so config defaults are loaded.
- Write skills in directives style — see `skills/skill-creator/references/anthropic-alignment.md` for the rubric.
- Full frontmatter field reference with jstack conventions: `skills/_core/references/skill-frontmatter-guide.md`.

### Key frontmatter rules

- **`disable-model-invocation: true`** — Required on all write/operational skills (jira creates/updates, notion writes, announcements, sprint-close, workflow-execute). Prevents Claude from auto-triggering actions that change external state.
- **`context: fork` + `agent: Explore`** — Add to pure read/research skills (recon, knowledge/search, research/*, engineering/health). Runs the skill in an isolated subagent, protecting the main context window.
- **`effort:`** — Set on every skill. Tier: `low` for routines/automation, `high` for analysis/advice/review, `max` for recon and deep research. See `skills/_core/references/skill-frontmatter-guide.md` for the full table.
- **`disallowed-tools: AskUserQuestion`** — Add to all routines and scheduled skills. Prevents blocking on interactive prompts in automated runs.
- **`argument-hint:`** — Add whenever the skill takes a well-defined positional input (ticket ID, sprint ID, person name).
- **`allowed-tools:`** — **Not used in jstack.core, by design.** Core is integration-agnostic: no skill here names a concrete `mcp__*` tool (verify: `grep -rn "mcp__" skills --include=SKILL.md` returns nothing). Skills route through `mcp_servers` / `integrations` in `jstack.config.json` so each org can wire its own Jira/Notion/Slack servers. Declaring `allowed-tools` here would hardcode one org's server names into generic skills. This rule belongs in an **org overlay** (e.g. `jstack.gusto`, where 13 skills do name real servers such as `mcp__datadoggusto__*`) — there, declare the tools a skill actually calls to suppress per-call approval prompts.
- **Frontmatter values must be inline scalars.** `read_front_matter` in `scripts/apply_detailed_skills.py` is line-based and keeps only lines containing `:`. A YAML block list is silently dropped — its `- item` lines vanish and the key round-trips empty. Write `allowed-tools: mcp__a__b, mcp__c__d`, never a multi-line list. Keys other than `name`, `description`, `category`, and `when_to_use` survive regeneration.

### AskUserQuestion with `preview:`

When a skill has a meaningful intake choice that determines the output shape (tone, template, ADR kind, report format), use the **AskUserQuestion** tool with `preview:` on each option. The `preview:` field renders markdown side-by-side so users can see what they're choosing before committing.

Pattern: instruct Claude in the body to call AskUserQuestion at intake time. See `skills/_core/references/ask-user-question-patterns.md` for full examples. Tier 1 skills with wizards:
- `announcements` — tone selector (Executive / Internal / Formal)
- `adr` — kind selector (Engineering / Design / Team / Org)
- `advice` — format selector (Decision brief / Stakeholder script / Principle tradeoff)

To add a wizard to a skill: replace the prose "ask once if unclear" pattern in the Intake/Step 1 section with an explicit AskUserQuestion call block.

### Skill context budget

`settings.json` sets `skillListingBudgetFraction: 0.02` (2% of model context) — intentionally generous for a library this size. Get the current count with `find skills -name SKILL.md | wc -l` rather than trusting a number written here. If `/doctor` reports overflow: (1) trim `description` + `when_to_use` to ≤1,536 chars each; (2) add rarely-used background skills to `skillOverrides: "name-only"` in `.claude/settings.local.json`.

## Config-first

- Org-specific values (sprint length, approvers, channels, integration ids) live in `jstack.config.json`. Never hardcode them in skill prose or TS source.
- `bun run validate-config` merges `config/defaults.json` with a project's `jstack.config.json`, **validates both against the Zod schema**, and checks integration keys. Failures print one `path: message` line per issue.
- To change the config contract: edit `cli/src/types/config.ts`, run `bun run schema:generate`, and commit both. No code loads `config/schema.json` — it is the generated human/agent-facing reference, kept honest by the drift gate rather than by discipline.
- All 43 sections are described and every field is `.optional()` inside a `.passthrough()` section, so unknown keys never break an older CLI. **Do not add `.default()`** — defaults live in `config/defaults.json`; a Zod default would be injected by `readConfig` and then persisted by `writeConfig`, silently inflating a user's hand-written config.
- Skill defaults you want users to override go under `skill_defaults.<skill-id>`.

## Editing rules

- **Never** run `python3 scripts/apply_detailed_skills.py` unless you intend to regenerate every non-`SKIP` skill body. The script overwrites; review the diff before committing.
- **Never** commit changes to `jstack.config.json` test fixtures from CI runs. Treat fixture configs as read-only.
- For multi-file refactors, prefer many small commits over one large one. Pre-commit hooks aren't reinstrumented for skipping; if a hook fails, fix the cause and create a new commit.
- Skill chain references (`<!-- chains-to: jstack:foo -->`) must point to a live skill in the catalog. `bun run validate-chains` will fail otherwise.

## Don't

- Don't interleave human-readable prose into `--json`/`--output=json` output. When a command supports a JSON mode, that mode must print only the JSON payload (e.g. `console.log(JSON.stringify(...))`) — no extra log lines on stdout — so it stays machine-parseable. `cli/src/lib/cliUi.ts` only has interactive-prompt helpers (`isInteractive`, `nonInteractiveHint`, `handleCancel`, `exitCancelled`); there is no shared `renderTable`/`renderJson` — don't invent calls to those.
- Don't ship a new skill without an entry in `skill-catalog.json` — the file is regenerated by `bun run docs:generate` (`scripts/generate-docs-data.ts`), or `jstack docs generate` (run after every skill add).
- Don't introduce a new third-party dependency without checking whether a sibling util in `cli/src/lib/` already covers it.
- Don't auto-commit. Wait for the user to ask for a commit or PR.
- Don't push to `main` directly. All work goes through a PR.

## Dogfood

When you've made a substantive change to a skill or to the CLI surface that affects users, run `bun run cli/src/index.ts claude-md scan --output prose` from a real project to see whether this very file (`CLAUDE.md`) needs updating. If you can name a recurring correction or stale rule, propose an edit before merging.

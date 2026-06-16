<p align="center">
  <img src="assets/logo-placeholder.png" alt="jstack" width="240" height="240" />
</p>

# jstack — Team Operations Toolkit

Modular AI agent plugin for team operations: JIRA/Notion/Slack workflows, recon, reports, research, meetings, session lifecycle, self-skills, routines, browser workflows, evals, and opt-in telemetry. Works with **Claude Code**, **Cursor**, and **Codex**.

**Runtime:** Implemented in **TypeScript**; use **Bun** for dependency install and scripts. jstack does **not** use the JVM, Kotlin, or Gradle—the plugin and CLI are not Java stacks.

**Monorepo:** If this tree lives under a parent repo (e.g. `…/jstack/jstack.core`), use **`jstack.core/`** as the plugin root in the commands below (not the parent folder).

## Installation

### Claude Code (terminal)

Use the **plugin root** directory that contains `.claude-plugin/` (in a monorepo, that is `jstack.core/`, not the repo root).

**Install from a local clone**

```bash
git clone https://github.com/your-org/jstack.git
claude plugin marketplace add /absolute/path/to/jstack/jstack.core --scope user
claude plugin install jstack@jstack-local --scope user
```

Replace `/absolute/path/to/jstack` with where you cloned. If you only clone `jstack.core`, point `marketplace add` at that folder.

**Install from GitHub** (no clone; uses the remote marketplace entry for that repo)

```bash
claude plugin marketplace add https://github.com/your-org/jstack
claude plugin install jstack@jstack --scope user
```

Adjust org/repo to match your fork. If the plugin lives in a repo whose root **is** `jstack.core`, use that URL instead.

Restart Claude Code, then confirm:

```bash
claude plugin list
```

You should see `jstack@jstack-local` (local marketplace) or the remote id you installed, with status `enabled`.

### Claude Code (details)

Claude Code uses **convention-based discovery** — it finds skills, hooks, and MCP servers by scanning well-known paths at the plugin root. The `.claude-plugin/plugin.json` is metadata only.

### Cursor

Cursor uses **manifest-driven discovery** — `.cursor-plugin/plugin.json` declares explicit paths to `skills/`, `agents/`, `hooks/`, and `mcpServers`.

**From a local clone:**

```bash
git clone https://github.com/your-org/jstack.git
cursor plugin marketplace add /path/to/repo/jstack.core --scope user
cursor plugin install jstack@jstack-local --scope user
```

**Or via the IDE:** Settings > Plugins > Add Local Plugin, then select the repo root.

Restart Cursor after installing.

### Codex

Codex uses **manifest-driven discovery** — `.codex-plugin/plugin.json` declares the `skills` path and an `interface` block for UI presentation. Each skill has an optional `agents/openai.yaml` for display metadata.

**From a local clone:**

```bash
git clone https://github.com/your-org/jstack.git
codex plugin install /path/to/repo/jstack.core
```

**From GitHub:**

```bash
codex install --plugin https://github.com/your-org/jstack
```

**Alternative (skill-only, no plugin system):** symlink the skills tree into your Codex skills directory:

```bash
ln -s /path/to/repo/jstack.core/skills ~/.codex/skills/jstack
```

## Setup

After installing on any platform, configure jstack for your team.

### Option 1: Interactive CLI wizard

```bash
cd /path/to/repo/jstack.core
bun install --cwd cli
./cli/bin/jstack setup            # legacy wizard (curated prompts)
./cli/bin/jstack setup --schema   # schema-driven wizard (opt-in, recommended)
```

#### `--schema` mode (recommended)

`jstack setup --schema` walks every meaningful config field with the same five actions per question:

- **Default** — accept the layered fall-through (`existing → defaults.json`).
- **Custom** — type your own value (validated by type: url / iana tz / path / boolean / select).
- **Skip** — omit the key entirely (no empty-string artifacts).
- **Example** — show a sample value, re-prompt.
- **Discuss** — print a canned tradeoff explainer (no LLM call), re-prompt.

Each section starts with a gate: walk through, take all defaults, or skip the whole section. Re-running with `--reconfigure` layers in your existing config so unchanged answers preserve your prior values.

Useful flags:

```bash
jstack setup --schema --reconfigure
jstack setup --schema --section "Integrations / JIRA"   # filter to one section
jstack setup --schema --non-interactive                 # accept Defaults everywhere (CI)
```

A `.jstack/setup.lock` file prevents concurrent setup runs (auto-stolen if the holder pid is dead or older than 30 minutes). On validation failure, raw answers land in `.jstack/setup-recovery.json` for recovery; that file is deleted on the next successful write. Cancellation (Ctrl+C) at any prompt exits 130 with no disk writes.

#### Legacy mode

`jstack setup` (no flag) runs the legacy curated wizard with these prompts:
- **Team name** and **timezone**
- **JIRA** project key and base URL (optional)
- **Telemetry** opt-in (anonymous: skill name, tokens, latency only)
- **Debug logging** toggle
- **MCP server** auto-discovery from any existing `.mcp.json`
- **GBrain + local knowledge (optional prompt):** team/personal base URLs, `session.default_gbrain_target`, **team/personal knowledge Git repos** (`knowledge_storage.*.git_remote`) and **local clone paths** (`local_checkout`), **disk fallback root** (default `/tmp/knowledgebase` for `{team|personal}/…/*.md` when no checkout), `knowledge_base.roots`, and `knowledge_base.gbrain.include`. Use `jstack setup --with-gbrain-kb` to always run this block without the extra confirm.
- **Keep CLAUDE.md sharp:** `/jstack:skill-creator/improve-claude-md` — audits the file against your commits and session transcripts and proposes a unified diff. Read-only by default.

This writes `jstack.config.json` at your project root. For **personal-only** GBrain URLs, prefer a private overlay — see [skills/_core/references/config-team-vs-personal.md](skills/_core/references/config-team-vs-personal.md).

### Option 2: Invoke the setup skill

In any agent session, invoke:

```
jstack:setup
```

The agent will walk you through the same configuration interactively.

### Option 3: Manual config

Copy the defaults and edit:

```bash
cp /path/to/repo/jstack.core/config/defaults.json ./jstack.config.json
```

Key sections in `jstack.config.json`:

| Section | What it configures |
|---------|-------------------|
| `team` | Name, timezone, business hours |
| `integrations` | JIRA, Slack, Notion, GitHub, Google Calendar, Sheets connection details |
| `mcp_servers` | MCP server registry (auto-populated by setup wizard) |
| `gbrain` | Team and personal knowledge-base URLs |
| `session` | Auto-end, metrics-on-end, diary prompts |
| `jira_rules` | Required fields, transitions, naming, auto-assign, story point caps |
| `notion_defaults` | Database IDs, default tags, auto-backlinking |
| `policies` | Review approvals, announcement channels, incident severity, SDLC gates |
| `routines` | Standup, weekly digest, sprint close, health check cron schedules |
| `telemetry` | Opt-in endpoint, batch size, flush interval |
| `org_context` | Org handbook, ethics, coaching, review rubrics (local paths + optional Notion/Drive + MCP labels) |
| `levels_and_expectations` | Markdown path / URL for level criteria (use with `skill_defaults.*.org_context_slices` token `levels`) |
| `skill_defaults` | Per-skill defaults, including **`org_context_slices`** for who loads which org files |

**Org context setup:** one standardized flow — [skills/_core/references/org-context.md](skills/_core/references/org-context.md) and copy-paste templates under [templates/config/org-context/](templates/config/org-context/README.md).

Full key reference (including optional `team_context`, `kickoff_workflows`, `impact`, `brag`, and other skill-driven blocks): [skills/_core/references/config-schema.md](skills/_core/references/config-schema.md). Values are always **your** paths, URLs, and IDs — the repo does not ship real org identifiers in schema docs or defaults.

### Validate your setup

```bash
./cli/bin/jstack doctor
./cli/bin/jstack doctor --strict          # fail if GBrain URLs or knowledge_base roots are missing/mismatched
./cli/bin/jstack doctor --fix             # show structured dependency issues + proposed repairs (dry-run)
./cli/bin/jstack doctor --fix --apply     # apply repairs with consent per group
```

This checks config presence, plugin layout, optional `.mcp.json`, and that `jstack.config.json` parses. It **warns** (or with `--strict`, fails) when `knowledge_base.roots` paths are absent on disk, GBrain URLs are empty, or `session.default_gbrain_target` does not match a configured URL.

`--fix` runs the dependency resolver and prints `DependencyIssue`s with one or more `RepairAction`s each: `mkdir`, `write_file` (only if missing), `set_config` (config patch, validated against the Zod schema before write), or `shell_hint` (printed only — never auto-executed). With `--apply`, mkdir/write_file repairs default to **Yes** at the consent prompt; `set_config` defaults to **No** (config writes require an explicit Yes).

### Session lifecycle (hooks vs skills)

1. **SessionStart hook** ([hooks/hooks.json](hooks/hooks.json)) — fast checks only (e.g. `jstack.config.json` exists; optional hint if `session.current_session_id` is empty). Hooks do **not** replace session setup; they nudge you before chat work.
2. **Session init skill** (`jstack:init-session` / `skills/session/init`) — sets **GBrain target** (team vs personal) and session id, loads context. Run this when you start real jstack work.
3. **Other skills** — reads/writes follow each skill’s rules; **intake/process** require user confirmation before persisting (see Persistence gate in those SKILL.md files).
4. **Session end** — summary and flush to GBrain (with provenance); new carryover needs explicit approval before write.

### MCP servers

jstack discovers MCP servers from `.mcp.json` at the project root. The file is gitignored (user-specific). See `.mcp.json.example` for the expected shape:

```json
{
  "mcpServers": {
    "your-server": {
      "command": "node",
      "args": ["path/to/server.js"]
    }
  }
}
```

The setup wizard auto-discovers and merges any existing `.mcp.json` entries.

## CLI

| Command | Purpose |
|--------|---------|
| `jstack setup` | Interactive wizard + MCP discovery (`--with-gbrain-kb`: GBrain + `knowledge_base` + `knowledge_storage`) |
| `jstack doctor` | Validate config; `--strict` treats GBrain/root warnings as errors |
| `jstack status` | Team/plugin status |
| `jstack mcp list\|health\|refresh` | MCP registry |
| `jstack schedule …` | Routine cron management |
| `jstack workflow …` | Browser workflow CRUD/run |
| `jstack eval …` | Unit / chain / gate evals |
| `bun run eval` | Repo skill evals: quick (structural + chains + YAML lint + coverage report) — see below |
| `jstack telemetry …` | Telemetry buffer (opt-in) |
| `jstack time` | Timezone + sprint context for agents |
| `jstack --help-json` | Machine-readable command registry |

### Skill evals (this repo)

From the plugin root, **no API key** (fast CI loop):

```bash
bun run eval                    # default: quick — structural + chains + validate YAML + coverage
bun run eval validate           # lint all skills/*/evals/*.yaml
bun run eval coverage           # which skills still need semantic cases
bun run eval report             # JSON counts
```

**Semantic** (LLM execute + grade; needs `ANTHROPIC_API_KEY` and `claude` on `PATH`):

```bash
bun run eval semantic --skill recon
bun run eval semantic --skill knowledge/search --viewer --threshold 80
```

Artifacts land in `evals/.reports/` (JSON summary, `REPORT_LATEST.md` for multi-skill, per-skill `NEXT_STEPS.md`, optional HTML viewer). Workspace traces: `evals/.workspace/` (gitignored).

Opt-in eval run telemetry (redacted, JSONL default `~/.jstack/telemetry.jsonl`): [`docs/TELEMETRY.md`](docs/TELEMETRY.md), privacy narrative for Notion [`docs/TELEMETRY_NOTION.md`](docs/TELEMETRY_NOTION.md). Verify with `jstack telemetry test`.

Scaffold baseline YAML for any skill still short on cases: `bun run generate-skill-evals` (adds `001-skill-smoke.yaml` / `002-negative-trivia.yaml` only when needed).

## Dashboard

```bash
cd dashboard && npm install && npm run dev
```

## Structure

```
.claude-plugin/    — Claude Code plugin manifest + marketplace (convention-based)
.cursor-plugin/    — Cursor plugin manifest (manifest-driven, declares paths)
.codex-plugin/     — Codex plugin manifest (manifest-driven, declares paths + interface)
.agents/plugins/   — Codex marketplace entry
skills/            — SKILL.md per capability (shared across all platforms)
  */agents/        — openai.yaml for Codex agent metadata
agents/            — Agent role definitions (chain orchestrator, recon scanner, etc.)
hooks/             — Session hooks (hooks.json)
prompts/           — Preamble, tones, personas, policies, and injectable fragments
config/            — JSON schema, defaults, schedule definitions
cli/               — Interactive setup wizard and operational commands (bun/TypeScript)
evals/             — Skill eval CLI (structural, chains, semantic YAML, LLM grading) + fixtures
telemetry/         — Zod schemas + collector (opt-in)
templates/         — JIRA, Notion, report, meeting, and announcement templates
examples/          — Sample inputs and outputs for each skill
dashboard/         — Web dashboard for visual status
themes/            — Theme definitions
```

**Documentation map:** [docs/MARKDOWN_SYSTEM.md](docs/MARKDOWN_SYSTEM.md) · [docs/SKILL_SOURCES.md](docs/SKILL_SOURCES.md) (external PM libraries + deep-dive rollout)

### Skill catalog (static site)

The plugin root includes a **single-page skill catalog** ([`index.html`](index.html)): searchable, category filters, and links to each `SKILL.md` in the repo. Styling is plain CSS ([`docs.css`](docs.css)); behavior is in [`docs.js`](docs.js). Embedded data is generated into [`skills-data.js`](skills-data.js).

- **View locally:** serve the plugin root over HTTP (plain `file://` can block scripts). Example: `cd jstack.core && bunx serve .` then open the URL shown in the terminal.
- **After changing skills:** regenerate data with `bun run docs:generate` from `jstack.core`, or **`jstack docs generate`** from anywhere (uses the same `package.json` script when `CLAUDE_PLUGIN_ROOT` / plugin resolution finds `jstack.core`).

### Scaffolding new skills (maintainers)

The TypeScript scaffolder creates **minimal** `skills/<path>/SKILL.md` files for paths defined in [`scripts/generate-skills.ts`](scripts/generate-skills.ts). **Run it when** you add a new entry to that list, fork the repo and need missing leaf dirs, or you want to verify the tree matches the generator. **Skip it** for day-to-day plugin use — it does not overwrite existing `SKILL.md` files.

```bash
bun scripts/generate-skills.ts
```

**Regenerate skill bodies** after changing `scripts/apply_detailed_skills.py` or `scripts/apply_detailed_skills_data.py`:

```bash
bun run apply-skills
```

(`python3 scripts/apply_detailed_skills.py` is equivalent.) Eval stubs: `bun run generate-skill-evals`.

## Configuration (team + personal)

- **Defaults:** [config/defaults.json](config/defaults.json) — includes `gbrain.team`, `gbrain.personal`, `session.default_gbrain_target`, `knowledge_base`, and `gbrain.provenance`.
- **Team vs personal layout:** [skills/_core/references/config-team-vs-personal.md](skills/_core/references/config-team-vs-personal.md) — bootstrap a shared config repo, create `jstack.personal.json` from [config/personal.example.json](config/personal.example.json), and keep private data out of team git ([repo-and-privacy.md](skills/_core/references/repo-and-privacy.md)).
- **First run:** use `jstack:setup` or the config wizard; validate with `jstack doctor` when available.

## Platform compatibility

| Feature | Claude Code | Cursor | Codex |
|---------|-------------|--------|-------|
| Discovery | Convention-based | Manifest-driven | Manifest-driven |
| Plugin manifest | `.claude-plugin/plugin.json` | `.cursor-plugin/plugin.json` | `.codex-plugin/plugin.json` |
| Marketplace | `.claude-plugin/marketplace.json` | via plugin manifest | `.agents/plugins/marketplace.json` |
| Skills | Scans `skills/` for `SKILL.md` | `"skills"` path in manifest | `"skills"` path in manifest |
| Hooks | Scans `hooks/hooks.json` | `"hooks"` path in manifest | `"hooks"` path in manifest |
| MCP servers | Scans `.mcp.json` | `"mcpServers"` path in manifest | `.mcp.json` |
| Agent metadata | N/A | `"agents"` path in manifest | `agents/openai.yaml` per skill |
| User config | `userConfig` in manifest | `userConfig` in manifest | `interface` in manifest |

## CI

### Standalone repository (`jstack.core` is git root)

Run `bun install && bun run verify`. That **first** validates [`hooks/hooks.json`](hooks/hooks.json), smoke-runs SessionStart hook commands, checks `jstack --help-json`, exercises a read-only CLI matrix on a temp fixture, **then** runs the same **`check`** pipeline as before: config when present, **`agents-check`** (YAML frontmatter plus every `jstack:*` token against `skills/**/SKILL.md` names), eval YAML, quick structural/chain evals, and CLI/dashboard typechecks. Use `SKIP_VERIFY_CHECK=1 bun run verify` to run only the hooks + CLI portion (skips the final `check`). The full `verify` gate runs in GitHub Actions ([`.github/workflows/check.yml`](.github/workflows/check.yml)).

### Monorepo (`jstack.core/` nested under a parent repo)

PRs that touch agent specs, skills, evals, or the agents-check script are validated by [`.github/workflows/jstack-core-skill-eval.yml`](../.github/workflows/jstack-core-skill-eval.yml) at the repo root (paths under `jstack.core/`). Before pushing agent edits locally:

```bash
cd jstack.core && bun install && bun run agents-check
```

Use `bun run verify` from `jstack.core` when you want the full gate matching standalone CI (or `bun run check` if you only need the validate/eval/typecheck slice).

### Periodic / release hygiene

After renaming skills or editing many `agents/*.md` files, run **`bun run agents-check`** even outside CI so stale `jstack:*` references fail fast. See [docs/MARKDOWN_SYSTEM.md](docs/MARKDOWN_SYSTEM.md) for how agents relate to skills.

## License

MIT — see `LICENSE`.

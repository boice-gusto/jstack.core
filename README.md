<p align="center">
  <img src="assets/logo-mark-128.png" alt="" width="96" height="96" />
</p>

<h1 align="center">jstack</h1>

<p align="center">
  Team-operations toolkit for coding agents — sprint and incident workflows, Jira/Notion/Slack
  operations, research, reporting, and knowledge capture, packaged as an installable plugin.
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#configuration">Configuration</a> ·
  <a href="#cli">CLI</a> ·
  <a href="#development">Development</a> ·
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

---

## What this is

jstack turns recurring team operations into skills an agent can invoke deliberately, with the
rules and guardrails your team actually follows. Instead of re-explaining your sprint process or
your Jira conventions in every session, they live in configuration and skill definitions.

It runs on **Claude Code**, **Cursor**, and **Codex**.

| | |
|---|---|
| **136 skills** | Sprint ceremonies, incident response, Jira/Notion CRUD with enforcement rules, reports, research, meetings, session lifecycle, personal productivity |
| **22 agents** | Role-scoped subagents (staff engineer, PM, design lead, sprint lead, review counsel…) for multi-perspective work |
| **CLI** | `setup`, `doctor`, `eval`, `schedule`, `workflow`, `mcp`, `telemetry` — scriptable, with JSON output |
| **Eval harness** | Structural, chain, and LLM-graded evals so a skill can be shown to still work |
| **Onboarding wizard** | Browser and conversational, both producing the same validated config |

Two packages, deliberately separated: **jstack.core** (this repo) is generic and ships no
company-specific values. An **org overlay** (for example `jstack.gusto`) adds internal URLs,
org policy, and company-specific skills on top. Anything naming a real team, channel, ticket
project, or internal host belongs in the overlay, never here.

## Requirements

- [Bun](https://bun.sh) — the only supported package manager and script runner. Do not use npm,
  yarn, or pnpm anywhere in this repo, including `dashboard/`.
- Claude Code, Cursor, or Codex.
- Python 3 only if you regenerate skill bodies (see [CONTRIBUTING.md](CONTRIBUTING.md)).

## Install

The plugin root is the directory containing `.claude-plugin/` — in a sibling-checkout layout that
is `jstack.core/`, not the parent folder.

```bash
git clone <this-repo-url> jstack.core
cd jstack.core && bun install

claude plugin marketplace add "$PWD" --scope user
claude plugin install jstack@jstack-local --scope user
claude plugin list        # expect jstack ... enabled
```

Restart your client after installing.

<details>
<summary>Cursor and Codex</summary>

Both use manifest-driven discovery rather than convention-based scanning.

```bash
# Cursor
cursor plugin marketplace add /path/to/jstack.core --scope user
cursor plugin install jstack@jstack-local --scope user

# Codex
codex plugin install /path/to/jstack.core
```

Skill-only alternative for Codex, with no plugin system:
`ln -s /path/to/jstack.core/skills ~/.codex/skills/jstack`

</details>

## Quick start

```bash
bun run onboarding          # guided browser wizard → jstack.config.json
./cli/bin/jstack doctor     # validate the result
```

The wizard is a single self-contained HTML file. It runs entirely locally — no server, no
network — and stops at a proposed config for your review before anything is written. It keeps
personal values out of a shared team config and refuses input that looks like a credential.

Prefer to stay in the terminal, or in a chat session:

```bash
./cli/bin/jstack setup --schema   # field-by-field CLI wizard
```
```
jstack:onboarding                 # same flow, conversational
```

Then invoke your first skill — `jstack:recon` to orient in an unfamiliar repo, or `jstack:adr`
to record a decision.

## Configuration

All org-specific values live in `jstack.config.json` at your project root. Skills read from it
and never hardcode identifiers; when a value is missing they say so rather than inventing one.

| Section | Configures |
|---------|-----------|
| `team`, `sprint` | Identity, timezone, cadence, capacity metric |
| `integrations` | Jira, Slack, Notion, GitHub, Calendar, Sheets |
| `mcp_servers` | MCP registry (auto-discovered from `.mcp.json`) |
| `knowledge_base`, `gbrain` | Where durable notes are read from and written to |
| `jira_rules`, `notion_defaults` | Required fields, transitions, routing, templates |
| `policies`, `approval_chains` | Review gates, announcement approval, incident severity, SDLC |
| `routines` | Scheduled standup, digest, sprint close, health check |
| `skill_defaults` | Per-skill overrides |
| `telemetry` | Opt-in, off by default |

**Never put credentials in this file.** Secrets belong in environment variables or a secret
store; MCP servers handle their own auth.

- Full key reference: [`skills/_core/references/config-schema.md`](skills/_core/references/config-schema.md)
- Team vs personal split: [`skills/_core/references/config-team-vs-personal.md`](skills/_core/references/config-team-vs-personal.md)
- Org context files: [`skills/_core/references/org-context.md`](skills/_core/references/org-context.md)

Validate at any time:

```bash
./cli/bin/jstack doctor            # human-readable
./cli/bin/jstack doctor --json     # machine-readable
./cli/bin/jstack doctor --fix      # propose repairs (dry run; writes nothing)
```

`--fix` prints structured issues with proposed repairs. Only `--fix --apply` writes, and config
writes require explicit confirmation.

## CLI

`jstack --help-json` is the authoritative command registry; the table below is a summary.

| Command | Purpose |
|---------|---------|
| `setup` | Interactive configuration (`--schema` for the field-by-field walk) |
| `doctor` | Validate config and layout (`--strict`, `--fix`, `--json`) |
| `status`, `time` | Team/plugin status; timezone and sprint context |
| `skills`, `docs` | List skills; regenerate the catalog site |
| `config` | Inspect and patch configuration |
| `eval` | Run structural, chain, and semantic evals |
| `schedule`, `workflow` | Routine cron management; browser workflow CRUD and runs |
| `mcp` | MCP registry: `list`, `health`, `refresh` |
| `report`, `transcripts` | Render reports; work with session transcripts |
| `claude-md`, `upgrade` | Audit CLAUDE.md against real sessions; version checks |
| `telemetry` | Inspect the opt-in telemetry buffer |

## Development

```bash
bun run check      # the full gate CI runs
bun test cli/src   # unit tests only
```

`bun run check` runs config validation, agent/skill frontmatter checks, chain-reference
validation, eval YAML linting, structural and coverage evals, unit tests, and both typechecks.

**Most skill bodies are generated.** `scripts/apply_detailed_skills.py` rewrites the body of
every `skills/**/SKILL.md` not listed in its `SKIP` set. Hand-editing a generated body loses the
work on the next regeneration — change the generator data instead, or add the skill to `SKIP`.
[CONTRIBUTING.md](CONTRIBUTING.md) covers the end-to-end flow for adding a skill.

Eval coverage is enforced: a new skill without eval cases fails the gate. That is deliberate — a
skill with no evals cannot be shown to still work. See [`evals/AUTHORING.md`](evals/AUTHORING.md).

```bash
bun run eval                     # fast, no API key
bun run eval semantic --skill recon   # LLM-graded; needs ANTHROPIC_API_KEY and `claude` on PATH
```

Semantic evals cost money and are not run by CI.

## Repository layout

```
skills/          SKILL.md per capability, plus references/ and evals/
agents/          Role-scoped subagent definitions
prompts/         Preamble, personas, tones, policies, chains
cli/             Bun/TypeScript CLI
evals/           Eval harness (structural, chain, semantic, scenario packs)
config/          JSON schema and defaults
templates/       Jira, Notion, report, research, and config templates
onboarding/      Self-contained setup wizard + tests
dashboard/       Next.js dashboard (see dashboard/README.md for what is live vs stub)
docs/            Architecture and subsystem documentation
```

## Platform support

| | Claude Code | Cursor | Codex |
|---|---|---|---|
| Discovery | Convention-based | Manifest-driven | Manifest-driven |
| Manifest | `.claude-plugin/plugin.json` | `.cursor-plugin/plugin.json` | `.codex-plugin/plugin.json` |
| Skills | scans `skills/` | declared path | declared path |
| Hooks | scans `hooks/hooks.json` | declared path | declared path |
| Agents | scans `agents/` | declared path | declared path |

## Privacy

Nothing leaves your machine unless you enable it. Telemetry is opt-in and carries skill name,
token count, and latency only — no prompt text and no PII. MCP servers connect only to services
you configure. See [`docs/TELEMETRY.md`](docs/TELEMETRY.md).

## License

MIT — see [LICENSE](LICENSE).

# Skill conventions

## Preamble

Every skill reads `${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md` via `!cat` before acting. This sets team context, tone defaults, and active integrations.

## Config-first

No hardcoded team identifiers. All org-specific values (team ids, channel ids, project keys, base URLs, sprint cadence, approval chains) come from `jstack.config.json` and `skill_defaults`. If a value is missing from config, trigger the config wizard — do not guess.

## Config wizard

When a required config value is missing, follow the wizard pattern in `_core/references/config-wizard.md`. The wizard detects the gap, offers predefined templates if available, confirms with the user, writes to config, and resumes the skill. Users can also override config values at runtime without persisting.

## Approval chains

Skills that need approval (announcements, deploys, policy changes, external comms) resolve approval chains from `config.approval_chains`. See `_core/references/approval-chains.md` for predefined templates (startup/scaleup/enterprise) and resolution rules.

## Frontmatter

Every `SKILL.md` starts with YAML frontmatter:

```yaml
---
name: jstack-<skill-name>
description: <lead with the tightest “what + when”; discovery-optimized>
when_to_use: <optional: synonyms, indirect asks, example phrases — single line for generated skills>
category: <domain>
gbrain_destination: team | personal | none | inherit
data_class: non_sensitive | internal | people_performance
---
```

The `description` is what Claude uses first to decide whether to load the skill. **`apply_detailed_skills_data.py` still targets short `DESCRIPTIONS` entries** for the catalog, but Claude Code also lists **`when_to_use`**, which is appended to `description` with a **combined character budget** in the host. Use **`description`** for the core mission; add **`when_to_use`** when you need extra paraphrases and triggers (“undertrigger” guard). For hand-tuned skills, a longer `description` alone is fine if you stay within host limits.

**Structured vs chat UX:** finite branches (child skill pick, confirmations) → [`ask-user-question-patterns.md`](./ask-user-question-patterns.md); conversational clarifiers → [`question-patterns.md`](./question-patterns.md). When recommending **`jstack` CLI** steps, point to **guided subcommands** (`skills browse`, `workflow create`, `mcp add` picker, …) when they exist — see [`cli-vs-host-interaction.md`](./cli-vs-host-interaction.md).

### GBrain metadata (`gbrain_destination`, `data_class`)

**Required** on **leaf** skills that persist or strongly imply persistence to team/personal memory; **orchestrators** may use `gbrain_destination: inherit` and `data_class: internal` when they only route. See **`gbrain-persistence-metadata.md`** for enum definitions, conflict rules, and alignment with `repo-and-privacy.md`.

| Key | Purpose |
|-----|---------|
| `gbrain_destination` | Default target when the user asks to save to gbrain: `team`, `personal`, `none`, or `inherit` (session default). |
| `data_class` | Sensitivity: `people_performance` (brags, evals, impact prep) must not land in team-visible storage without explicit confirmation; `internal` for runbooks/digests; `non_sensitive` for public-safe content. |

## Body structure

1. **Chain Contract** — HTML comments for inputs, outputs, chains-to
2. **Preamble load** — `!cat` the setup preamble
3. **What this skill is for** — unique mission + out of scope
4. **Domain rules** — category-level guardrails
5. **Config and references** — what to read first (include wizard ref for any skill that needs config)
6. **Intake** — how to parse `$ARGUMENTS`. If the skill tells the user to run **`jstack`**, prefer naming **guided commands** that match shipped UX (`skills browse` vs manual grep); align picker wording with [`cli-vs-host-interaction.md`](./cli-vs-host-interaction.md).
7. **Procedure** — 5-step flow (load, plan, execute, validate, summarize)
8. **Output shape** — expected format (default: natural language). Optional machine-readable replies: see [`output-formats.md`](./output-formats.md) (`--output=json|yaml`, schemas under `references/schemas/`).
9. **Failure modes** — table of symptoms and recoveries
10. **Chaining** — how this skill connects to others
11. **User request** — `$ARGUMENTS` placeholder

For eval harnesses or automation only, authors may append a short **Structured output (optional)** block pointing at `output-formats.md` and an optional JSON Schema path; defaults stay prose.

## Skill deep-dive reference (`references/deep-dive.md`)

Optional file alongside `SKILL.md` for **methodology, best practices, examples, and pointers** to `templates/` and `examples/`. Keep `SKILL.md` directive-heavy; put narrative detail here.

**When to add:** Any skill where the model benefits from a stable checklist, rubric detail, or worked example without inflating the main file.

**Required sections** (use headings; omit only if nothing to say):

| Section | Purpose |
|--------|---------|
| **When to use** | Triggers, in-scope / out-of-scope in one short list |
| **Process** | Ordered steps, decision branches, or handoff points |
| **Best practices** | Non-obvious quality bars (e.g. how to label assumptions) |
| **Anti-patterns** | One line each: what *not* to do |
| **Examples** | Short synthetic snippets or "good vs weak" one-liners; link to `examples/` when available |
| **Templates** | Paths under `templates/` (repo-relative) that pair with this skill |
| **Chaining** | Natural `jstack:…` or external skill handoffs (see `chaining-guide.md`) |

**Loading:** Regenerated skills with a deep-dive pilot list include an extra `!cat` in **Procedure → Step 1** after the config load. New skills: add the same line manually when you add `references/deep-dive.md`. Default file name: `references/deep-dive.md` (split into `process.md` / `examples.md` only if a single file exceeds ~300 lines).

## Writing style

Follow the principles in the [meta-skill guide](https://github.com/hamelsmu/evals-skills/blob/main/meta-skill.md):
- **Directives, not wisdom.** Tell the agent what to do, not why.
- **Cut general knowledge.** Only include what the agent wouldn't know (your org's config values, your approval chains, your sprint cadence).
- **Be concrete.** Show what good output looks like.
- **One-line anti-patterns.** Failure modes and anti-patterns are one line each. If it takes a paragraph, convert it to a directive in the main instructions.

Config-driven context is the exception: the agent genuinely doesn't know your sprint cadence or approval chain, so those are read from config — not explained in the skill.

## Platform guidance

Link to `_core/best-practices/<platform>/...` for Jira, Slack, Notion, GitHub, and Google integration patterns.

## See also

- [`gbrain-persistence-metadata.md`](./gbrain-persistence-metadata.md) — `gbrain_destination` / `data_class` spec
- [`repo-and-privacy.md`](./repo-and-privacy.md) — team repo vs local/personal config (sessions, GBrain)
- [`config-team-vs-personal.md`](./config-team-vs-personal.md) — both `gbrain.team` / `gbrain.personal`, bootstrap new repo or personal file
- [`config-wizard.md`](./config-wizard.md) — interactive setup when config is missing
- [`config-schema.md`](./config-schema.md) — full config key reference
- [`approval-chains.md`](./approval-chains.md) — approval chain templates and resolution
- [`markdown-authoring-guide.md`](./markdown-authoring-guide.md) — variables, optional flows, chaining
- [`chaining-guide.md`](./chaining-guide.md) — how chain contracts work
- [`question-patterns.md`](./question-patterns.md) — the one-question-at-a-time protocol
- [`ask-user-question-patterns.md`](./ask-user-question-patterns.md) — AskUserQuestion-style discrete choices when the host supports it
- [`cli-vs-host-interaction.md`](./cli-vs-host-interaction.md) — AskUserQuestion vs `jstack` CLI vs chat; scripted `--json`
- [`integration-guide.md`](./integration-guide.md) — MCP, health checks, secrets
- [`output-formats.md`](./output-formats.md) — optional `--output=json|yaml`, schemas
- [`docs/MARKDOWN_SYSTEM.md`](../../../docs/MARKDOWN_SYSTEM.md) — repo directory map and conventions
- [`docs/SKILL_SOURCES.md`](../../../docs/SKILL_SOURCES.md) — external PM skill libraries, license notes, deep-dive rollout priority

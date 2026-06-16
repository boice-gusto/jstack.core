# Authoring jstack markdown (skills, agents, examples)

This guide is for humans and agents editing this plugin’s markdown. It aligns with [Claude Code skills](https://code.claude.com/docs/en/skills) (description-driven discovery, `SKILL.md` in subfolders).

## 1. Where each artifact lives

| You are writing… | Put it in… | Notes |
|------------------|------------|--------|
| Something Claude runs as a capability | `skills/.../SKILL.md` | One `SKILL.md` per directory (sub-skills = nested folder) |
| Which skills to use for a background role | `agents/<name>.md` | Short; points to `SKILL.md` and references |
| A reusable system or persona string | `prompts/` | No `SKILL` frontmatter; loaded by path |
| A doc the skill fills in | `templates/` | Keep placeholders obvious: `{{variable}}` |
| A test fixture or “good” example | `examples/<domain>/` | Name with `input-` / `output-` prefix |

## 2. `SKILL.md` frontmatter (jstack)

jstack skills typically use:

```yaml
---
name: jstack-<capability>
description: What it does and when to use it (triggers, integrations).
when_to_use: Optional. Extra trigger phrases and paraphrases for Claude Code (see below).
category: <domain>
---
```

- **`name`**: Use the `jstack-` prefix for catalog consistency; matches `jstack:` routing in the plugin.
- **`description`**: This is the main discovery string—include **when** to invoke (e.g. “Use when the user pastes Slack thread exports”). Lead with the tightest summary; Claude Code combines `description` and `when_to_use` for the skill listing with a **combined cap** (see [Claude Code skills](https://code.claude.com/docs/en/skills)).
- **`when_to_use`**: Optional Claude Code field. Use for **synonyms, indirect asks, and example user phrases** so the skill still loads when the user does not use your canonical wording. Prefer a **single line** in repo-generated skills so the regenerator’s simple frontmatter parser stays valid. Hand-authored skills may use richer YAML later if the parser is upgraded.
- **`category`**: Usually matches the parent folder; some skills (e.g. `skills/update-config/`) use `category: setup` for grouping while **`scripts/apply_detailed_skills.py`** still picks `MISSIONS` / `CATEGORY_DEEP` by **folder key** (`update-config` vs `setup`).

Optional blocks used here:

- **Chain contract** (HTML comments): `<!-- inputs: ... -->`, `<!-- outputs: ... -->`, `<!-- chains-to: jstack:other-skill -->`
- **Body structure**: Preamble `!cat` → **Instructions** → **Failure modes** → **User request** with `$ARGUMENTS`

## 3. Variables and optional behavior

| Mechanism | Purpose |
|-----------|---------|
| `$ARGUMENTS` | The user’s inline request after the skill invocation; always echo what you will interpret. |
| `jstack.config.json` | Team id, channels, project keys—never copy into markdown as literals; say “read from config”. |
| `!cat ${CLAUDE_PLUGIN_ROOT}/...` | Pull preamble or reference into context without duplicating. |
| Placeholders in templates | e.g. `{{sprint_id}}`, `{{owner}}`—document required vs optional in a comment at top of template. |

**Optional paths:** In Instructions, add a “Short path” (minimal output) and “Full path” (with Notion, Jira, or extra sections). State which questions to ask only on the full path.

## 4. User interaction (nested “microflows”)

**Pick the right reference:**

| Situation | Use |
|-----------|-----|
| Small finite branches (which child skill, A/B/C, confirm/cancel) and the host supports a structured picker | [`ask-user-question-patterns.md`](./ask-user-question-patterns.md) (AskUserQuestion or equivalent) |
| Open-ended clarification, one question at a time, assumptions | [`question-patterns.md`](./question-patterns.md) |
| Required config key missing | [`config-wizard.md`](./config-wizard.md) |

Then:

1. **Clarify scope** if the request is ambiguous (one topic per question when possible).
2. **Confirm writes** before creating tickets, posts, or external state (see `question-patterns.md`).
3. **Degrade gracefully**: if an integration is missing, cite `integration-guide.md` and `jstack doctor` instead of inventing API calls.

## 5. Nesting and workflows

- **Skill → skill**: Set `<!-- chains-to: jstack:next -->` and finish with a one-line handoff the next skill can parse.
- **Agent → many skills**: In `agents/*.md`, list primary skills in order; note read-only default vs “after approval”.
- **Routines / chains**: Keep chain definitions in `prompts/chains/` or `config/`; skills should not duplicate long chain prose—link out.

## 6. Quality bar

- No filler “lorem ipsum” in `examples/`—use realistic titles, names, and IDs marked fake if needed.
- Every `SKILL.md` should list at least one **failure mode** and a fix path (setup, doctor, or human).
- Prefer linking `references/*.md` for long tables (Slack patterns, API quirks) to keep `SKILL.md` skimmable.

## 7. Regenerating longform bodies (optional)

- The script [`scripts/apply_detailed_skills.py`](../../../scripts/apply_detailed_skills.py) rewrites every `skills/**/SKILL.md` **except** paths listed in its `SKIP` set, from addenda in [`scripts/apply_detailed_skills_data.py`](../../../scripts/apply_detailed_skills_data.py). Run from repo root: `python3 scripts/apply_detailed_skills.py`
- **Hand-maintained `SKIP` list** (bodies are not auto-regenerated; edit `SKILL.md` directly, or add your path to `SKIP` and merge generator output by hand if needed):
  - `skills/advice/SKILL.md`
  - `skills/recon/SKILL.md`
  - `skills/skill-creator/SKILL.md`
  - `skills/workflow-builder/SKILL.md`
  - `skills/knowledge/search/SKILL.md`
  - `skills/shortcuts/ceo-brainstorm/SKILL.md`
  - `skills/shortcuts/executive-research-brief/SKILL.md`
- **Edit** `DESCRIPTIONS`, `WHEN_TO_USE`, `MISSIONS`, `CATEGORY_DEEP` (per **skill key** or category), `path_extras`, `CHAINS_TO`, `FAILURE_EXTRAS` in the data file, then re-run. Domain rules: `CATEGORY_DEEP` matches **`skill_key` first** (e.g. `update-config`), then `category`, so subfolders with a different `category` in frontmatter still get the right block.
- **Add new / edit skills in-repo** — use `jstack:skill-creator` (`skills/skill-creator/SKILL.md`); **compose cross-skill flows** — use `jstack:workflow-builder` (`skills/workflow-builder/SKILL.md`).
- **Do not** add duplicate top-level docs for topics already under `skills/_core/references/` (e.g. keep privacy guidance only in [`repo-and-privacy.md`](./repo-and-privacy.md), not a second copy at repo root).

## 8. Security and PII

- Do not put real tokens, passwords, or customer data in any committed markdown.
- For telemetry, see [`telemetry/README.md`](../../../telemetry/README.md): opt-in, anonymous, no prompt content.

## 9. Agent specs (`agents/*.md`) and `jstack:` skill tokens

- **`agents/<role>.md`** uses YAML frontmatter (`name`, `description`, often `model: inherit`) plus a short body: ordered primary skills, guardrails, optional interaction table, output/handoff, failure modes—see strong examples under `agents/` (e.g. recon-scanner, chain-orchestrator).
- **Skill pointers**: Prefer **`jstack:<suffix>`** tokens that match **`SKILL.md`** frontmatter. Concretely, if a skill declares `name: jstack-foo-bar`, reference it in prose as **`jstack:foo-bar`** (the substring after the `jstack-` prefix). That keeps routing consistent with [`skill-conventions.md`](./skill-conventions.md) and lets CI validate references (`bun run scripts/agents-check.ts`).
- **Avoid** ambiguous bare paths (e.g. `design/figma-handoff`) in agent specs unless you are documenting a folder for humans only; hosts and grep workflows expect **`jstack:*`** for dispatch.

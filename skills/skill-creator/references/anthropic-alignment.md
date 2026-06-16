# Anthropic-aligned skill writing (jstack context)

Claude Code skills are documented in [Claude Code: Extend with skills](https://code.claude.com/docs/en/skills). The community **skill-creator** pattern and [evals-skills meta-skill](https://github.com/hamelsmu/evals-skills/blob/main/meta-skill.md) share these principles, adapted here for this repo.

## What to keep

- **Directives, not wisdom** — Tell the agent what to do. Skip motivation and general programming tutorials.
- **Description as discovery** — Frontmatter `description` should state what the skill does, **when to use it**, and **when not to** (if ambiguous).

## Anti-undertrigger (discovery)

Models often **under-trigger** skills: they skip loading a skill unless the wording matches closely. Mitigations:

- Put the **core mission** in `description` in the first sentence.
- Add **`when_to_use`** (Claude Code) with **synonyms, indirect user intents, and example requests**—the same idea as “pushy” descriptions in Anthropic’s skill-creator guidance: e.g. mention “dashboard,” “metrics,” and “internal report” if any of those should load the skill.
- For jstack-regenerated skills, extend `WHEN_TO_USE` and `DESCRIPTIONS` in `apply_detailed_skills_data.py`, then re-run `apply_detailed_skills.py`.
- Validate with **≥2 paraphrase smoke prompts** per orchestrator under `skills/<skill>/evals/` (see `evals/AUTHORING.md`).
- **Progressive disclosure** — Keep `SKILL.md` under ~500 lines; move long tables to `references/*.md` one level deep.
- **Concrete examples** — Show pass/fail or good output shapes, not vague “be clear” advice.
- **Anti-patterns** — One line each at the end of core instructions, not long essays.

## jstack-specific layers

- Use `name: jstack-<kebab-skill>`, `category` matching the folder.
- Preamble: `!cat` `${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md`
- **Org context** (cadence, approvals, channels) — read `jstack.config.json`; never hardcode. See `config-wizard.md` if values are missing.
- Chain contract HTML comments: `<!-- inputs: -->` `<!-- outputs: -->` optional `<!-- chains-to: jstack:... -->`
- Regenerator: `python3 scripts/apply_detailed_skills.py` rewrites most `skills/**/SKILL.md` bodies. **Hand-maintained exceptions** are listed in `scripts/apply_detailed_skills.py` (`SKIP` set). Add new paths there if a skill should not be overwritten.

## Naming

- Lowercase, hyphens: `jira-intake`, `sprint-close`
- Action- or outcome-oriented, specific enough to disambiguate from siblings

## Testing

After authoring, run a **fresh** agent turn on a realistic task; authors carry blind spots.

## Attribution

This file summarizes practices from Anthropic’s skills documentation and common community “skill-creator” tooling; the **jstack** plugin’s layout and config-first rules are this repository’s.

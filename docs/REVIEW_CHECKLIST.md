# Markdown refresh — review checklist

Use this after changing skills, agents, examples, or operator docs.

## Structure and placement

- [ ] New capabilities live in `skills/.../SKILL.md` (not `dashboard/` or `themes/` for skill logic)
- [ ] Agent behavior updates live in `agents/*.md` and point to the right `SKILL.md` paths
- [ ] `examples/**` are synthetic; no real tokens or PII
- [ ] `prompts/**` have no fake YAML that could be mistaken for a skill

## Content quality

- [ ] If content is **derived from an external skill repo**, license and attribution model are acceptable (see [`docs/SKILL_SOURCES.md`](SKILL_SOURCES.md); CC BY-NC-SA sources are not copied verbatim without a deliberate decision)
- [ ] `description` in each touched `SKILL.md` still says *what* and *when* (discovery)
- [ ] At least one **failure mode** + remediation path (setup, `jstack doctor`, or human)
- [ ] Chaining: `<!-- chains-to -->` and handoff text stay consistent
- [ ] `examples/README.md` and domain examples stay aligned with new patterns

## Prompt templates

- [ ] Tones/personas/policies still have `<!-- [CUSTOMIZE] -->` markers on org-specific sections
- [ ] Each customizable prompt has a **Config hook** section showing `jstack.config.json` keys
- [ ] Example values in `<!-- [CUSTOMIZE] -->` sections are realistic placeholders, not real org data
- [ ] Chains reference the correct skill names and policies

## Config and privacy

- [ ] Team vs personal: `gbrain.team` / `gbrain.personal` documented; personal-only keys not encouraged in shared team `jstack.config.json` without review ([`config-team-vs-personal.md`](../skills/_core/references/config-team-vs-personal.md), [`repo-and-privacy.md`](../skills/_core/references/repo-and-privacy.md))
- [ ] `config/defaults.json` and `config/personal.example.json` stay in sync when adding new top-level keys

## Cross-links

- [ ] `docs/MARKDOWN_SYSTEM.md` still describes the map accurately; if external sources or deep-dive rollout changed, [`docs/SKILL_SOURCES.md`](SKILL_SOURCES.md) stays aligned
- [ ] `skills/_core/references/skill-conventions.md` and `markdown-authoring-guide.md` are linked from touched skills where relevant
- [ ] Root `README.md` “Documentation map” line still valid

## Ops docs

- [ ] `telemetry/README.md` matches `schema.ts` and opt-in story
- [ ] `dashboard/README.md` and `themes/README.md` match how the app uses config

## Optional verification

- [ ] Grep for `(stub)` in `examples/` — should be **zero**
- [ ] Grep for hardcoded `sk-` or `Bearer` in markdown — should be **zero**

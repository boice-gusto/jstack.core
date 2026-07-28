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

Everything under `prompts/` is injected verbatim into model prompts, so review it as instructions, not documentation.

- [ ] **No invented org facts.** No fabricated company/product names, employee names, metrics, competitors, compliance deadlines, or incident details. An unfilled prompt must degrade to a generic-but-useful lens, never to a fictional company. (The `<!-- [CUSTOMIZE] -->` convention was removed — it hid real guidance inside HTML comments and shipped fictional example data into prompts.)
- [ ] **No real org data either.** Internal hostnames, channel IDs, Jira keys, and employee names belong in an org overlay, not in core.
- [ ] **No blank content that looks like data.** No empty table cells or rows, and no section whose only content is a comment.
- [ ] **Guidance is prose, not commented out.** If it should steer behavior, the model has to be able to read it.
- [ ] Any config key a prompt cites actually exists in `config/defaults.json`, and is actually read by code. `personas` and `tones` are reserved-but-unimplemented — do not describe them as working overrides.
- [ ] Personas stay mutually distinct: each states what it uniquely catches and what it explicitly does not own, so a multi-persona review yields different findings rather than one repeated shape.
- [ ] Chains reference correct skill names and policies (`bun run validate-chains`).

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

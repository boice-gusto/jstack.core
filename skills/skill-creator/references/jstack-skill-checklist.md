# jstack `SKILL.md` checklist (before commit)

- [ ] **Frontmatter** — `name: jstack-...`, `description` (tight “what + when”; triggers + exclusions), optional `when_to_use` for paraphrases per [Claude Code skills](https://code.claude.com/docs/en/skills), `category` matches parent folder
- [ ] **Chain contract** — `inputs` / `outputs` comments; `chains-to` only if there is a default next skill
- [ ] **Preamble** — One `!cat` of `prompts/setup/preamble.md` at top of body
- [ ] **No secrets** — No tokens, real customer IDs, or production URLs that aren’t public
- [ ] **Config** — Id/channel/project keys as “read from `jstack.config.json`”, not hardcoded
- [ ] **Wizard** — If the skill *requires* missing config, reference `skills/_core/references/config-wizard.md` behavior
- [ ] **Structured picker** — If the skill presents discrete A/B/C or child-skill routing, follow `skills/_core/references/ask-user-question-patterns.md` when the host exposes AskUserQuestion (or equivalent)
- [ ] **Failure modes** — At least one row: symptom + recovery (`jstack doctor`, `jstack setup`, or human)
- [ ] **Length** — `SKILL.md` &lt; ~500 lines; else split to `references/*.md` and link
- [ ] **Regenerator** — If this file should **never** be auto-regenerated, add its path to `SKIP` in `scripts/apply_detailed_skills.py`
- [ ] **Examples** — If domain needs fixtures, add under `examples/<domain>/` (no PII)
- [ ] **Cross-link** — `markdown-authoring-guide.md` and `skill-conventions.md` for repo norms
- [ ] **Structured output (only if needed)** — Eval/automation consumers: point to `skills/_core/references/output-formats.md`; optional `references/schemas/*.schema.json` (with `$id`) + example object; JSON instances include `$schema` when org sets `skills.machine_readable.require_schema_ref` or for public APIs

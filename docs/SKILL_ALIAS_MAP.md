# Skill alias map (core ↔ host overlays)

Machine-readable rows live in [`config/skill-alias-map.json`](../config/skill-alias-map.json). CI and `jstack doctor --strict` run [`scripts/validate-skill-alias-drift.ts`](../scripts/validate-skill-alias-drift.ts) to catch **missing listed mirrors** and **content drift** when `requireIdentical` is true.

## Columns

| gateId | Core `SKILL.md` | Cursor / other | Gusto / org | Identical? | Notes |
|--------|-----------------|----------------|-------------|------------|-------|
| `jstack:jira/create` | `jstack.core/skills/jira/create/SKILL.md` | — | `jstack.gusto/skills/gusto-jira/create-jira-ticket/SKILL.md` | no | Org overlay |

Add a row to the JSON when you maintain a deliberate duplicate or fork; leave `cursorRelPath` unset until a path is tracked in-repo.

## Commands

- `bun run validate:alias-drift` — warnings only (exit 0).
- `bun run validate:alias-drift --strict` — non-zero on warnings (used in `check`).
- `jstack doctor --strict` — fails if config/MCP warnings exist **or** alias drift checks fail.

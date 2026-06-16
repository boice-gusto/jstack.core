# Composite shortcuts (persona + tone + target skill)

Named **aliases** for multi-step loading. The left column is the **documentation name** (what users say); the right side is the **sequence** the model should follow. Actual `name:` in `SKILL.md` frontmatter stays `jstack-*` (valid identifier); this file maps `jstack:alias` → recipe.

| Alias | Purpose | Steps |
|-------|-----------|--------|
| `jstack:ceo-brainstorm` | Executive lens + creative expansion before commitment | 1) `!cat` [`prompts/personas/ceo.md`](../personas/ceo.md) 2) `!cat` [`prompts/tones/executive.md`](../tones/executive.md) 3) Invoke `Skill(skill: "superpowers:brainstorming")` with `$ARGUMENTS` as the topic; output must lead with decision ask, 3 bullets context, options A/B per `ceo.md`. |
| `jstack:executive-research-brief` | Competitive/market note for leadership | 1) `!cat` [`prompts/personas/ceo.md`](../personas/ceo.md) 2) `!cat` [`prompts/tones/executive.md`](../tones/executive.md) 3) Run **`jstack:research-competitive`** (skill `jstack-research-competitive`) using `$ARGUMENTS`; cap at 1 page for *Implications*; cite sources with dates. |
| `jstack:ceo-gstack-health` | System/ops health through exec lens (if gstack installed) | 1) `!cat` [`prompts/personas/ceo.md`](../personas/ceo.md) 2) `!cat` [`prompts/tones/executive.md`](../tones/executive.md) 3) `Skill(skill: "gstack:health")`; summarize in **RAG** + top 3 risks + **one** ask. |

## Plain bridge tables (unchanged)

- [gstack-bridge.md](./gstack-bridge.md)
- [superpowers-bridge.md](./superpowers-bridge.md)

## Discoverable wrapper skills

These mirror the table above as `skills/shortcuts/*/SKILL.md` for plugin discovery:

- `jstack-ceo-brainstorm` — `jstack:ceo-brainstorm`
- `jstack-executive-research-brief` — `jstack:executive-research-brief`

Do **not** duplicate the full body of `superpowers:brainstorming` or `gstack:*` in jstack — only the wrapper + `!cat` + handoff instructions.

# Prioritization — deep dive (jstack-prioritize)

## When to use

- You have a **list of initiatives, features, or tickets** and need a defensible stack rank.
- Inputs may be pasted text, a JQL result summary, or `action_items` from `jstack:recon`.
- **Out of scope:** Creating Jira issues, writing PRDs, or executing work — use `jstack:jira-create`, `jstack:intake`, or planning skills after ranking.

## Process

1. **Normalize the list** — same grain (epic vs story); split mixed levels or label `[mixed grain]`.
2. **Pick one framework** — RICE, WSJF, value/effort 2×2, or a rubric the user supplied. Do not blend frameworks in one table without explicit user ask.
3. **Score** — every row gets the same columns; missing data → `[assumption]` or `?` with one follow-up question if blocking.
4. **Cutline** — state what is “in” vs “parking lot” and one sentence on opportunity cost.
5. **Hand off** — if the user wants tickets or a doc, suggest `suggested_next` with payload (ranked ids or titles).

## Best practices

- Show **one table**; footnote definitions of R/ I/ C/ E or WSJF terms when used.
- Label **subjective** columns explicitly (`[judgment]`).
- Prefer **transparent tie-breaks** (revenue, risk, fixed date) before asking the user.

## Anti-patterns

- Inventing scores with no basis.
- Ranking a single item (clarify or expand scope first).
- Auto-creating work in Jira from this skill alone.

## Examples

**Weak:** “Feature A is probably more important.”  
**Strong:** “Feature A: RICE 42 (R8 I5 C3 E2); Feature B: RICE 28 (R5 I4 C2 E3). Cutline after A; B deferred — lower confidence on C for B [judgment].”

## Templates

- `templates/config/sprint-templates.md` — cadence context when tying rank to sprint.
- Org rubrics: store column weights in `jstack.config.json` / team docs, not in this file.

## Chaining

- **From** `jstack:recon` — consume `action_items` or summary; output stack rank + cutline.
- **To** `jstack:jira-intake` / `jstack:notion-planning` — pass ordered list + rationale in handoff block.

# Project — deep dive (jstack-project)

## When to use

- **Status across milestones** — health, blockers, dates — usually backed by Notion/JIRA per config.
- Stakeholder questions: “where are we on X?”
- **Out of scope:** Deep engineering metrics (`jstack:engineering`, `jstack:metrics`) unless the user conflates them; clarify and route.

## Process

1. **Identify the project** — name, key, or config id; one clarifying question if ambiguous.
2. **Pull** — from configured integrations; if read-only, say so; if missing, return markdown template to paste.
3. **Synthesize** — RAG status (red/amber/green) with **why**; next milestone and confidence.
4. **Risks** — top 1–2 with owner/mitigation or “unowned” explicitly.
5. **Next steps** — one suggested jstack follow-up (e.g. `jstack:notion-project`, `jstack:reports`).

## Best practices

- Align **vocabulary** with the team’s Notion/Jira (epic vs project vs program).
- **Date everything** (as-of) when metrics can drift.
- Distinguish **commitments** from **forecasts** when leadership reads the output.

## Anti-patterns

- Green-washing when issues are open and dated.
- Mixing multiple projects in one summary without clear sections.

## Examples

**Weak:** “The project is going fine.”  
**Strong:** “As of 2026-04-20: RAG **Amber** — M2 API integration at risk (2 blockers, owner EM). M3 on track. Next: escalate blockers in `#proj-x` or `jstack:jira-get` for PROJ-555.”

## Templates

- `templates/config/sprint-templates.md` — when the project is sprint-bound.
- Reports: `jstack:reports-project-report` for formal rollups when requested.

## Chaining

- **To** `jstack:sprint` — for current iteration health within the project.
- **To** `jstack:engineering` — when blockers are PR/CI/ownership related.
- **To** `jstack:notion-project` or `jstack:notion-knowledge-base` — when the single source of truth is Notion.

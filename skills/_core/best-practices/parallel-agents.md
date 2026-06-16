# Parallel agent gathering

Use when **two or more data sources** are independent (no ordering dependency between them).

## When to use

- Daily/weekly brag: Slack + GitHub + Jira in parallel.
- Standup prep: same pattern when each source queries a different system.
- Quarterly impact: artifact sweep across repos, issue tracker, chat, docs.
- **Multi-backend search with one question:** use **`jstack-federated-search`** (per-provider JSON contract, merge, optional `--raw`).

## Pattern

1. **Scope** each agent to one source with a **fixed time window** and **max result count** (e.g. 50).
2. **Structured return format** in the agent prompt: list of objects with stable fields (text, url, timestamp, id).
3. **Launch in one turn** when the host supports multiple sub-agents; otherwise run sequentially but keep prompts identical.
4. **Merge** results into a single timeline or bucket by theme before synthesis.
5. **Failure isolation** — if one source fails, note `[source: unavailable]` and continue with others unless the skill marks that source as required.

## Anti-patterns

- Nesting: do not make the Jira agent depend on Slack output unless necessary.
- Unbounded pulls: always cap messages/PRs/issues.
- Duplicating the same query across agents without different filters.

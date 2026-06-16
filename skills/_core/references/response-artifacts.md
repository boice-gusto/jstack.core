# Response shape — links footer (create / modify)

When a skill or CLI run **creates** or **materially updates** a resource and a **durable URL** exists, end the assistant reply with a short block:

## Links

- Use markdown: `[Label](https://…)`
- Include stable ids when helpful: `PROJ-123 — [Summary](https://…)`
- If nothing was created, omit the section or write: *No new URLs.*

Apply to: Jira, Notion, Slack (if permalink), Drive, published HTML, PRs, etc.

Construct browse URLs from keys using `integration-guide.md` and org refs — never guess internal hostnames.

For **optional JSON/YAML-only** replies (evals, automation), see [`output-formats.md`](./output-formats.md) — orthogonal to **## Links**; use both when a run creates URLs *and* needs a parsed payload.

## Eval / rubric hints

- For skills that **simulate** a create/update (fixtures with fake API responses), semantic evals may require a `## Links` heading or assert `response_match_regex: ["## Links"]` in `evals/*.yaml` (`assert` block).
- CLI commands that write artifacts should print a short **## Links** section to stderr/stdout (e.g. `jstack report render`, `jstack workflow create`).

# Federated search — provider registry

Use this to **pick tools**, set **caps**, and load **provider-specific** nuance. Canonical ids are **lowercase**; aliases are for natural-language matching.

## Built-in provider ids

| Id | Typical MCP / integration | Search posture | Default cap (soft) |
|----|---------------------------|----------------|--------------------|
| `jira` | Jira: search / JQL | Prefer **scope** (project, status) + text; return issue keys | 25 issues |
| `notion` | Notion: search | Workspace search; respect vault vs team routing from config | 20 pages |
| `slack` | Slack | Search or history **with time window** | 50 messages |
| `github` | GitHub | Code / issue search in configured org/repos | 30 items |
| `glean` | Glean enterprise search | Org corpus; cite titles + links only | Per Glean UX |
| `google` | Google Custom Search API or MCP | Web snippets + links; cite | 10 results |
| `duckduckgo` | Web search MCP / browser | Public web; disclaim freshness | 15 results |
| `knowledge` | `jstack:knowledge-search` / `knowledge_base` | Org KB roots from config — not a separate MCP always | Follow knowledge skill |
| `gbrain` | gbrain MCP if configured | Memory / brain query | Follow gbrain docs |
| `web` | `web_fetch`, browser, or generic | Fallback when no branded search MCP | Same as DDG tier |

Aliases (map to canonical id):

- `gleam` → treat as typo for **`glean`** unless user clarifies.
- `ddg` → `duckduckgo`
- `gs` → `google`

## Selecting providers from natural language

- “**Tickets**”, “blockers”, “sprint”, “PROJ” → include **`jira`** if `mcp_servers.jira.enabled` or Jira integration present.
- “**Wiki**”, “doc”, “Notion”, “requirements page” → **`notion`**.
- “**Standup**, **threads**, channel” → **`slack`**.
- “**What did we ship**”, “PR”, “commit” → **`github`**.
- “**Employees**, **Policies**”, internal corpus → **`glean`** if enabled, else **`knowledge`**.
- **Open web**, news, benchmarks → **`google`** / **`duckduckgo`** / **`web`** (pick one canonical web path to avoid triple-querying unless user asks for corroboration).

If the user lists **nothing**, default to **all providers that are (a) inferable from the question and (b) enabled in config**. If intent is ambiguous, ask **one** question: “Search **only** internal (Jira, Notion, Slack) or include **web**?”

## Per-provider prompts (hints)

Detailed copy-paste subagent prompts live in the parent skill body; keep each under **120 lines** so hosts can fork subagents cleanly.

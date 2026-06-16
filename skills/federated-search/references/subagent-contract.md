# Subagent return contract

Every **per-provider** subagent (or Tool Result you treat as a subagent boundary) must return **JSON-shaped** content the parent can merge without guesswork.

## Required fields (per hit)

| Field | Type | Notes |
|-------|------|--------|
| `source` | string | Provider id, e.g. `jira`, `notion` |
| `title` | string | Human label |
| `snippet` | string | 1–4 lines; quote lightly, do not paste secrets |
| `url` | string \| null | Canonical link if the system provides one |
| `id` | string \| null | Issue key, page id, doc id |
| `timestamp` | string \| null | ISO-8601 if known |
| `confidence` | `"high"` \| `"medium"` \| `"low"` | How well the hit matches the **user query** |

## Wrapper object

```json
{
  "provider": "jira",
  "query_used": "normalized query or JQL excerpt",
  "hit_count": 0,
  "truncated": false,
  "error": null,
  "hits": []
}
```

## Rules

- **`truncated: true`** when the agent stopped early due to caps (message count, result count, rate limit).
- **`error`** — non-null string on failure; parent still runs other providers (`[source: unavailable]` in merged output).
- Never fabricate `url` / `id`; use `null` if unknown.

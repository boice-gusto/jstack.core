# `knowledge_base` config shape

Lives in `jstack.config.json` under the top-level key `knowledge_base`.

| Field | Type | Purpose |
|-------|------|---------|
| `roots` | string[] | Directory or file paths **relative to the workspace root** (or absolute paths the agent can read). Searched first for markdown and text. |
| `include_globs` | string[] | Glob patterns applied under each root (e.g. `**/*.md`). |
| `exclude_globs` | string[] | Subtrees to skip (build output, VCS, deps). |
| `doc_urls` | object[] | `{ "label": string, "url": string, "note"?: string }` — public handbooks, OpenAPI, internal wikis reachable via fetch/MCP. |
| `github.repos` | string[] | `owner/repo` strings to treat as in-scope; README, docs folder, and optional issue search. |
| `github.search_issues` | boolean | If true, issue search is allowed for those repos (slower, rate-limited). |
| `github.prefer_readme` | boolean | Prefer each repo’s README for overview answers. |
| `retrieval.system_prompt` | string | Injected for **how** to combine sources: citation rules, what to do when info conflicts. |
| `retrieval.per_source` | object[] | Optional `{ "id", "match_substrings"?: string[], "prompt"?: string }` — extra instructions when an answer would draw from a path or label. |
| `gbrain.include` | boolean | If true, **also** consult GBrain (team or personal per session) in addition to the sources above. |
| `gbrain.note` | string | Reminder in config only; not read by code — documents intent. |

## GBrain vs this block

- **`gbrain.*` (URLs, trust):** how to connect to the GBrain *product* for memory, TODOs, session routing — see `gbrain-patterns.md`.
- **`knowledge_base`:** what **files, sites, and repos** count as *your* canonical written knowledge for *retrieval* questions. The agent does not automatically know your repo’s layout; you list it here.

Use **both** when answers should blend indexed docs and team memory. Use **only `knowledge_base`** for open-source or static docs with no GBrain.

## `knowledge_storage` (team vs personal Git + disk fallback)

Top-level key `knowledge_storage` configures **where markdown file writes go** when not using GBrain/Notion alone:

| Field | Type | Purpose |
|-------|------|---------|
| `disk_fallback_root` | string | Default `/tmp/knowledgebase`. Used when `local_checkout` is empty for that target. |
| `team.git_remote` | string | Shared team GitHub repo URL (`git clone`); optional. |
| `team.local_checkout` | string | Path **relative to workspace** where the team repo is cloned; add to `knowledge_base.roots` for search. Empty = team file drafts use disk fallback only. |
| `personal.git_remote` | string | Personal (often private) repo URL; optional. |
| `personal.local_checkout` | string | Same for personal clone; empty = personal drafts under disk fallback. |

**On-disk layout (fallback, no clone):** `{disk_fallback_root}/{team|personal}/<category-or-session>/<filename>.md` — skills should use a sane slug for `<category-or-session>` (e.g. `intake`, `session-2025-04-26`).

**With Git:** clone the repo to `local_checkout`, commit/push yourself; jstack does **not** run `git clone` or `git push`.

See `jstack setup` (GBrain + knowledge step) to set these interactively.

## Example

```json
{
  "knowledge_base": {
    "roots": ["docs", "skills/_core/references", "config"],
    "include_globs": ["**/*.md", "**/*.json"],
    "exclude_globs": ["**/node_modules/**", "**/.git/**"],
    "doc_urls": [
      { "label": "API reference", "url": "https://example.com/docs/api", "note": "Public" }
    ],
    "github": {
      "repos": ["myorg/core-api", "myorg/frontend"],
      "search_issues": false,
      "prefer_readme": true
    },
    "retrieval": {
      "system_prompt": "Prefer ADRs in docs/adr for architecture. Cite file:line or doc URL.",
      "per_source": [
        { "id": "adrs", "match_substrings": ["/docs/adr/", "adr/"], "prompt": "If multiple ADRs conflict, list them and the newest wins unless superseded is stated." }
      ]
    },
    "gbrain": { "include": true }
  }
}
```

## Git-backed knowledge roots (local repo until `git push`)

Many teams keep **markdown or structured notes in the same git repo** as the plugin (or an adjacent workspace) — for example folders like `sessions/`, `plans/`, `.cursor/plans/`, or `tmp/` for drafts. Those directories are **not** magic: they only participate in retrieval when listed under `knowledge_base.roots` (paths relative to the **workspace root** or absolute).

- **jstack does not run `git push`.** Commit and push are your workflow; the agent only reads files present on disk.
- **Team vs personal:** Shared team notes can live in the team repo’s roots. Paths that must stay private (diary, personal session dumps) should **not** be committed to a shared repo — use a **personal config overlay** and/or roots outside the team remote; see `skills/_core/references/repo-and-privacy.md` and `config-team-vs-personal.md`.
- **Create missing roots:** If a root path does not exist yet, create the directory or remove it from config. `jstack doctor` warns when a configured root is missing on disk.
- **Setup wizard:** `jstack setup` can pre-fill example roots (`sessions`, `plans`, `tmp`, etc.); adjust to match your repo layout.

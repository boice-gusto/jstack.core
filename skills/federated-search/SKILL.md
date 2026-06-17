---
name: jstack-federated-search
description: Multi-provider federated search — selects N backends (Jira, Notion, Slack, GitHub, Glean, Google, DuckDuckGo, gbrain, knowledge_base, etc.) from the user query or explicit flags; delegates one constrained subagent (or isolated tool sweep) per provider; merges hits, ranks relevance to the question, structures a single answer. Supports --raw to skip synthesis. Reads jstack.config.json mcp_servers and integrations; does not invent credentials.
category: research
context: fork
agent: Explore
effort: high
---

<!-- Chain Contract -->
<!-- inputs: user_request, query, provider_list|null, raw_mode, jstack_config, MCP tools -->
<!-- outputs: merged_search_result (+ optional relevance summary) -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for

- **In scope:** “Search everywhere for X”, “what do we know about Y across wiki + tickets”, “same query on Jira **and** Notion **and** web”, synthesizing answers with **citations per source**. Prefer **parallel** subagents when the host supports them; otherwise run **sequential** pulls with identical per-provider caps.
- **Out of scope:** Writes (creating issues, posting Slack, editing Notion) — stop after retrieval unless a **different** skill is explicitly invoked afterward.

## When to invoke

- User names **multiple systems** or says **federated**, **combined search**, **search all**, **everything you can reach**.
- User passes **`--providers`** or natural-language scopes (internal vs external).

## Arguments (from `$ARGUMENTS`)

Parse in order; flags may repeat.

| Token / flag | Meaning |
|----------------|----------|
| `--providers <csv>` | Canonical ids: `jira`,`notion`,`slack`,`github`,`glean`,`google`,`duckduckgo`,`knowledge`,`gbrain`,`web` (see registry). |
| `--all-eligible` | All providers **both** inferred as relevant **and** present in config / MCP registry. |
| `--raw` | Emit **structured per-provider blocks only** — no synthesis section (still apply merge validation and omission of secrets). |
| `--max-hits <n>` | Soft cap per provider (default **20**, never unbounded). |
| (positional) | **Search query** — remainder of `$ARGUMENTS` after stripping known flags. If empty, ask **one** question: “What exactly should we search for?” |

**Provider selection logic**

1. If `--providers` is set → use that list intersected with **what is configured** (`mcp_servers`, `integrations`). Drop unknown ids with a **warning** line; do not fail the whole run.
2. Else if user **named** providers in prose → normalize via `${CLAUDE_PLUGIN_ROOT}/skills/federated-search/references/provider-registry.md`.
3. Else → infer providers from intent (registry doc) ∩ enabled integrations.
4. If the intersection is **empty** → say what is missing (`jstack doctor`, `jstack setup`) and offer **paste mode** (“Paste excerpts and I’ll structure them”).

Before spawning subagents: **restrict** the active MCP/tool surface to what those providers need (ask the host to load only relevant servers **when** the host requires it — describe which servers in one line).

## Procedure

### Step 1 — Load config

- Read `jstack.config.json`: `integrations`, `mcp_servers`, `skill_defaults`, `knowledge_base` if searching org KB.
- **Never** invent base URLs, tokens, or project keys.

### Step 2 — Normalize query

- Produce one **`canonical_query`** string for semantic alignment (user language preserved in output).
- For Jira, optionally derive a **narrow JQL** fragment; for Slack, derive **time_window** from user text or default **7d** with `[assumption]`.

### Step 3 — Delegate (parallel when possible)

For **each** selected provider, use a **dedicated subagent** (or sandboxed tool pass) with:

- **Inputs:** `canonical_query`, provider id, caps from `${CLAUDE_PLUGIN_ROOT}/skills/_core/best-practices/parallel-agents.md`.
- **Output:** Follow `${CLAUDE_PLUGIN_ROOT}/skills/federated-search/references/subagent-contract.md` (JSON wrapper + hits).

**Subagent prompt template** (adapt per backend — keep tools read-only):

```text
You are the <PROVIDER> search agent. Tools: only <PROVIDER>-related read/search.
Task: Find information relevant to: "<canonical_query>".
Return ONLY valid JSON matching subagent-contract.md ({ provider, query_used, hit_count, truncated, error, hits[] }).
Cap results at ${MAX}; set truncated:true if capped. No prose outside JSON.
```

### Step 4 — Merge and relevance (unless `--raw`)

1. **Deduplicate** — same URL or same issue key across lists → one merged hit with **`sources:[...]`** if needed.
2. **Rank** — sort by query overlap + recency + `confidence`; deprioritize empty snippets.
3. **Synthesize** — 6–12 bullet **answer** paragraphs max; each bullet must tie to **`title` + provider** (and link where present).
4. **Conflict handling** — if two sources disagree, surface both under **Conflicting signals** with links.

Accuracy: `${CLAUDE_PLUGIN_ROOT}/skills/_core/best-practices/accuracy-rules.md`

### Step 5 — Output shape

Unless `--raw`, use:

```markdown
## Federated search: <short restatement of query>

## Answer
- …

## Evidence by provider
### <provider>
| Title | Snippet | Link |
|-------|---------|------|
| … | … | … |

provider_payloads_ready: true

## Gaps / not searched
- …

## Suggested next
- Optional: `jstack:research-<subskill>` for deep dive, `jstack:notion-*` or `jstack:jira-*` after user confirms writes.
```

**`--raw` mode**

- Omit **## Answer** and **ranking prose**.
- Output **Evidence by provider** only, each block containing the **verbatim JSON** (pretty-printed) from subagents — still strip secrets/tokens.

**Eval helper line**

- `provider_payloads_ready: true` after every provider attempted or intentionally skipped **with reason**.

## Failure modes

| Symptom | Behavior |
|---------|----------|
| Provider disabled in config | Skip with `[provider: not configured]` |
| MCP 403 / timeout | One retry; then `error` in JSON; continue others |
| User wants “everything” but no MCPs enabled | Explain; offer paste fallback |

## References

- Providers + aliases: `${CLAUDE_PLUGIN_ROOT}/skills/federated-search/references/provider-registry.md`
- JSON contract: `${CLAUDE_PLUGIN_ROOT}/skills/federated-search/references/subagent-contract.md`
- Parallelism: `${CLAUDE_PLUGIN_ROOT}/skills/_core/best-practices/parallel-agents.md`
- Integration keys: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/integration-guide.md`
- Org KB: `${CLAUDE_PLUGIN_ROOT}/skills/knowledge/search/SKILL.md` when `knowledge` is selected

## User request

$ARGUMENTS

---
name: jstack-knowledge-search
description: Look up answers from configured knowledge sources (local paths, doc URLs, GitHub repos) using jstack.config.json knowledge_base — cite sources; do not guess from general knowledge when a source list exists. For storing notes use knowledge-intake, not this skill.
category: knowledge
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result with sources_cited -->
<!-- chains-to: jstack:knowledge-intake (only if user asks to save the answer) -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for

**Answer questions** by reading the team’s **declared** knowledge: workspace paths, public doc URLs, and optional GitHub repos in `jstack.config.json` → `knowledge_base`.

- **In scope:** Search/read under `roots`, follow `include_globs` / `exclude_globs`, use `retrieval.system_prompt` and `per_source` for citation and tie-break rules, optional GitHub context per `github.repos`, optional GBrain *supplement* when `gbrain.include` is true.
- **Out of scope:** Ingesting new notes (use `jstack:knowledge-intake`); building the team graph (use `jstack:team-knowledge`); replacing GBrain for session-wide memory (GBrain is still the product for *stored* team/personal memory — this skill is for **declared doc/repo scope**).

## GBrain: automatic or config?

- **GBrain** does **not** auto-index arbitrary GitHub or folders on disk. It uses your `gbrain` URLs and session target for the **GBrain app**.  
- **This skill** fixes “where should the agent look?” for **repositories and paths you name**. Set `knowledge_base.gbrain.include: true` when you want **both**: configured paths/URLs *and* a GBrain query for the same question.

## Domain rules — search

- If `knowledge_base` is missing or all arrays are empty, run the **config wizard** (see `skills/_core/references/config-wizard.md`): offer to add at least one `root` or `doc_url`, or point to `jstack:update-config`.
- **Never invent** citations. If the answer is not in the listed material, say so and name what you searched.
- Apply `exclude_globs` before spending tokens on large trees.
- For **private** GitHub repos, only use data the host can access (MCP, gh CLI, or user paste); do not assume read access.
- For **public** `doc_urls`, use fetch or approved MCP; respect robots and rate limits.

## Config and references

- `skills/_core/references/question-patterns.md` — open-ended clarifiers; `skills/_core/references/ask-user-question-patterns.md` — discrete source/scope pickers when the host supports it
- `skills/knowledge/search/references/config-shape.md` — full `knowledge_base` schema
- `skills/knowledge/references/gbrain-patterns.md` — GBrain URL + session target
- `skills/_core/references/config-wizard.md` — if config is empty
- `skills/_core/references/config-schema.md` — all config keys
- `skills/_core/references/integration-guide.md` — GitHub / MCP

## Intake

1. Parse the question in `$ARGUMENTS`.
2. Load `jstack.config.json` → `knowledge_base` and merge with `skill_defaults` for this skill if present.
3. If `gbrain.include` and session allows, note GBrain as an **additional** source, not a replacement for empty `roots`.

## Procedure

### Step 1 — Load sources

- Enumerate `roots` (read files with repo tools; respect `include_globs` / `exclude_globs`).
- Queue `doc_urls` for HTTP fetch (or MCP) when relevant to the question.
- If `github.repos` is non-empty, prioritize repo README and `docs/` when `prefer_readme` is true; use issue search only if `search_issues` is true and the question needs it.

### Step 2 — Plan retrieval

- Apply `retrieval.system_prompt` as the **behavior** for summarizing and citing.
- If any path/URL matches `per_source.match_substrings`, apply that entry’s `prompt` for those snippets.

### Step 3 — Optional GBrain

- If `gbrain.include` is true, add a short pass: what does GBrain (team/personal per `session.default_gbrain_target`) say? Label that section **GBrain** and keep path/URL citations separate.

### Step 4 — Synthesize

- Direct answer first, then **Sources** as a bulleted list: `path` or `URL` (and repo/issue if used).
- If partial: “Not found in knowledge base: …” + suggest adding a path to `knowledge_base.roots` or a URL to `doc_urls`.

### Step 5 — Hand off (optional)

- If the user wants the write-up stored, `suggested_next: jstack:knowledge-intake` with a copy-paste block.

## Output shape

- **Answer** — concise, grounded in sources.
- **Sources** — bullet list of files/URLs/issues used.
- **Gaps** — what you could not find in config (if any).
- `result_ok: true` if at least one relevant source was consulted or the config was empty and you explained how to set it; `result_ok: false` if the user required an answer and no sources were available and GBrain was off/empty.

## Failure modes

| Symptom | Recovery |
|--------|----------|
| `knowledge_base` empty | Wizard or `jstack:update-config`; do not answer from ungrounded web knowledge as “team truth”. |
| Path outside workspace | List in config must be under workspace or absolute paths the environment allows — ask to adjust. |
| GitHub 404 / no auth | State scope gap; user grants token or pastes. |
| Conflict between GBrain and files | Report both; `retrieval` prompts may say which wins. |

## Chaining

- Store findings → `jstack:knowledge-intake` or `jstack:knowledge-process`.
- Broad research → `jstack:research-technical` or other research skills, **after** you have checked `knowledge_base` if the user expects org-specific truth.

## User request

$ARGUMENTS

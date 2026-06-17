---
name: jstack-meetings-one-on-one-transcript
description: >-
  Paired 1:1 prep and after-meeting notes from configured transcript sources; prefer Lattice MCP when
  enabled, else Notion private PE or 1:1 parent pages; always append AI attribution.
category: meetings
arguments: [person_name]
argument-hint: [person-name]
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config, transcript_paths_or_paste -->
<!-- outputs: structured_result, optional_notion_or_lattice_write -->
<!-- chains-to: jstack-notion-one-on-one (Notion path) -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for

Run a **1:1 cycle** tied to **transcripts** (configurable sources or user paste):

| Phase | When | Input emphasis |
|-------|------|----------------|
| **Prepare** | Before the 1:1 | Prior transcripts + optional context from `jstack-meetings-prepare` / Jira |
| **After** | After the 1:1 | Current meeting transcript; decisions, actions, themes for next time |

- **Generate** agenda/summary/action items with the LLM, then **record** that the body is AI-assisted using `one_on_one_cycle.ai_attribution`.
- **Storage routing:** If **Lattice** is enabled in config **and** the host exposes Lattice-capable MCP tools (check `mcp_servers` / tool descriptors), use Lattice for 1:1 notes per official tool contracts. **Otherwise** use **Notion**, preferring **`notion_defaults.parent_pages.pe_index`** (private PE / management) when org policy or user asks for private notes; else **`one_on_ones`**.
- **Out of scope:** Scheduling calendar events, joining live calls, or storing raw audio without user consent.

## Domain rules — meetings

- Privacy: treat transcripts as **manager-report sensitive**; redact PII in any summary that might leave the private PE surface.
- Action items need **owner + due** when possible; otherwise `unassigned` + suggested follow-up.
- Never present invented Notion page IDs, Lattice record IDs, or URLs as verified — only config, tool results, or user paste.

## Config and references

- **`one_on_one_cycle`** — transcript roots, storage preference, Lattice label, Notion parent keys, attribution footer: `${CLAUDE_PLUGIN_ROOT}/skills/meetings/one-on-one-transcript/references/config-shape.md`
- **Lattice MCP (no bundled server)** — wiring expectations and fallback: `${CLAUDE_PLUGIN_ROOT}/skills/meetings/one-on-one-transcript/references/lattice-mcp-placeholder.md`
- **`notion_defaults.parent_pages`** — `pe_index`, `one_on_ones`, etc.
- Notion template strategy: `${CLAUDE_PLUGIN_ROOT}/skills/notion/references/notion-template-strategy.md`
- Integrations / MCP: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/integration-guide.md`
- Questions: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/question-patterns.md`
- Discrete choices: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/ask-user-question-patterns.md`
- Chaining: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/chaining-guide.md`

## Intake

1. Parse `$ARGUMENTS` for **phase**: `prepare` | `after` (if missing, ask **one** question).
2. Load `one_on_one_cycle` and `notion_defaults` from `jstack.config.json`.
3. Resolve **transcripts**:
   - If user pasted text → use as primary source for this run.
   - Else read files under `transcript_sources` the user/workspace can access (respect path safety; no exfiltration).
   - If no sources and no paste → ask for transcript or file path; do not fabricate meeting content.
4. If phase is **prepare**, optionally suggest chaining **`jstack-meetings-prepare`** for Jira/calendar-only context **after** transcript scan (user may decline).

## Procedure

### Step 1 — Lattice vs Notion

- If `one_on_one_cycle.lattice.enabled` is true **and** a matching MCP server exists with tools for 1:1 or employee notes:
  - Read tool schemas, then create/update the appropriate Lattice artifact; cite tool names in **Details**.
- Else (**default**):
  - Target parent = `notion_defaults.parent_pages[one_on_one_cycle.notion.private_pe_parent_key]` when user/org requires **private PE**, else `[parent_page_key]`.
  - Apply body and properties per **`jstack-notion-one-on-one`** (duplicate template or JSON mapping). Emit `suggested_next: jstack-notion-one-on-one` with a handoff block if the host should perform the Notion write in a follow-up turn.

### Step 2 — Draft content (phase-specific)

**Prepare**

- Pull themes, open questions, and carry-over actions from **prior** transcripts (and pasted context).
- Propose **agenda** (5–7 bullets), **topics to celebrate**, **risks/blockers**, **career/development** check-in prompts if relevant.

**After**

- From **this** meeting’s transcript: **decisions**, **action items** (owner, due), **feedback themes**, **next 1:1 hooks**.
- Link prior prep themes if the user supplied both prep and after in one session.

### Step 3 — AI attribution

- If `ai_attribution.append_to_generated_notes` is true, append `ai_attribution.footer_markdown` to every drafted page body or Lattice note body.
- In **Details**, include a line: `Provenance: AI-generated from transcript(s) [list paths or "user paste"]; human review required.`

### Step 4 — Validate

- No stray public Slack post of full transcript unless user explicitly asked and policy allows.
- Attribution present; storage path matches config intent.

### Step 5 — Summarize and hand off

- **Summary**, **Details**, **Next steps**, **Limitations**.
- If Notion write not done in-tool: `suggested_next: jstack-notion-one-on-one` with copy-paste payload (title, parent hint, body markdown).

## Output shape

- **Summary** (2–4 sentences)
- **Details** (bullets: phase, storage target, transcripts used, Lattice vs Notion)
- **Draft body** (markdown) or explicit pointer that follow-up skill will write it
- **Next steps** with owners
- **Limitations**
- For eval-gated runs: `result_ok: true` or `result_ok: false` + reason

## Failure modes

| Symptom | Recovery |
|---------|----------|
| Missing `one_on_one_cycle` | Use `config/defaults.json` shapes; label assumptions `[assumption]`. |
| Lattice enabled but no MCP tools | Fall back to Notion; state limitation clearly. |
| Empty transcripts | Ask for paste or path; stop. |
| Ambiguous phase | One question: prepare or after? |
| No Notion parent id | Point to `notion_defaults.parent_pages` setup; do not invent ids. |

## Chaining

- Notion path: `suggested_next: jstack-notion-one-on-one` with title, date, topics, action items, parent page key.
- Extra Jira context for prep only: optional `suggested_next: jstack-meetings-prepare`.

## User request

$ARGUMENTS

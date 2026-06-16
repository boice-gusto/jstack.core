# `one_on_one_cycle` — config shape

Use this block in `jstack.config.json` (see `config/defaults.json` for starter values).

## Fields

| Field | Purpose |
|-------|---------|
| `transcript_sources` | List of **workspace-relative** directories or file globs where transcripts (`.md`, `.txt`, or tool-specific exports) are read for context. Empty means rely on **user paste** or explicit paths in the request. |
| `primary_storage` | `"notion"` (default) or `"lattice"`. For Lattice, the host must expose working MCP tools; otherwise fall back to Notion automatically. |
| `lattice.enabled` | When `true`, the agent should **prefer** Lattice 1:1 flows if `mcp_servers` (or host MCP config) includes a server matching `lattice.mcp_server_label`. |
| `lattice.mcp_server_label` | String label you use in `mcp_servers` or host docs to identify the Lattice MCP (org-specific). No bundled server — see [`lattice-mcp-placeholder.md`](./lattice-mcp-placeholder.md). |
| `notion.parent_page_key` | Key under `notion_defaults.parent_pages` for the default 1:1 hub (often `one_on_ones`). |
| `notion.private_pe_parent_key` | Key for **private** performance / management index (often `pe_index`). Use when policy says PE notes must not live in the team-wide hub. |
| `notion.default_template_page_key` | Key under `notion_defaults.template_pages` for duplicate-from when a member has no `template_page_id` (often `one_on_one`). |
| `ai_attribution.append_to_generated_notes` | If `true`, append `footer_markdown` to every AI-drafted prep/after body. |
| `ai_attribution.footer_markdown` | Markdown block (e.g. horizontal rule + italic disclaimer). |
| `prepare_vs_after` | `prepare_title_suffix`, `after_title_suffix`, `link_transcript_paths_in_body` for consistent page titles and provenance. |

## Prepare vs after (1:1 pairing)

- **Prepare:** Summarize open themes from **prior** transcripts (and optional Jira/calendar context from other skills), propose agenda bullets, flag risks and follow-ups. Output is **pre-meeting**.
- **After:** From the **current** meeting transcript (paste or newest matching source), extract decisions, action items (owner + due), and themes for the **next** cycle. Output is **post-meeting**.

Both phases should reference **which transcript files** informed the draft when `link_transcript_paths_in_body` is true (paths only, no secrets).

## Routing rule

1. If `lattice.enabled` and Lattice MCP tools are available → use Lattice per tool schemas; document the operation in the summary.
2. Else → create or update Notion under the parent from `notion_defaults.parent_pages[private_pe_parent_key]` or `[parent_page_key]` as appropriate; use **`jstack-notion-one-on-one`** for property/body patterns.

**Per-person parents:** When `team.members[]` includes **`notion.one_on_one_parent_page_id`** for the relevant person, create prep/after pages **under that page** (or as children per org convention). When **`notion.template_page_id`** is set for that member, duplicate from that page for new cycles; otherwise duplicate from `notion_defaults.template_pages[default_template_page_key]`.

Roster + group identity: [`skills/team/references/team-canonical-identity.md`](../../team/references/team-canonical-identity.md).

Never invent API endpoints or page IDs — only config and user-supplied URLs.

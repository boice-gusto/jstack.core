# {{team_name}} Private Vault

_Manager-only scratchpad. Lives at workspace-root, NOT inside the team teamspace._

## What goes here

- Private observations, half-formed thoughts, drafts you're not ready to share
- Meeting transcripts and AI summaries (raw, before they become team-visible notes)
- Performance / 1:1 prep notes that aren't ready for `pe_index`
- Personal project / sprint scratch — separate from `team_hub` Tasks DB
- Links and clippings that haven't found a permanent home yet

## What does NOT go here

- Anything the team should see (use `team_hub` instead)
- Final ADRs, runbooks, specs (those go in `Documents` DB or `Wiki`)
- Confidential HR data — keep that in your org's HR system, not Notion

## Sections

- **Scratchpad** — quick captures, inbox
- **Notes** — working notes, private decision log
- **Data** — links, embeds, raw tables
- **Transcripts** — meeting transcripts + AI summaries
- **Projects** — private project scratch
- **Sprints** — private planning + retro scratch

## Routing

jstack skills resolve where to post via `notion_defaults.post_targets`. Default routings:

| Artifact kind | Lands here |
|---|---|
| `scratchpad` | Scratchpad |
| `transcript` | Transcripts |
| `transcript_summary` | Transcripts |
| `meeting_notes` | Notes |
| `project` (private) | Projects |
| `sprint` (private) | Sprints |

Override per-team in `jstack.config.json` only.

---

_Wired by `jstack-notion-setup` — `notion_defaults.parent_pages.private_root` (catalog: `private_vault/private_root`)_

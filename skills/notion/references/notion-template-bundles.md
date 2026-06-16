# Notion template bundles — picker reference

Skill-callable reference for `jstack-notion-setup` (and any sub-skill that wires `golden_pages`). When the user wants polished marketplace designs instead of the catalog's markdown defaults, this doc lays out the available `.zip` bundles and the import-then-wire workflow.

## When to surface this

- During `/jstack:notion setup`, after the catalog preview but before creation, if the user asks "can I get the marketplace design?".
- During follow-up setup runs when the user wants to upgrade specific entries from catalog markdown to marketplace fidelity.
- When `notion_defaults.golden_pages.*` is empty AND a corresponding bundle exists.

## Available bundles

Bundles live at `templates/` (next to this file) — see `templates/README.md` for full description. Quick map:

| Bundle | Catalog target | What you get from it | Worth importing? |
|---|---|---|---|
| `notion-company-pack.zip` | `company_team_page` | Multi-DB hub with embedded gallery views | ✅ yes — marketplace design hard to recreate |
| `notion-kanban-agile-sprint.zip` | `kanban` | Sprint kanban with configured Board / Calendar views | ✅ yes — view config can't come from SQL |
| `notion-projects-and-tasks.zip` | `product_tasks` | Two linked DBs (Projects ↔ Tasks) with sample data | ✅ yes — relations + samples |
| `notion-1x1-meeting.zip` | `one_on_one_template` | Static 1:1 layout with Key Deliverables tables | 🟡 optional — catalog has prompt-driven adaptive version |
| `notion-team-task-tracker.zip` | `team_task_tracker` _(no catalog entry yet)_ | Light kanban variant | 🟡 optional — smaller alternative to full kanban |

## Picker question to ask the user

If the user's intent is unclear, ask **one** question:

> Which design do you want for `<template_id>`?
> 1. **Catalog default** — jstack-authored markdown, fully programmatic, no extra steps. Less visually rich.
> 2. **Marketplace bundle** — import the `notion-<name>.zip` once, paste page id into `golden_pages.<key>`, get the marketplace design with configured views and sample data. Adds one manual import step.
> 3. **Custom golden** — author your own page in Notion and use it. Same wiring as #2.

Default if user doesn't specify: option 1 (catalog) for the first run, then surface option 2 in the next-steps summary as an upgrade path.

## Workflow when user picks bundle import

1. **Tell them** the absolute path of the zip: `${CLAUDE_PLUGIN_ROOT}/skills/notion/references/templates/notion-<name>.zip`.
2. **Walk them through Notion's import UI:**
   - Notion → Settings → Workspace → Import → choose Notion → upload the zip.
   - A new page tree appears in their Private workspace (or the section they imported into).
3. **Ask them to paste** the URL of the imported root page.
4. **Extract page id** from the URL, write it to `notion_defaults.golden_pages.<catalog_id>`.
5. **Confirm + re-run setup** for that template:
   - On next `/jstack:notion setup`, the entry's resolution path picks up `golden_pages.<id>` and `notion-duplicate-page`s from it (preserves the marketplace design).
6. **Optional: trash the imported original** after setup duplicates it — the duplicate becomes the wired entity.

## What NOT to do

- ❌ Don't tell the user to upload the zip via the Notion API or MCP — Notion's API has no import endpoint. Bundles only import via Notion UI.
- ❌ Don't try to extract the markdown from the zip and recreate via `notion-create-pages` — the zip is a Notion-internal format with markdown + CSVs that don't preserve view config / embeds. Use the import path or stick to catalog markdown.
- ❌ Don't add bundles for templates the user can already get cleanly from the catalog (plain page hubs, simple wikis). Bundles are for marketplace designs that beat what the API can build.

## Adding a new bundle

1. User exports a Notion page tree (Notion → page → … → Export → Markdown & CSV → "Include subpages" → download).
2. Place the resulting zip at `skills/notion/references/templates/notion-<id>.zip`.
3. Add a row to `templates/README.md` (description + catalog target + recommendation).
4. Add a row to the **Available bundles** table here.
5. If it maps to a NEW catalog id (not yet in `templates/notion/catalog/<set>.json`), add the catalog entry too — see `notion-template-catalog.md`.

## Cross-references

- `templates/README.md` — bundle index with marketplace URLs + import steps
- `notion-template-catalog.md` — catalog format + hybrid `golden_pages` resolution
- `notion-components.md` — page format components (used when catalog falls back to markdown)
- `notion-page-format-rules.md` — eval rubric (icon / cover / opening pattern required)
- `notion-vault-and-routing.md` — surface routing + teamspace anchor rule

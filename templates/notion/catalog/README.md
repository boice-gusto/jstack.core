# Notion template catalog — reference

This directory is jstack's typed registry of Notion page + database templates. The setup skill `jstack-notion-setup` reads it to materialize the team HQ + private vault + 1:1 trees in Notion and wire ids back into `jstack.config.json`.

## Quick map

```
templates/notion/catalog/
├── README.md                                # this file
├── private_vault.json                       # always-loaded private vault set (7 pages)
├── private_vault/
│   ├── private_root.md
│   ├── private_scratchpad.md
│   ├── private_notes.md
│   ├── private_data.md
│   ├── private_transcripts.md
│   ├── private_projects.md
│   └── private_sprints.md
├── official.json                            # default team set (Notion marketplace mirror, 11 entries)
├── official/
│   ├── company_team_page.md                 # static page content
│   ├── product_strategy.md
│   ├── product_wiki.md
│   ├── meeting_notes.md
│   ├── one_on_ones_hub.md
│   └── one_on_one_template.prompt.md        # prompt-driven template (content_kind: "prompt")
├── alternative_sentele.json                 # registry of Sentele Pro templates (some content TODO)
└── alternative_sentele/                     # (markdown files added as templates are authored)
```

## Three sources for what gets created

When `/jstack:notion setup` runs, each template entry is created from one of three sources (resolution order, first hit wins):

1. **Golden duplicate** — `notion_defaults.golden_pages[<template_id>]` set → `notion-duplicate-page` from that workspace page id. Preserves visually-rich layouts.
2. **Catalog markdown / SQL** (this directory) — falls through to the .md / .prompt.md / SQL DDL declared here.

The user picks which by leaving a `golden_pages` key empty (use catalog) or pasting an id (use golden). Three ways a golden gets into the workspace:

- **Bundled marketplace export** — pre-shipped `.zip` files at `skills/notion/references/templates/notion-*.zip`. User imports via Notion UI (Settings → Import), pastes page id. See `skills/notion/references/notion-template-bundles.md` for the picker.
- **User-authored** — user opens a catalog-built page, customizes it (views, embeds), pastes id back.
- **Marketplace duplicate** — user clicks "Duplicate" on a marketplace template URL in browser, pastes the resulting workspace page id.

## Hybrid: catalog defaults + user-authored goldens

At setup time, every template runs through this resolution order:

1. **Golden duplicate** — `notion_defaults.golden_pages[<template_id>]`. If a workspace page id is set there, the setup skill duplicates it (preserves layouts the API can't reproduce: configured DB views, gallery, embedded blocks).
2. **Catalog content** — falls through to the markdown / SQL defined here.

To add a golden:
1. Run setup once with the catalog defaults to get the page or DB created.
2. Customize layout / views / embeds in Notion UI.
3. Paste the page id into `golden_pages.<template_id>`.
4. Re-run setup — subsequent runs duplicate from your golden.

Recommended targets for goldens (visually rich, hard via API): `company_team_page`, `kanban`, `product_strategy`, `product_wiki`. Skip for plain page hubs (private_*).

## Set selection

`jstack.config.json → notion_defaults.template_set` selects the **active team set** (default `official`).

The `private_vault` set is **always loaded**, regardless of the active team set, because the private surface is consistent across orgs.

## Authoring formats

### Static markdown (`<id>.md`)

Plain Notion-flavored Markdown. Placeholders like `{{team_name}}` are substituted at setup time. The substituted markdown is sent verbatim to `notion-create-pages`.

Use when:
- The page content doesn't depend on per-org context beyond simple substitution.
- You want bit-for-bit identical output across setups.

### Prompt-driven markdown (`<id>.prompt.md`, `content_kind: "prompt"`)

The `.prompt.md` file is a **prompt for the setup agent**, not the page body. The agent reads the prompt, combines it with config inputs, and generates the actual page body at setup time.

Use when:
- Output should adapt to org config (cadence, tone, naming conventions).
- The page is structurally consistent but the wording should match the team's voice.

Example: `official/one_on_one_template.prompt.md` — the structure of a 1:1 page is consistent, but the tone and section emphasis varies between orgs.

### Database (`kind: "database"`)

No content file. The `schema` field on the catalog entry is SQL DDL passed to `notion-create-database`. Both the database id and the data_source (collection) id get captured back into config — the latter is what query/update tools want.

## Surfaces

Every entry declares a `surface`:

| Surface | Lands at | Resolved via |
|---|---|---|
| `team_hub` | Notion teamspace anchor page | `notion_defaults.team_notion.teamspace_anchor_page_id` |
| `private_vault` | Workspace-root (private) | (no parent) |
| `one_on_ones` | typically inside team_hub, sometimes private | `notion_defaults.surface_routing.one_on_ones` |
| `standalone` | wherever the user picks at setup time | (asked at setup time) |

Surface routing is enforced by the setup skill — it refuses to create team-side artifacts without a teamspace anchor, and refuses to put private vault entries inside a teamspace.

## Adding to a set

1. Add an entry to the set's JSON file (matching `NotionTemplateSchema` in `cli/src/lib/notion-templates/types.ts`).
2. For page-kind entries, create the corresponding `<id>.md` (or `<id>.prompt.md`) under the set's directory.
3. Run the loader smoke test (or `jstack doctor`) to validate.

## Adding a new set

1. Create `templates/notion/catalog/<my_set>.json` with `id`, `name`, `description`, `source`, `templates[]`.
2. Create `templates/notion/catalog/<my_set>/` and author the content files.
3. Set `notion_defaults.template_set = "<my_set>"` to make it active.
4. The `private_vault` set continues loading alongside.

## Validation

- TypeScript types: `cli/src/lib/notion-templates/types.ts` (Zod schemas).
- Loader: `cli/src/lib/notion-templates/index.ts`.
- The loader rejects unknown fields under set metadata, but `passthrough()` is permitted on individual templates so org-specific extras don't fail validation.

## See also

- Setup workflow: `skills/notion/setup/SKILL.md`
- Config keys reference: `skills/notion/references/notion-vault-and-routing.md`
- Page format conventions: `skills/notion/references/notion-page-format-rules.md`
- Catalog reference (longer): `skills/notion/references/notion-template-catalog.md`

# Notion template catalog — format and surface routing

The catalog is jstack's typed registry of Notion templates. `jstack-notion-setup` reads it, the user picks one set as active via `notion_defaults.template_set`, and skills create pages from it.

## Why a catalog

- **API limitation**: Notion's API can't duplicate marketplace templates. Anything we want available via setup must be authored in the catalog.
- **Surface awareness**: each template knows whether it belongs in the team-side teamspace (`team_hub`), the private vault, the 1:1 hub, or workspace-root. The setup skill uses this to pick the right parent.
- **Stable config keys**: each template names its own `config_key` (e.g. `parent_pages.product_strategy`). Skills resolve runtime parents from this — config is the source of truth, not the page tree.

## File layout

```
templates/notion/catalog/
├── README.md                           # colocated reference (mirrors this doc, shorter)
├── private_vault.json                  # ALWAYS-LOADED private vault set (7 pages)
├── private_vault/
│   ├── private_root.md
│   ├── private_scratchpad.md
│   ├── private_notes.md
│   ├── private_data.md
│   ├── private_transcripts.md
│   ├── private_projects.md
│   └── private_sprints.md
├── official.json                       # default team set + 1:1 entries
├── official/
│   ├── company_team_page.md            # page content (content_kind: "static")
│   ├── product_strategy.md
│   ├── product_wiki.md
│   ├── meeting_notes.md
│   ├── one_on_ones_hub.md
│   └── one_on_one_template.prompt.md   # prompt-driven (content_kind: "prompt")
├── alternative_sentele.json
└── alternative_sentele/
    └── (markdown files for sentele-set page templates as they are authored)
```

One JSON file per set. The set's directory holds page-content `.md` files referenced by `content_path`. The `private_vault` set is loaded **regardless of `template_set`** — the private surface is shared across orgs.

## Set schema

```jsonc
{
  "id": "official",                          // snake_case ascii
  "name": "Notion Official",
  "description": "Functional equivalents of Notion's marketplace official set …",
  "source": "marketplace-mirror",            // jstack-builtin | marketplace-mirror | custom
  "templates": [ /* see Template schema */ ]
}
```

## Template schema

Common fields:

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | snake_case string | yes | Unique within set |
| `kind` | `page_dashboard` \| `page_hub` \| `page_template` \| `database` | yes | |
| `title` | string | yes | Page or database title shown in Notion |
| `surface` | `team_hub` \| `private_vault` \| `one_on_ones` \| `standalone` | yes | Where it lands |
| `config_key` | string | yes | Dotted path under `notion_defaults` (e.g. `parent_pages.product_wiki`) |
| `marketplace_url` | url | no | Reference only — not auto-fetched |
| `note` | string | no | Customization rationale |

Page kinds (`page_dashboard`, `page_hub`, `page_template`) add:
- `icon` — emoji string
- `content_kind` — `"static"` (default) or `"prompt"`. See **Authoring formats** below.
- `content_path` — relative path under the set directory to the content file.

`database` kind adds:
- `description` — Notion database description
- `schema` — SQL DDL string passed to `notion-create-database`
- `data_source_config_key` (optional) — separate config key for the collection id (recommended; query/update tools want the collection id)

## Authoring formats

### Hybrid resolution (golden_pages → catalog)

At setup time, every template runs through this resolution order:

1. **Golden duplicate** — if `notion_defaults.golden_pages[<template_id>]` is non-empty in `jstack.config.json`, the setup skill `notion-duplicate-page`s from that workspace page id, then renames + moves it to the right parent. This preserves layouts the API can't reproduce (configured DB views, gallery, embedded blocks, marketplace-styled dashboards).
2. **Catalog content** — falls through to the catalog-driven path (markdown for pages, SQL DDL for databases) described below.

### Marketplace template bundles (`templates/*.zip`)

For users who want marketplace designs as goldens, jstack ships pre-exported `.zip` bundles at `skills/notion/references/templates/`. The user imports a bundle into their Notion workspace via the Notion UI (the API has no import endpoint), pastes the resulting page id into `golden_pages.<id>`, and subsequent setups duplicate from there.

See `notion-template-bundles.md` for the picker UX and import workflow.

Convention: `golden_pages` keys are catalog template ids. So a golden Kanban page is at `golden_pages.kanban`, a golden Wiki at `golden_pages.product_wiki`, etc. The schema lists 19 default keys (one per template in the official + private_vault sets); add more by hand if you ship custom catalog entries.

The hybrid is **opt-in per template**: leave a key empty to use the catalog default, paste a workspace page id to override.

### `content_kind: "static"` (default)

The `.md` file is **the page body verbatim**, after placeholder substitution. The setup skill substitutes `{{team_name}}`, etc., then sends the result to `notion-create-pages`. Use when output should be identical across setups.

Example: `official/company_team_page.md`.

### `content_kind: "prompt"` (file ends in `.prompt.md`)

The `.prompt.md` file is **a prompt for the setup agent**, not the page body. The agent reads the prompt, combines it with config (team name, cadence, tone settings, etc.), and generates the actual page body at setup time. Use when the page should adapt to org-specific context beyond simple substitution.

Example: `official/one_on_one_template.prompt.md`.

Conventions for `.prompt.md` files:
- Top section: list available placeholders / inputs.
- Middle: explicit generation instructions for the agent (sections, ordering, conventions).
- Bottom: constraints (markdown only, no PII, max length, etc.) and rationale ("why this is prompt-driven and not static").

## Surface routing

The active config decides which Notion location each surface resolves to:

```jsonc
"notion_defaults": {
  "surface_routing": {
    "team_hub": "team_notion",        // → notion_defaults.team_notion.teamspace_anchor_page_id
    "private_vault": "private_vault", // → workspace-root (no parent)
    "one_on_ones": "team_notion"      // typically same as team_hub
  }
}
```

A template with `surface: "team_hub"` lands under the resolved team anchor. A template with `surface: "private_vault"` lands at workspace-root. The setup skill enforces this.

## Adding a custom set

1. Create `templates/notion/catalog/<my_set>.json` matching the Set schema.
2. For each `page_*` entry, create `templates/notion/catalog/<my_set>/<template_id>.md`.
3. Set `notion_defaults.template_set = "<my_set>"` in `jstack.config.json`.
4. Re-run `/jstack:notion setup` — it'll preview what it'll create from the new set.

The CLI loader (`cli/src/lib/notion-templates/index.ts`) validates each set against `NotionTemplateSetSchema` (Zod) at load time. If validation fails, `jstack doctor` surfaces the error.

## Placeholders in content

Page-content `.md` files may use these substitutions (rendered by the setup skill before sending to `notion-create-pages`):

| Placeholder | Source |
|---|---|
| `{{team_name}}` | `team.name` |
| `{{team_canonical_display_name}}` | `team.canonical_group.display_name` |
| `{{primary_member_id}}` | `team.members[0].id` (often same as the user's id) |

Skills may add more; document any new placeholder here.

## Migration / divergence

When a set is updated, **existing** pages in the user's Notion workspace are NOT modified. The catalog defines what *new* setups look like. To bring an existing surface up to date, either:
- Manually edit the affected pages in Notion, or
- Delete (trash) and re-run `/jstack:notion setup` (config ids point to the new pages on rebuild).

## Related

- `skills/notion/setup/SKILL.md` — the setup workflow
- `skills/notion/references/notion-vault-and-routing.md` — surface + parent_pages keys + the teamspace rule
- `skills/notion/references/notion-page-format-rules.md` — formatting conventions
- `cli/src/lib/notion-templates/types.ts` — Zod types
- `cli/src/lib/notion-templates/index.ts` — CLI loader

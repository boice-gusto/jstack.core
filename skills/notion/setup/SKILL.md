---
name: jstack-notion-setup
description: Build a Notion team HQ + private vault tree from the typed template catalog. Surface-aware: team-side artifacts must land inside a Notion teamspace (via anchor page), private vault stays workspace-private. Wires all ids back into jstack.config.json.
category: notion
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config, optional template_set override -->
<!-- outputs: structured_result with created page urls + config diff -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for

Stand up the Notion structure that all other jstack notion skills depend on, by walking the **typed template catalog** under `templates/notion/catalog/`. Result: parent pages, databases, and template pages exist in Notion, and `jstack.config.json` knows their ids by stable logical key.

**In scope:**
- Picking the active template set (`official` by default, `alternative_sentele` registered, custom sets supported)
- Creating team-side artifacts under a Notion **teamspace anchor page** (required — see Hard Rule below)
- Creating the private-vault tree at workspace-root (private)
- Wiring every created id into `notion_defaults.parent_pages.*`, `database_ids.*`, `template_pages.*`
- Setting `private_vault.setup_complete` and `team_notion.setup_complete`

**Out of scope:**
- Workspace membership, public sharing, export settings
- Creating actual pages from the **marketplace** URLs (Notion API has no marketplace duplicate endpoint — see "Marketplace limitation" below)

## Hard rules

### 1. Visual hard rules (every page jstack creates)

Every page MUST have **icon** + **cover** + **canonical opening** (colored H1 + matching colored callout). No exceptions. Catalog entries declare `icon`, `cover`, and `header_color`. Setup MUST pass these to `notion-create-pages`. See `references/notion-components.md` "Hard rules" + "Color themes by surface" and `references/notion-page-format-rules.md` "Hard requirements".

If a catalog entry is missing any of icon / cover / header_color, **stop and add them** before creation — don't create incomplete pages.

### 2. Team HQ goes in a Notion teamspace

The Notion MCP `notion-create-pages` and `notion-create-database` tools accept **only** these parent types: `page_id`, `database_id`, `data_source_id`, or omitted (which makes pages workspace-private). **There is no `teamspace_id` parent type.**

Consequence: to put `team_hub` and team-side databases inside a Notion teamspace, the user MUST create one empty **anchor page** inside the teamspace via Notion UI and paste its id into `notion_defaults.team_notion.teamspace_anchor_page_id`. This skill then uses that anchor as the parent for the entire team tree.

If `teamspace_anchor_page_id` is empty AND the user can't paste one, **stop**. Do not silently fall back to workspace-private — that leaks team-visible artifacts into private space and is the failure mode from prior runs. See `references/notion-vault-and-routing.md`.

### 3. Marketplace limitation

The user may reference Notion marketplace template URLs (e.g. company-pack, kanban-board). The API cannot duplicate marketplace pages. The catalog's `template_set` (default `official`) ships **functional equivalents** authored from scratch — they cover the same use cases but are not pixel-identical. The `marketplace_url` field on each template is reference-only.

If the user wants the literal marketplace design, the only path is: user clicks "Duplicate" in the browser, pastes the resulting workspace URLs, this skill `notion-move-pages` them under the right parent.

## Config and references

- `jstack.config.json` — `notion_defaults.template_set` selects the catalog set; `team_notion.teamspace_anchor_page_id` gates team-side creation.
- Catalog system: `${CLAUDE_PLUGIN_ROOT}/templates/notion/catalog/<set>.json` + `<set>/<template_id>.md`
- **Components reference** (READ FIRST): `${CLAUDE_PLUGIN_ROOT}/skills/notion/references/notion-components.md`
- Page format / eval checklist (READ SECOND): `${CLAUDE_PLUGIN_ROOT}/skills/notion/references/notion-page-format-rules.md`
- Catalog reference: `${CLAUDE_PLUGIN_ROOT}/skills/notion/references/notion-template-catalog.md`
- **Template bundles picker** (when user wants marketplace designs): `${CLAUDE_PLUGIN_ROOT}/skills/notion/references/notion-template-bundles.md` + `templates/` zip bundles
- Vault routing + the teamspace rule: `${CLAUDE_PLUGIN_ROOT}/skills/notion/references/notion-vault-and-routing.md`
- Roster + canonical group: `${CLAUDE_PLUGIN_ROOT}/skills/team/references/team-canonical-identity.md`
- Question patterns: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/question-patterns.md`

## Procedure

### Step 1 — Load config + catalog

Read these from `jstack.config.json`:
- `notion_defaults.template_set` (default `official`)
- `notion_defaults.template_catalog_path` (default `templates/notion/catalog`)
- `notion_defaults.team_notion.teamspace_anchor_page_id`
- `notion_defaults.private_vault.setup_complete`, `team_notion.setup_complete`
- `team.name`, `team.canonical_group.display_name` (for content placeholders)

Load **both** catalog sets:
- `${CLAUDE_PLUGIN_ROOT}/templates/notion/catalog/<template_set>.json` — the active team set (team_hub + one_on_ones surfaces)
- `${CLAUDE_PLUGIN_ROOT}/templates/notion/catalog/private_vault.json` — always-loaded private surface (private_vault surface)

Each entry has `id`, `kind`, `title`, `surface`, `config_key`, optional `icon`, optional `content_kind` (`static` default, or `prompt`), optional `content_path`, optional `schema`. For `content_kind: "prompt"` entries, the `.prompt.md` file is a prompt the agent expands into the page body at setup time using team + roster context.

### Step 2 — Gate on the teamspace anchor

If `team_notion.teamspace_anchor_page_id` is empty:
1. Tell the user the teamspace rule (one short paragraph + the API limitation).
2. Ask them to create one empty page inside their target teamspace via Notion UI and paste the URL.
3. Extract the page id from the URL, write it to `notion_defaults.team_notion.teamspace_anchor_page_id`.

If the user refuses or can't, **stop**. Mark `team_notion.setup_complete = false` and surface the gate as a required next step. Do not create team-side pages without an anchor.

### Step 3 — Plan + confirm before creating

Build a preview table of what will be created: catalog id → kind → title → surface → resulting `config_key`. Show the user the table and the parent each entry will land under (anchor for team_hub, workspace-root for private vault). Confirm.

### Step 4 — Execute

Order of operations:

**Pre-flight check (every template):** verify `icon`, `cover`, and `header_color` are populated in the catalog metadata. If any is missing, stop on that template and report — do not call `notion-create-pages` without them.

For each template, resolve **how to create** in this order (first hit wins):

1. **Golden duplicate** — look up `notion_defaults.golden_pages[<template_id>]`. If non-empty, that's a Notion page id the user has authored as the canonical golden source.
   - For pages: `notion-duplicate-page` from that id, then `notion-update-page` to set the title (placeholder-substituted) and `notion-move-pages` to put it under the right parent (anchor / private root / etc.).
   - For databases: `notion-duplicate-page` works on database pages too — preserves configured views, properties, sample rows. Move to the right parent and rename.
   - This path is the one to use when the marketplace design or specific view configuration matters (gallery, kanban, calendar views can't be set via API alone).
2. **Catalog content** — fall through to catalog-driven creation:
   - `static` content_kind: read the `.md` file, substitute placeholders (`{{team_name}}`, `{{team_canonical_display_name}}`, `{{primary_member_id}}`, plus any catalog-defined ones), send to `notion-create-pages`.
   - `prompt` content_kind: read the `.prompt.md` file, treat it as instructions, generate the actual page body using available config (cadence, suffixes, tone preferences), then send the generated body.
   - For databases: `notion-create-database` with the SQL DDL from `schema`.

If `golden_pages[<id>]` is set but the page is trashed or inaccessible, log the gap and **fall back to catalog content** rather than fail closed — surface the broken golden in the final report.

Order of operations:

1. **Team-side pages first** (templates with `surface: "team_hub"` from the active team set) under the teamspace anchor. Use `notion-create-pages` with `parent: { type: "page_id", page_id: <anchor_id> }`.
2. **Team-side databases** (`kind: "database"`, `surface: "team_hub"`) under `team_hub` (the page id you just created). Use `notion-create-database` with the SQL DDL from `schema`. Capture both the database id (from URL) and the data_source id (from `<data-source>` tag) — the latter is what query/update tools want.
3. **One-on-ones surface** (templates with `surface: "one_on_ones"` from the active team set): land under `team_hub` if `surface_routing.one_on_ones === "team_notion"`, else under workspace-root. Includes the hub page and any `page_template` entries (e.g. `one_on_one_template`).
4. **Private vault** (templates with `surface: "private_vault"` from the always-loaded `private_vault` set) at workspace-root: omit `parent` to land them as private. The root entry (`private_root`) goes first, then its children with the root as parent.
5. **Per-direct-report 1:1 pages**: for each `team.members[]`, create a child page under `parent_pages.one_on_ones` and write the id back to `team.members[].notion.one_on_one_parent_page_id`.

Validate page shape per `notion-page-format-rules.md`.

### When to recommend authoring goldens

After a fresh setup, suggest the user author Notion goldens for the visually-rich entries (typically: `company_team_page`, `kanban`, `product_strategy`, `product_wiki`). They can:
1. Open the catalog-built page or DB.
2. Customize layout / views / embeds in Notion UI.
3. Paste the page id into `notion_defaults.golden_pages.<id>`.
4. Re-run `/jstack:notion setup` — the next setup uses the authored golden.

Skip the suggestion for plain page hubs (`private_*`, `meeting_notes` template, etc.) — markdown is sufficient and adds no value to author by hand.

### Step 5 — Wire config

Atomic write back to `jstack.config.json`:
- `notion_defaults.parent_pages.<key>` for every page entry from the catalog (resolve `config_key` against the config tree).
- `notion_defaults.database_ids.<key>` (database) AND `<key>_data_source` (collection) for every database entry.
- `notion_defaults.template_pages.<key>` for every `page_template` entry.
- Set `private_vault.setup_complete = true`, `team_notion.setup_complete = true`.
- For each team member: `team.members[].notion.one_on_one_parent_page_id`.

Use `jq` (or equivalent) for atomic JSON rewrites. Never leave placeholder fake UUIDs — empty string until the real id is known.

### Step 6 — Validate

Run `jstack doctor` (or `bun run scripts/validate-config.ts`). Report:
- ✅ which surfaces are now `setup_complete`
- ⚠ which `parent_pages` / `database_ids` / `template_pages` keys are still empty
- 🔗 Notion URLs for everything you created

### Step 7 — Hand off

Suggest the next jstack skill if the work naturally continues (e.g. `/jstack:notion sprint` to add the first sprint page, `/jstack:team` to flesh out roster, `jstack setup --pe` to wire `pe_index`). Add a `suggested_next: <skill-name>` line.

## Output shape

```
## Notion setup — <team_name>

### Active set
<template_set> (<set.name>)

### Created
| catalog id | kind | title | surface | config_key | url |
|---|---|---|---|---|---|

### Config writes (jstack.config.json)
- notion_defaults.parent_pages.<keys>
- notion_defaults.database_ids.<keys>
- notion_defaults.template_pages.<keys>
- private_vault.setup_complete = true
- team_notion.setup_complete = true
- team_notion.teamspace_anchor_page_id = <id>

### Validation
<jstack doctor output>

### Limitations
- (any catalog entries skipped, unused keys, etc.)

### Next
suggested_next: <skill>
```

## Failure modes

| Symptom | Recovery |
|---------|----------|
| `teamspace_anchor_page_id` empty + user can't provide | Stop. Don't create team-side pages. Set `team_notion.setup_complete = false`. Tell user how to create an anchor in Notion UI. |
| Catalog set id not found | List available sets from `templates/notion/catalog/*.json`; ask user to pick one or define custom. |
| Catalog JSON fails schema validation | Surface the path + zod error; do not invent fields. |
| `content_path` references a missing .md file | Stop on that template; complete the rest; report the gap. |
| Notion 400 "Can't edit block that is archived" | Parent page was trashed since last run. Refetch parent state and rebuild. |
| Notion 403 / auth expired | Tell user to re-authenticate the Notion MCP. Never print secrets. |
| Database `data_source_config_key` set but tool returned no collection id | Capture only the database id; warn the user — query/update tools may fail until the data_source id is captured. |
| Existing live config has competing keys (legacy + catalog) | Diff first, ask user before overwriting. Prefer additive merges. |
| `golden_pages[<id>]` set but page trashed / inaccessible | Log the broken golden, fall back to catalog content_path / schema, surface gap in final report. |
| `golden_pages[<id>]` is a marketplace URL not a workspace page id | Reject — only workspace pages can be duplicated. Tell the user to "Duplicate" the marketplace template into their workspace first, then paste the resulting workspace id. |

## Chaining

Complete the work here. If a natural follow-up exists, add `suggested_next: <skill-name>` with a copy-paste handoff block. Common next: `/jstack:notion adr`, `/jstack:notion sprint`, `/jstack:team`, `jstack setup --pe`.

## User request

$ARGUMENTS

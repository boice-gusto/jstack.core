# Notion page format rules (for authors and evals)

Use this checklist when **creating** or **reviewing** Notion pages from jstack skills so output is consistent and eval-gated runs can assert shape without guessing.

## Scope

Applies to pages created or updated via **Notion sub-skills**, transcript → Notion flows, catalog-driven setup, and manual pages that should match the **team template bundle**.

## Hard requirements — every page jstack creates

These four rules are non-negotiable. A page that violates any of them is incomplete:

1. **Icon** — every page MUST have an icon (emoji `🏢`, custom emoji `:rocket:`, or external image URL). Pages without icons look unfinished in the Notion sidebar.
2. **Cover** — every page MUST have a cover (external image URL). Use Notion built-in gradients matching the surface's color theme — see `notion-components.md` "Color themes by surface". Drives the "solid colored top header" feel.
3. **First content block** — colored H1 heading immediately followed by a colored callout that summarizes purpose. Both use the surface's `header_color`. This is the canonical opening pattern from `notion-components.md`.
4. **Components, not paragraphs** — when content fits a callout / columns / toggle / table, use it. Walls of text fail the readability bar. The full component reference lives at `skills/notion/references/notion-components.md`.

If `icon` or `cover` is missing on a `notion-create-pages` call: add it before sending. If `header_color` is missing in catalog metadata: pick from the surface theme map and add it.

## Required behaviors (all Notion writes)

1. **Parent** — Page is created under the parent resolved from `notion_defaults.parent_pages` via the skill's target key or `post_targets[<kind>]`. Team-side pages MUST land under `team_notion.teamspace_anchor_page_id` — never workspace-root. Private pages MUST be at workspace-root, never inside a teamspace.
2. **Title** — Clear, dated when the artifact is time-bound (e.g. `1:1 — Alex — 2026-04-27`). No placeholder "Untitled" for shipped artifacts.
3. **Properties** — If the parent is a **database**, fill every **required** property the org defined; use `templates/notion/catalog/*.json` schema (or the duplicated gallery template) as the source of truth for property **names**.
4. **AI attribution** — When body text is model-generated, append **`one_on_one_cycle.ai_attribution.footer_markdown`** (or team equivalent) if configured.
5. **URLs in summary** — Skills must return the **Notion page URL** in the user-facing summary after create/update.

## Canonical opening pattern

Every page jstack creates starts with this exact structure:

```
# <Title with icon prefix> {color="<header_color>"}

<callout icon="<icon>" color="<header_color>_bg">
	**<Title>** — <one-sentence purpose>. <one-sentence audience or routing note>.
</callout>

<table_of_contents color="gray"/>   ← only if 5+ H2 sections below

<columns>
	<column>
		### Quick links {color="<header_color>"}
		- ...
	</column>
	<column>
		### Status / Now {color="green"}
		- ...
	</column>
</columns>

## <First major section>
...
```

End every page with a footer:

```
---

_Wired by `<source-skill>` — `notion_defaults.<config_key>`_
```

## Section templates (page body)

Use **H2** for major blocks (Notion heading_2). Order may vary by template but keep names stable for evals.

**1:1 / conversation**

- Context / since last time
- Agenda
- Notes / Discussion
- Decisions
- Action items (owner + due if known)
- Links (doc, ticket)

**Transcript summary**

- Source (file path or meeting id — no secrets)
- Summary
- Decisions
- Open questions
- Attributed AI footer if applicable

**Project / sprint (lightweight page)**

- Goal
- Status
- Risks / blockers
- Next steps

**Team report / standup (team-visible)**

- Audience and period at top
- Bullets: shipped, in flight, blocked
- No private PE content on `team_hub` unless policy allows

**Dashboard (sprints, meetings, transcriptions, documents, intake, team, about, management, onboarding, engineering, oncall)**

Follow the canonical opening pattern above, then:

- 2-3 column "at a glance" row near the top
- Embedded database view OR mention-database for the data this dashboard fronts
- Conventions / playbook section using callouts + tables
- Mermaid diagram if there's a flow worth showing
- Skills-that-write-here section at bottom

## Eval rubric (for skill evals or human QA)

| Check | Pass if |
|-------|---------|
| **Icon set** | `icon` parameter present on `notion-create-pages` call |
| **Cover set** | `cover` parameter present, URL points to a valid image |
| **Opening pattern** | First two blocks: colored H1 + matching colored callout |
| **Routing** | Response cites `parent_pages` or `post_targets` key (or asks for missing id) |
| **No invented ids** | No fake `database_id` or page id presented as real |
| **Surface honored** | `team_*` artifacts under teamspace anchor; `private_*` at workspace-root |
| **Format** | Headings + components match canonical pattern |
| **Privacy** | Private artifacts reference `private_*` parents; team artifacts reference `team_*` |
| **Attribution** | AI-generated body mentions attribution when config requires it |
| **Components used** | Page uses callouts / columns / tables instead of long paragraph runs |

## Violations to flag

- Page created **without an icon** or **without a cover**.
- **First block is not a colored heading** matching the surface's `header_color`.
- Publishing **private transcript** content under **`team_hub`** without explicit user approval.
- Using **wrong template** (e.g. ADR layout for a 1:1). Route via the parent SKILL.md to the correct sub-skill.
- **Empty parent** in config — recover by pointing to `notion-vault-and-routing.md` and setup.
- Plain markdown wall of text where components would have served better.

## Required reading order for skill authors

If you're creating or modifying any `skills/notion/**` SKILL.md, READ in order:

1. `notion-components.md` — what blocks exist, when to use each, color themes
2. This file — the rules and rubric
3. `notion-vault-and-routing.md` — parent_pages / post_targets / surfaces
4. `notion-template-catalog.md` — the catalog format

## Related

- `notion-components.md` — canonical component reference
- `notion-vault-and-routing.md` — surface routing + teamspace rule
- `notion-template-catalog.md` — catalog format
- `templates/notion/catalog/README.md` — catalog quick map
- `notion://docs/enhanced-markdown-spec` — Notion MCP spec (canonical)

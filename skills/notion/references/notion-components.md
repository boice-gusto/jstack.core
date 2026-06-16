# Notion components — visual building blocks for jstack pages

This is the canonical reference for **every jstack skill that creates Notion pages**. Reading this is mandatory before you author content for `templates/notion/catalog/<set>/*.md` or write new notion-* skills. Source: `notion://docs/enhanced-markdown-spec` (Notion MCP).

## Hard rules (every page jstack creates)

1. **Icon required** — emoji (`🏢`), custom emoji (`:rocket:`), or image URL. No icon = the page looks unfinished in the sidebar.
2. **Cover required** — external image URL. Use Notion's built-in gradients (see Color themes below) for a "solid colored header band". Drives surface recognition at a glance.
3. **First content block** — colored H1 heading, immediately followed by a colored callout that summarizes the page's purpose. Both use the surface's color theme.
4. **Use components, not paragraphs** — when the content fits a callout/columns/toggle/table, use it. Walls of text fail the readability bar.
5. **Tab indentation** — required by Notion-flavored markdown for nested children (callouts, toggles, list children).
6. **No empty bullets** — every `-` list item must have inline rich text. Empty list items render awkwardly.

## Color themes by surface / dashboard kind

| Surface / dashboard | `header_color` | Cover URL |
|---|---|---|
| `team_hub` | `blue` | `https://www.notion.so/images/page-cover/gradients_3.png` |
| `private_vault` | `gray` | `https://www.notion.so/images/page-cover/solid_beige.png` (or `gradients_5`) |
| `one_on_ones` | `green` | `https://www.notion.so/images/page-cover/gradients_10.png` |
| **Sprints** | `orange` | `https://www.notion.so/images/page-cover/gradients_2.png` |
| **Meetings** | `blue` | `https://www.notion.so/images/page-cover/gradients_3.png` |
| **Transcriptions** | `purple` | `https://www.notion.so/images/page-cover/gradients_4.png` |
| **Documents** | `brown` | `https://www.notion.so/images/page-cover/gradients_5.png` |
| **Intake** | `red` | `https://www.notion.so/images/page-cover/gradients_8.png` |
| **Team** | `green` | `https://www.notion.so/images/page-cover/gradients_10.png` |
| **About** | `gray` | `https://www.notion.so/images/page-cover/gradients_11.png` |
| **Management** | `purple` | `https://www.notion.so/images/page-cover/gradients_4.png` |
| **Onboarding** | `green` | `https://www.notion.so/images/page-cover/gradients_10.png` |
| **Engineering** | `blue` | `https://www.notion.so/images/page-cover/gradients_3.png` |
| **On-call** | `red` | `https://www.notion.so/images/page-cover/gradients_8.png` |

When in doubt: blue for team-default, gray for private, red for urgency, green for people, purple for cross-functional / strategic.

## Inline-color palette (use sparingly)

Text: `gray`, `brown`, `orange`, `yellow`, `green`, `blue`, `purple`, `pink`, `red`
Backgrounds (suffix `_bg`): `gray_bg`, `brown_bg`, `orange_bg`, `yellow_bg`, `green_bg`, `blue_bg`, `purple_bg`, `pink_bg`, `red_bg`

Block-level color: `# Heading {color="blue"}`, `> Quote {color="purple"}`
Inline color: `<span color="red_bg">**Critical**</span>`

## Components — when and how

### Callout — primary "header" / status / aside

**Use for:** the intro under the page H1, status banners ("🟢 Healthy"), warnings, tips, "Why this exists" notes.

```
<callout icon="🏢" color="blue_bg">
	**BenOps Team HQ** — shared hub for USP Benefits Operations. All team-visible artifacts live here.
</callout>
```

Callouts can hold nested blocks (lists, toggles, mini-tables). Indent children one tab.

### Columns — side-by-side layout

**Use for:** dashboard top sections (status / quick links / metrics in 2-3 columns). Two columns is the readable default; three is the max before content cramps.

```
<columns>
	<column>
		### 🎯 Current Sprint {color="orange"}
		- Goal: ship intake form
		- Days left: 4
	</column>
	<column>
		### 📊 Status {color="green"}
		- Build: 🟢 passing
		- PRs in review: 3
	</column>
</columns>
```

### Toggle — collapsible sections

**Use for:** hiding details that aren't needed at first glance (changelog, archived runs, FAQ entries, retro details).

```
<details color="gray">
<summary>Sprint 47 retro notes (2026-04-15)</summary>
- _content here, indented_
</details>
```

For toggle headings (collapsible H1/H2/H3):

```
## Archived sprints {toggle="true" color="gray"}
	- Sprint 46 (2026-04-01)
	- Sprint 45 (2026-03-18)
```

### Table — structured data without a database

**Use for:** small fixed tables (3–10 rows) that don't need filtering/sorting. For larger / queryable data, use an inline database instead.

```
<table fit-page-width="true" header-row="true">
	<tr color="blue_bg">
		<td>Owner</td><td>Status</td><td>Due</td>
	</tr>
	<tr>
		<td>BEN</td><td>In progress</td><td>2026-05-01</td>
	</tr>
</table>
```

Cell color > row color > column color in precedence. Cells contain rich text only — no headings or images inside cells.

### Inline database — embedded view

**Use for:** showing a Tasks DB filtered to "current sprint" on the Sprint dashboard, etc. The database lives elsewhere; the page shows a view.

```
<database data-source-url="{{collection://<id>}}" inline="true" icon="🗂️">Current sprint tasks</database>
```

For a full sub-page database (collapsed): `inline="false"`.
Use `<mention-database>` if you only want to LINK, not embed.

### Mention — link to user / page / DB / date

```
<mention-page url="{{<page_url>}}">Team Notes</mention-page>
<mention-database url="{{<db_url>}}">Tasks</mention-database>
<mention-user url="{{<user_url>}}">Jonathan Boice</mention-user>
<mention-date start="2026-05-01"/>
```

### Quote — emphasis, vision/mission lines

```
> _One sentence describing the desired end state._ {color="purple"}
```

Multi-line quotes use `<br>` (never bare newlines): `> Line 1<br>Line 2 {color="gray"}`

### Code block — snippets, configs, mermaid diagrams

```
\`\`\`json
{ "key": "value" }
\`\`\`
```

```
\`\`\`mermaid
flowchart LR
  A["Idea"] --> B["Intake"]
  B --> C["Triaged"]
  C --> D["Tasks"]
\`\`\`
```

Inside code blocks: NEVER escape special chars. Write code literally.

### Table of contents — long pages

Use on pages with 5+ H2 sections (Wiki landing, Engineering hub, Onboarding):

```
<table_of_contents color="gray"/>
```

### Synced block — shared content across pages

**Use for:** on-call rotation, "what we're working on this week" — content that should appear identically on multiple pages and update together.

Source page:
```
<synced_block>
	**On-call this week:** <mention-user url="..."/>
</synced_block>
```

Reference on another page (after creation, with the URL Notion returns):
```
<synced_block_reference url="{{<synced_block_url>}}">
	... copy of children ...
</synced_block_reference>
```

### Meeting notes — Granola-style block

**Use for:** ad-hoc meetings where you want a transcript-aware container.

```
<meeting-notes>
	2026-04-28 — Weekly sync
	<notes>
		Action items:
		- [ ] BEN: file intake ticket
	</notes>
</meeting-notes>
```

Never include `<transcript>` when creating — the API rejects it.

### Embeds — file / video / audio / pdf / image

```
![Caption](https://example.com/image.png) {color="gray"}
<video src="https://...">Demo recording</video>
<pdf src="https://...">Spec PDF</pdf>
```

## Page structure template

Every dashboard or hub page jstack creates should follow this opening pattern:

```
# <Title> {color="<header_color>"}

<callout icon="<icon>" color="<header_color>_bg">
	**<Title>** — <one-sentence purpose>. <one-sentence audience or routing note>.
</callout>

<table_of_contents color="gray"/>   ← only if page has 5+ H2 sections

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

Then organize body in H2 sections. End with a small footer:

```
---

_Wired by `<source-skill>` — `notion_defaults.<config_key>`_
```

## What NOT to do

- Don't use H5/H6 (Notion silently downgrades to H4).
- Don't use `<empty-block/>` for spacing — Notion handles spacing automatically.
- Don't put HTML formatters inside table cells — use `**bold**`, not `<strong>`.
- Don't use newlines inside inline code or quotes — they break the block.
- Don't `<page url="...">` an existing page unless you mean to MOVE it. Use `<mention-page>` to link.
- Don't create database blocks at the top level of a page if you only want to reference one — use `<mention-database>`.

## Skills that must follow this reference

ALL skills under `skills/notion/` that create or update pages:

- `setup` (catalog-driven creation)
- `adr`, `article`, `planning`, `project`, `report`, `sprint`, `team-note`, `update`
- `knowledge-base`, `performance`, `one-on-one`, `standup`, `team-report`

Plus any cross-plugin overlay (e.g. `jstack-gusto/*`) that produces Notion pages.

If you're authoring or modifying any of those, **start by reading this file**, then `notion-page-format-rules.md`, then your specific skill's references.

## See also

- `skills/notion/references/notion-page-format-rules.md` — the eval / lint checklist
- `skills/notion/references/notion-template-catalog.md` — catalog format
- `templates/notion/catalog/README.md` — catalog quick map
- `notion://docs/enhanced-markdown-spec` — full Notion MCP spec (canonical source)

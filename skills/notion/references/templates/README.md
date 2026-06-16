# Notion template bundles

Five Notion marketplace exports, ready to import into a Notion workspace and wire as **golden_pages** for `jstack-notion-setup`. Each zip is a Notion **ExportBlock** (markdown + CSV files inside) — not consumable by the Notion API directly. Use the import workflow at the bottom.

## What's in here

| File | Source template | What it contains | Maps to catalog id | `golden_pages` key |
|---|---|---|---|---|
| `notion-company-pack.zip` | [Company pack](https://www.notion.so/marketplace/templates/company-pack) | Multi-DB pack: Projects & tasks, Docs, Kanban, Team wiki, Content calendar, CRM, Brainstorming, Meetings | `company_team_page` | `company_team_page` |
| `notion-1x1-meeting.zip` | [1x1 Meeting](https://www.notion.so/marketplace/templates/1-1-meeting) | 1:1 meeting page with Key Deliverables tables (H1/H2), wins, blockers, growth, action items + "Notion's Guide to 1x1s for Managers" | `one_on_one_template` | `one_on_one_template` |
| `notion-team-task-tracker.zip` | [Team Task Tracker](https://www.notion.so/marketplace/templates/team-task-tracker) | Lightweight kanban — Status / Owner / Due / Priority. Sample tasks: improve website copy, update FAQ, publish release notes | _new_ (`team_task_tracker`) | `team_task_tracker` |
| `notion-projects-and-tasks.zip` | [Notion Projects & Tasks](https://www.notion.so/marketplace/templates/notion-projects-and-tasks) | Two connected DBs (Projects + Tasks). Sample projects: Website redesign, Marketing campaign, Product launch | `product_tasks` | `product_tasks` |
| `notion-kanban-agile-sprint.zip` | [Kanban — Agile Sprint Management](https://www.notion.so/marketplace/templates/kanban-board) | Sprint kanban with sample tickets: Validate spec, Functional test, User testing, Create wireframes, UI dev, Marketing video | `kanban` | `kanban` |

## Why bundled exports?

The Notion API can't programmatically duplicate marketplace templates (see `../notion-template-catalog.md` "Hybrid resolution"). These zips are pre-exported so a user can:

1. **Import once** into their Notion workspace via the UI.
2. **Paste the resulting page id** into `notion_defaults.golden_pages.<key>` in `jstack.config.json`.
3. **Re-run `/jstack:notion setup`** — subsequent setups duplicate from the imported golden, preserving the marketplace design (icons, embedded views, sample data).

## Import workflow (per template)

1. Open Notion → `Settings` → `Workspace` → `Import` (or right-click in sidebar → `Import`).
2. Pick `Notion` as the source format.
3. Upload one of the zips above. Notion creates a new page tree from the export.
4. Copy the resulting page URL.
5. Add to `jstack.config.json`:

   ```jsonc
   "notion_defaults": {
     "golden_pages": {
       "kanban": "<paste-imported-page-id-here>"
     }
   }
   ```

6. Re-run `/jstack:notion setup`. Setup now duplicates from your golden instead of creating from the catalog markdown.

## Recommended (visually rich → big payoff)

These three are worth importing as goldens — the marketplace designs include configured DB views (kanban, board, calendar), embedded blocks, and sample data that the API can't recreate from SQL DDL:

- `notion-company-pack.zip` → `golden_pages.company_team_page`
- `notion-kanban-agile-sprint.zip` → `golden_pages.kanban`
- `notion-projects-and-tasks.zip` → `golden_pages.product_tasks`

Less critical:

- `notion-1x1-meeting.zip` → `golden_pages.one_on_one_template` (catalog already has a prompt-driven template that adapts to org config; bundle is useful only if you prefer the marketplace layout verbatim)
- `notion-team-task-tracker.zip` → `golden_pages.team_task_tracker` (smaller variant of kanban; useful if you don't need full sprint board)

## Unzip locally to inspect (optional)

```sh
mkdir -p .tmp/notion-templates
for z in skills/notion/references/templates/*.zip; do
  short=$(basename "$z" .zip)
  unzip -q "$z" -d ".tmp/notion-templates/$short"
  inner=$(ls ".tmp/notion-templates/$short/"*.zip)
  unzip -q "$inner" -d ".tmp/notion-templates/$short/extracted"
done
```

The extracted markdown / CSV files are the Notion export format — useful for reading the structure but NOT for re-import (the zip is what you import to Notion).

## Skill reference

For the picker UX (which template to import + how to wire), see `../notion-template-bundles.md` — a skill-callable reference that walks the user through the choice.

## Source / provenance

These zips were exported by the user from a Notion workspace where the marketplace templates had been duplicated. They are pre-existing Notion exports (see file timestamps), unmodified. Re-importing produces the same page tree as the original marketplace template.

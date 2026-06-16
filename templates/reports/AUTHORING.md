# Authoring jstack reports

Reports are **structured JSON** (`ReportPayload` v1) with **markdown section bodies**. The CLI merges data into `shells/default.html`; the **dashboard** (`/reports`) previews the same payload with React + shadcn-style cards.

## Payload shape (summary)

| Field | Role |
|-------|------|
| `schema_version` | Must be `1`. |
| `meta.title` | Document title (H1 in shells). |
| `meta.generated_at` | ISO-8601 string; shown as the report date. |
| `meta.team` | Optional; shown next to the kind badge. |
| `meta.subtitle` | Optional; e.g. “Week of …” or sprint name. |
| `meta.report_kind` | Optional; one of the enum values in `types/report-payload-v1.ts` — drives the **badge** in the dashboard. |
| `sections[]` | Each has optional `id`, `title`, `body_markdown`, and optional `chart` (Chart.js: `bar`, `line`, or `doughnut`). A section must have **at least one** of non-empty `body_markdown` or `chart`. |
| `links[]` | Optional `label` + `url` for a “Links” card. |

Full JSON Schema: `jstack.core/schemas/reports/report-payload-v1.schema.json`.  
Zod types: `jstack.core/types/report-payload-v1.ts`.

## Charts in `chart`

Use `type` `bar`, `line`, or `doughnut` with `labels[]` and `datasets[]` (each dataset has `label`, `data` as numbers, and optional Chart.js `backgroundColor` / `borderColor` / `fill`). Optional `title` is drawn by Chart.js. Optional `options.stacked` and `options.y_axis_begin_at_zero` apply to bar/line. The **dashboard** (`/reports`) and **`jstack report render`** (static `default.html` shell) both render charts; keep datasets small for static HTML.

## Markdown in `body_markdown`

Use **GitHub-flavored Markdown** (tables, task lists, strikethrough where supported).

### Do

- **Lead with outcomes**, not process. One fact per bullet where possible.
- **Bold** the token readers scan for: owners, dates, ticket keys, severity.
- Use **tables** for compact metrics (small column count, clear headers).
- Use **numbered lists** for ordered commitments; **bullets** for themes.
- Keep section bodies **scannable in under 90 seconds** for that section.

### Don’t

- Paste **raw logs** or huge stack traces — link to the source (Jira, incident doc, CI).
- Use **vague filler** (“we made good progress”) without a measurable or verifiable claim.
- Duplicate the same link in every section — use `links` once.
- Rely on `#` headings inside `body_markdown` for structure; **section titles** come from `title` in JSON. (Inline `##` is rendered small in the dashboard for visual calm.)

### Tone

- **Declarative**, past tense for done work, present/future for risks and next steps.
- **No “AI voice”**: avoid “delve”, “landscape”, “robust”, “leverage”, “synergy” unless quoting someone.

## Template files (`*.md`)

Each `*.md` under this folder is a **human-facing outline** for what to put in each **section** when you (or a tool) build the JSON. Placeholders like `{{team_name}}` are hints for string substitution before merge.

Map `report_kind` to the template name:

| `report_kind` | Template file |
|---------------|----------------|
| `team-weekly` | `team-weekly.md` |
| `engineer-weekly` | `engineer-weekly.md` |
| `manager-rollup` | `manager-rollup.md` |
| `project-status` | `project-status.md` |
| `sprint-summary` | `sprint-summary.md` |
| `incident-retro` | `incident-retro.md` |
| `eval-report` | `eval-report.md` |
| `self-report` | `self-report.md` |

## Static HTML vs dashboard

- **`jstack report render`**: produces a **single-file** artifact using `shells/default.html` (Tailwind Play CDN + minimal JS). Good for email-adjacent sharing and archives.
- **Dashboard `/reports`**: **React** preview with Card, Badge, and styled markdown — use during development or when hosting the dashboard.

Pixel-perfect parity between the two is not guaranteed; keep **content** in JSON + markdown as the source of truth.

## Example payload

See `examples/sample-payload.json`.

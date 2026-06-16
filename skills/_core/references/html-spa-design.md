# Single-page HTML reports (CDN shell)

Use when generating **static** report HTML (no bundler): `jstack report render`, `templates/reports/shells/default.html`, or hand-authored pages that consume **ReportPayload** JSON.

## Design tokens → CSS variables

Prefer **semantic** names (not raw hex in skills):

| Token | Typical `:root` variable |
|-------|---------------------------|
| Text primary | `--color-text` |
| Background | `--color-background` |
| Surface / card | `--color-surface` |
| Border | `--color-border` |
| Accent / primary action | `--color-primary` |
| Muted / secondary text | `--color-muted` |
| Font sans | `--font-sans` |
| Radius md | `--radius-md` |

Defaults merge from `config/defaults.json` → `reports.branding` and optional `jstack.config.json` overrides. The CLI (`mergeReportBranding`) injects a `:root { … }` block where the shell contains `/*__JSTACK_BRANDING_CSS__*/`. For multi-brand presets, logo URLs, and **`assets_dir`** conventions alongside interactive shells, see **`skills/design/visual-single-page-html/references/brand-variables.md`**.

## Tailwind + CDN

The default shell loads Tailwind **Play CDN** for utility classes. **shadcn/ui**-style components expect a **build** step (React + PostCSS) — do not promise pixel-perfect shadcn in a CDN-only page unless you inline compiled CSS.

For **interactive CDN-first compositions** with React/Tailwind/Chart.js/D3, themes, and report IA presets, invoke **`skills/design/visual-single-page-html/SKILL.md`** instead of reinventing loaders here.

## React dashboard (`jstack.core/dashboard`)

For **internal** rich preview, the **Next.js** dashboard (`/reports`) renders the same **ReportPayload** with Card/Badge-style components and `body_markdown` via `react-markdown` (see `dashboard/src/components/reports/`). Tokens are defined in `dashboard/src/app/globals.css` (shadcn-compatible variable names). **Content** is still authored as JSON + markdown; see **`templates/reports/AUTHORING.md`** and the `*.md` outlines in **`templates/reports/`**. Do not duplicate long prose in both places — treat the JSON sections as the shipped artifact for automation, and the `.md` files as **human templates** for what each section should contain.

## Checklist

1. Payload validates against `schemas/reports/report-payload-v1.schema.json` (or compatible shape).
2. Shell uses **DOM APIs** or `textContent` for user JSON — avoid `innerHTML` with untrusted strings.
3. End-user output includes **## Links** for any published URLs (see `response-artifacts.md`).
4. For brand colors from Figma, use **`design/figma-handoff`** and map to the semantic table above.

---
name: jstack-visual-single-page-html
description: Build one standalone HTML file with React, Tailwind 4-style tokens, Chart.js/D3 via CDN, shadcn-compatible CSS themes, citations to design theory, report IA hierarchy, and typographic markdown rendering—not a Next.js bundle.
when_to_use: User wants a single downloadable HTML dashboard, branded report viewer, slide-like page, or interactive viz page without a build step; mentions React Tailwind Chart.js D3 shadcn themes SPA CDN; asks for markdown on page with professional layout or report/presentation design.
category: design
gbrain_destination: none
data_class: internal
---

<!-- Chain Contract -->
<!-- inputs: user_request, content_markdown_optional, branding_optional, deliverable_type_optional -->
<!-- outputs: single_html_file_or_snippet -->
<!-- chains-to: jstack-report-design, jstack-share-html-publish, reports/* -->
<!-- see-also: _core/references/html-spa-design.md -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for

Author **one `.html` file** (optional inline JS/CSS only) that:

- Uses **CDN-hosted** stacks where feasible: React 18+, Tailwind-compatible utilities (+ v4 browser path when available), **Chart.js**, **d3**.
- Applies **named visual themes** (shadcn-**compatible** `:root` tokens—not full Radix components unless the user agrees to a build).
- Anchors decisions in **design theory** (web / report / deck) loaded from `references/design-theory.md`.
- When the deliverable is a **report** or evidence-heavy narrative, enforces **clear information architecture** per `references/report-ia.md`.
- Renders **markdown** with predictable typography (`prose`, headings, lists, code fences) and sanitization when mixed with user data — never inject unsanitized HTML from strings.

Out of scope: production SPA bundling (Vite/Next replacing this shell), SSR, importing the full Radix primitives tree solely from CDN unless the user explicitly prioritizes fidelity over portability.

## Config and sibling skills

- `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/html-spa-design.md` — CDN shell norms; token naming.
- `${CLAUDE_PLUGIN_ROOT}/skills/reports/report-design/SKILL.md` — org `reports.branding` → `:root`.
- **`references/brand-variables.md`** — **`reports.branding`**, multi-brand **`brand_presets`**, logos (`favicon`, `mark`, `horizontal`), **`assets_dir`** / **`assets_base_url`**, repo layout for `./assets/brands/<slug>/`.
- **`references/style-catalog.md`** — named deliverables (`landing`, `dashboard`, `report`, `report-exec`, `report-technical`, `presentation`), density · theme pairing.
- **`references/component-catalog.md`** — CDN-friendly primitives checklist (buttons, badges, charts shell, KPI, table).
- **`references/mockup-workflow.md`** — vote-ready **`/tmp/jstack-mockup-<slug>-YYYYMMDD.html`** · **`ttl_days`** comments · **`find … -mtime +N -delete`** cleanup.
- **`library/gallery.html`** — offline **library** viewer: live theme swap, token swatches, style cards, primitive strip (`library/README.md`).
- **`library/templates/mockup-blank.html`** — minimal starter copied to **`/tmp`** per mockup-workflow.
- Published HTML workflows: **`jstack-share-html-publish`**.
- Pin CDN versions in **`references/cdn-versions.md`** (avoid duplicate URL tables in this file).

Deep procedure and checklists:

!cat ${CLAUDE_PLUGIN_ROOT}/skills/design/visual-single-page-html/references/deep-dive.md

## Intake

1. **Deliverable**: `landing` · `dashboard` · `report` · `presentation` · `minimal`.
2. **Theme**: pick from **`references/themes.md`** or derive from **`reports.branding`** (+ document mapping).
3. **Data**: CSV/JSON pasted, Markdown body, URLs for charts — what is trusted vs must be sanitized.
4. **Viz**: Chart.js-first for standard series; reach for **d3** when layout is custom/geometric.

## Procedure

### Step 1 — Sketch IA

For **`report`** (forced): outline per `references/report-ia.md`: title hierarchy, TL;DR, sections, glossary/appendix, figure numbering. For **`presentation`**: slide anchors + one primary idea per screen (see theory ref).

### Step 2 — Theme + tokens

Merge a theme from **`references/themes.md`** with any org branding tokens. Emit a single `:root` / `[data-theme="…"] { … }` block; keep semantic names aligned with **`html-spa-design`** table.

### Step 3 — CDN shell + React root

Compose `index.html`:

- Loader order from **`references/cdn-versions.md`** (ESM/importmap preferred for react/react-dom/client for tree clarity).
- One `<div id="root">`; mount via `createRoot`; keep components in-module or inline `<script type="module">`.
- Tailwind **browser-compatible** invocation (v4 path): follow pinned snippet in **cdn-versions**; avoid implying full PostCSS shim on file:// without noting tradeoffs.

### Step 4 — Markdown + typography

Prefer **trusted pipeline**: render Markdown to React trees (see deep-dive) or run a sanitizer (for example DOM Purify CDN) **after** `marked`/micromark if inputs are partly user-controlled. Never bind raw markup from strings without sanitizing.

Apply `prose` / tokenized spacing so lists, headings, and code fences match design scale.

### Step 5 — Charts

- Wrap Chart.js canvases inside React refs (resize observer optional).
- D3 mounts into `useRef` + `useEffect`, clean up observers on teardown.

### Step 6 — Validate

- Themes switch without layout thrash (`data-theme` on `<html>` or `<body>`).
- Keyboard focus visible; color contrast sane for charts + text (`--muted`, `--foreground`).
- Print/save basics: `@media print` hides chrome if report will be printed/exported PDF.

### Step 7 — Summarize delivery

Deliver the `.html`; list external URLs used; advise `jstack report render`/`report-design` if org JSON pipeline should own branding next time.

## Output shape

- **Single artifact** (`report.html`) or fenced markup when pasting inline.
- **Theme name** chosen + **token deltas** vs default.
- **IA outline** bullet list for report/presentation variants.
- **Security note** — Markdown source trust level.

## Failure modes

| Symptom | Recovery |
|---------|----------|
| shadcn components break at runtime | Fallback to primitives + Tailwind + tokens; cite `html-spa-design`. |
| Tailwind CDN class gaps | Narrow custom utilities in `<style>` or inline theme tokens instead of exploding safelist |
| CSP blocks CDN | Offer self-contained bundle pivot (out of minimal scope) |

## Chaining

- Brand tokens: **`suggested_next: jstack-report-design`**.
- Hosted share: **`suggested_next: jstack-share-html-publish`**.

## User request

$ARGUMENTS

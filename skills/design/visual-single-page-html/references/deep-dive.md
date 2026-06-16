# Visual single-page HTML — deep dive

Companion to **`../SKILL.md`**.

## When to use

- Need one portable HTML deliverable readable offline or via email attachment preview.
- User explicitly wants CDN React + viz without repo setup.
- Prototype bridging to **`jstack report render`** payloads later — keep Markdown blocks compatible with authoring templates under `templates/reports`.

## Compose React + charts (minimal pattern sketch)

Agents should tailor code in the delivered HTML; pseudocode intentionally abstract:

```
import {createRoot} from 'react-dom/client';
import Markdown from … // or sanitize(marked(md))

function Shell() {
  return (
    <>
      <header>… KPI strip …</header>
      <ChartCard />
      <article className="prose prose-sm …">{Markdown}</article>
    </>
  );
}
createRoot(document.getElementById('root')).render(<StrictMode><Shell/></StrictMode>);
```

## Markdown processing

Trusted content (author-only): optionally render with `marked` outputs piped through `sanitize`.

Mixed/untrusted inputs: sanitize **after** HTML generation; disallow raw HTML pass-through (`marked.use({sanitize})` equivalents if available).

## Theme toggle

Expose `<select>` or segmented control calling `document.documentElement.dataset.theme`.

## Library (browse presets)

Open **`library/gallery.html`** in a desktop browser to inspect all named **`data-theme`** presets (live switch + token swatches + layout style cards). See **`references/style-catalog.md`** and **`component-catalog.md`** for naming used in gallery copy blocks.

## Mockup ballots

Write draft HTML under **`/tmp/jstack-mockup-*.html`** per **`references/mockup-workflow.md`** for team votes; TTL cleanup avoids clutter. Start from **`library/templates/mockup-blank.html`**.

## Brands, logos, and `assets_dir`

Canonical colors live under **`reports.branding`**; **named presets** (slug → logos, **`assets_dir`**, **`token_overrides`**) live in **`brand-variables.md`**. Prefer `<img src>` / `<link rel="icon">` to resolved paths (`file://`-safe relatives or CDN). Switch preset with **`data-brand`** or state mirroring **`jstack.config.json`** merges.

## Charts

- Chart.js: destroy previous instance inside `useEffect` cleanup before new data pushes.
- d3 selections: detach old SVG children on rerender (`selectAll('*').remove()` guarded).

## Print / PDF readiness

Declare `@media print` to hide sticky nav, widen chart width, lighten backgrounds converted to solids.

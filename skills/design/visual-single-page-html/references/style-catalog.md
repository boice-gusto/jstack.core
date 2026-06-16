# Style catalog (deliverables × layout)

Companion to **`themes.md`** and **`report-ia.md`**. Names are stable citation targets for prompts and changelog.

## Deliverable styles

| Style | Primary layout | Density | Charts | Markdown role |
|--------|----------------|---------|-------|----------------|
| **`landing`** | Hero + stacked feature rows + footer CTA | airy | sparse or absent | captions / optional blog strip |
| **`dashboard`** | Top bar + KPI row + responsive grid cards | compact | Chart.js-heavy | anomaly notes below charts |
| **`report`** | Doc column + TOC (sticky optional) | balanced | selective | body is primary artifact |
| **`report-exec`** | TL;DL + KPI strip + 3–5 sections max | sparse | thumbnails | exec summary bullets |
| **`report-technical`** | Numbered headings + glossary + appendix dense | dense | reproducibility tables | fenced code prominent |
| **`presentation`** | Full-viewport slides or scroll “sections”; one claim per viewport | roomy | keynote-style | captions / speaker notes collapsed |

Pick **exactly one** primary style unless the skill explicitly merges (e.g. report + appendix technical).

## Pairing themes (suggested)

Suggestions only—teams may override **`reports.branding`**.

| Style | Typical `data-theme` |
|-------|---------------------|
| `landing` · `landing` SaaS vibe | `solar-flare` · `slate-wireframe` |
| `dashboard` · metrics | `slate-wireframe` · `noir-metrics` |
| `report` generic | `slate-wireframe` · `editorial-newsprint` |
| `report-exec` | `noir-metrics` · `keynote-soft` |
| `report-technical` | `slate-wireframe` |
| `presentation` | `keynote-soft` · `solar-flare` |

## Component density

| Density | Typography | Charts per row | Nav |
|---------|--------------|----------------|-----|
| **airy** | large body, lg headings | ≤1 prominent | sticky minimal |
| **balanced** | default prose scale | 1–2 | sticky TOC acceptable |
| **compact** | `prose-sm`, tight gap | up to 3 small | condensed |

## Naming in filenames

Prefer `*-landing.html`, `*-dashboard.html`, `*-report.html`, `*-presentation.html`; for mockups see **`mockup-workflow.md`**.

# Design theory — web, reports, presentations

Anchors agents can cite when structuring a single-page HTML deliverable.

## Gestalt & hierarchy

**Proximity**, **similarity**, **continuity**, **figure/ground**. Group controls with charts; whitespace signals related content. Charts and legends stay inside the same bordered surface when they encode one assertion.

## Web / product surfaces

- **Progressive disclosure**: essentials first (hero + KPI strip), drills in accordions/modals/details.
- **Hick's law**: limit primary nav items; chart types default to readable defaults (bar/time series) before exotic views.
- **Fitts**: large tap targets ≥ 44 px for controls co-located with charts.
- **Grid**: 12-column mental model with `gap` multiples of 4 px / 8 px; align headings to baseline grid (`leading` + margins).

References: Nielsen Norman heuristic framing; WCAG proximity for captions.

## Reports (documents / dashboards)

**Pyramid / BLUF**: executive answer first, numbered claims, appendix for methods. Charts follow the sentence they illustrate (not before). **Inverted pyramid**: newsroom ordering if audience scans.

Evidence hierarchy maps to vertical rhythm: headings → paragraph → visualization → citations.

References: Barbara Minto (pyramid principle) as an idea shape, not verbatim lift of proprietary wording.

## Presentations ("slide-ish" SPA)

**One assertion per focal block** unless comparing; avoid walls of KPIs repeating the same noun. Maintain **spatial consistency** across "slides" (`scroll-snap` sections or keyed routes). Typography scales up for titles, down for evidence.

Contrast with reports: pacing + emphasis substitutes for expandable depth unless user toggles appendix.

Cross-check: **`report-ia.md`** for structural enforcement on report-like pages.

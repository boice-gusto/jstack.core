# Component catalog (CDN-friendly primitives)

For **standalone HTML** shells: emulate shadcn *semantics* with tokenized **`class` / inline token references** — not importing the Radix/React component tree unless the user agrees to a build.

## Layout

| Primitive | Purpose | Typical classes / tokens |
|-----------|---------|---------------------------|
| **`AppShell`** | Page chrome | `min-h-screen bg-[hsl(var(--background))]` (or Tailwind `@theme` bridging) |
| **`TopBar`** | Brand + density | `sticky top-0 border-b`, `--border` |
| **`PageHeader`** | Title + eyebrow | `border-b pb-6`, typography scale |
| **`SidebarSticky`** | TOC / filters | narrow column, `position:sticky; top:<offset>` |
| **`ContentColumn`** | Main column | max-width prose container for reports |

## Surfaces

| Primitive | Use |
|-----------|-----|
| **`Card`** | KPI, chart caption, Markdown aside |
| **`CardHeader` / `CardTitle` / `CardDescription`** | heading stack |
| **`CardContent`** | body |
| **`Separator`** | dividing sections `--border` |
| **`Alert`** (`default` \| `destructive`) | anomalies, disclaimers |

## Controls

| Primitive | Variant notes |
|-----------|---------------|
| **`Button`** | `default` (fills `--primary`) · `secondary` (`--secondary`) · `ghost` (`--muted`) · `destructive` |
| **`Badge`** | muted label · status pill `--accent`/`--muted` |
| **`Tabs`** (div + `role=tablist` if no radix) | keep keyboard focus outlines `--ring` |
| **`Select`** native or headless-lite | prefers theme ring |

## Typography & content

| Primitive | Role |
|-----------|------|
| **`prose`** block | Markdown body (`prose` + prose size tokens) |
| **`Heading`** h1–h4 | semantic order per **`report-ia.md`** |
| **`CodeBlock`** | fenced `<pre>`; optional copy button |

## Data display

| Primitive | Charts |
|-----------|--------|
| **`Table`** | zebra optional via `--muted` row band |
| **`DataTable`** shell | thead sticky for long appendix |
| **`StatBlock`** | label + KPI + delta + sparkline placeholder |
| **`ChartWrap`** | `ResizeObserver`; canvas max-width responsive |

Visual reference for colors and stacking order: open **`library/gallery.html`** in a browser next to **`themes.md`**.

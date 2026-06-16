# Brand variables reference

Use this when wiring **multiple named brands**, **logos**, **favicon**, and **local or CDN asset roots** into **`visual-single-page-html`** shells or aligning with **`jstack report render`**.

Canonical merge target for CLI-injected shells is **`reports.branding`** (see [`config/defaults.json`](../../../../config/defaults.json)). The structures below extend that model for SPA-style pages and selectable presets — merge carefully into `jstack.config.json`; **`reports.branding`** remains the primary slot **`report-design`** and **`mergeReportBranding`** target.

---

## 1. Canonical `reports.branding` (default shell / HTML reports)

Consumed by **`jstack report render`** as semantic colors + type (injected CSS). Shape today:

| Key | Role |
|-----|------|
| `colors.main` | Base text / headings |
| `colors.primary` | Accent / emphasis |
| `colors.secondary` | Secondary surfaces |
| `colors.background`, `surface` | Canvas and cards |
| `colors.text`, `textMuted`, `border` | Body hierarchy |
| `colors.button*` / `colors.link` | Actions and links |
| `radiusMd` | Corner radius (`0.5rem`-style string) |
| `fontSans` | Stack for UI body |
| `density` | e.g. `comfortable` (shells may honor for spacing tokens) |

Map these to **shadcn-style** CSS variables in interactive pages per **`themes.md`** (e.g. `colors.primary` → `--primary`).

---

## 2. Extended brand preset (recommended for SPA / multi-brand HTML)

Define **named presets** under a sibling object so switching brand is **`data-brand="slug"`** or a runtime selector — keep paths **workspace-relative or HTTPS**, never secrets.

Suggested shape (additive; merge under `reports`):

| Key | Type | Role |
|-----|------|------|
| `brand_presets` | object | Map **slug → preset** (`internal`, `customer`, `partner-a`). |
| **[slug].label** | string | Human name for selectors and docs. |
| **[slug].defaultTheme** | string | Optional `data-theme` from **`themes.md`** when this brand loads. |
| **[slug].token_overrides** | object | CSS variable key → value (hex, `rgb()`, `length`) overriding base theme |
| **[slug].logos** | object | Visual identity endpoints (URLs or `./` paths). |
| `logos.favicon` | url path | `.ico` or `.svg` |
| `logos.mark` | url path | Square / icon-only |
| `logos.horizontal` | url path | Logo + wordmark lockup |
| `logos.wordmark` | url path | Text-only variant if distinct |
| **[slug].assets_dir** | path string | **Root folder** for brand-owned static files (sprites, watermark PDF, raster charts). Resolved relative to **repo/workspace root** unless `assets_base_url` set. |
| **[slug].assets_base_url** | optional url | If set (e.g. `https://cdn.example.com/brands/partner-a/`), treat `assets_dir` primarily as authoring location and prefix public URLs from `assets_base_url` in generated `<img>/<link>` tags. |

**Example fragment** (merge into existing `reports`):

```json
{
  "reports": {
    "branding": {
      "colors": { "primary": "#2563eb" },
      "radiusMd": "0.5rem",
      "fontSans": "system-ui, sans-serif",
      "density": "comfortable"
    },
    "brand_presets": {
      "acme-internal": {
        "label": "Acme Internal",
        "defaultTheme": "slate-wireframe",
        "token_overrides": {
          "--primary": "#0f172a",
          "--accent": "#059669"
        },
        "logos": {
          "favicon": "./assets/brands/acme/favicon.ico",
          "horizontal": "./assets/brands/acme/logo-horizontal.svg"
        },
        "assets_dir": "./assets/brands/acme"
      },
      "acme-public": {
        "label": "Acme External",
        "defaultTheme": "editorial-newsprint",
        "logos": {
          "mark": "https://cdn.example.com/brand/logo-mark.svg"
        },
        "assets_dir": "./assets/brands/acme-public",
        "assets_base_url": ""
      }
    }
  }
}
```

---

## 3. Repo layout conventions (assets folders)

Suggested workspace tree (adapt to mono-repo packages if needed):

| Path | Holds |
|------|-------|
| `assets/brands/<slug>/` | Per-preset **`assets_dir`**; favicon, logos, optional `README` with usage constraints |
| `assets/brands/<slug>/exports/` | One-off PNG/SVG exports from Figma (see **`figma-handoff`**) |
| Shared `assets/shared/` | Icons and illustrations not tied to one brand |

**Rule:** Scripts and CDN shells should **prefer relative paths** tested with `file://` or a static server (`bun --hot`/`python -m http.server`) before assuming absolute URLs.

---

## 4. Chaining

- **`skills/reports/report-design/SKILL.md`** — produce or refine **`reports.branding`** and align **`token_overrides`** with semantic tokens.
- **`skills/design/figma-handoff`** — derive hex paths and exported assets into **`assets/brands/`**.

---

## 5. Checklist before ship

1. Confirm **Contrast** (`--foreground`/`--muted`/`--primary`) for each preset with real logo bg.
2. List **every external HTTPS** URL used (see response-artifacts norms).
3. If **Markdown** includes images, paths resolve relative to saved HTML directory or absolute CDN.

# Themes (shadcn-compatible tokens)

Themes are **`[data-theme="name"]`** on `<html>` with CSS variables. Names are stable so agents can cite them in output.

Variables follow shadcn/tailwind v4 bridging:

| Variable | Intended use |
|---------|----------------|
| `--background` | Canvas |
| `--foreground` | Primary text |
| `--card` | Panel surfaces |
| `--card-foreground` | Text atop card |
| `--popover` | Floating layers |
| `--primary`, `--primary-foreground` | Brand buttons/links |
| `--secondary`, `--muted`, `--muted-foreground` | De-emphasized fills/text |
| `--accent`, `--accent-foreground` | Hover/active |
| `--destructive` (`-foreground`) | Danger |
| `--border`, `--input`, `--ring` | Outline + outlines |
| `--radius` | Global radius shorthand |

Built-in palettes (implement as full blocks alongside base `.dark` variants when needed):

| `data-theme` | Mood |
|--------------|-----|
| `slate-wireframe` | Cool neutrals, crisp charts |
| `solar-flare` | Warm highlights, dashboards |
| `noir-metrics` | High-contrast KPI |
| `editorial-newsprint` | Long-form serif-friendly |
| `keynote-soft` | Large type, roomy sections |

Agents should duplicate the variable block patterns from the SKILL deliverable prose when shipping HTML rather than fetching remote CSS.

Alignment with **`reports.branding`**: overlay org hex into `-primary`, `-accent`, optionally `-muted` gradients; keep structural names identical. For multiple named brands, logo paths, and **`assets_dir`**, see **`brand-variables.md`**.

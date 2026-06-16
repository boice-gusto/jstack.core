<p align="center">
  <img src="../../../../assets/logo-placeholder.png" alt="jstack" width="240" height="240" />
</p>

# Visual single-page HTML — design library

**`gallery.html`** — single-file viewer for named **themes** (token swatches + live preview), **deliverable styles** (landing, dashboard, report variants, presentation), and **CDN-style primitives** (buttons, badges, cards, table shell, KPI stat).

## Open locally

- **macOS:** `open "$(git rev-parse --show-toplevel)/jstack.core/skills/design/visual-single-page-html/library/gallery.html"`
- Or drag **gallery.html** into a browser (`file:` URL).

Optional local server (if you add assets under this folder):

```sh
cd jstack.core/skills/design/visual-single-page-html/library
python3 -m http.server 8765
```

Then browse `http://127.0.0.1:8765/gallery.html`.

## Related references

| File | Contents |
|------|-----------|
| `../references/themes.md` | Canonical `data-theme` names |
| `../references/style-catalog.md` | Deliverable × layout matrix |
| `../references/component-catalog.md` | Primitive checklist |
| `../references/mockup-workflow.md` | `/tmp/jstack-mockup-*.html`, voting note, TTL cleanup |
| **`templates/mockup-blank.html`** | Starter copied to **`/tmp/...`** for design ballots |

## Maintenance

When adding a named theme under **`themes.md`**, extend **`gallery.html`** `:root`/selector blocks and the theme `<select>` so the gallery stays exhaustive.

# CDN version pins

**Stale links fail silently.** When shipping examples, cite major versions verified at authoring time but **prefer** pinning exact checksums/`@version` URIs whenever org policy mandates supply-chain review.

Baseline pattern (conceptual headings only — replicate with current vendor URLs):

| Concern | Suggested artifact |
|---------|---------------------|
| React + React DOM | ES modules via `react@18`, `react-dom@18/client` (`importmaps`/`esm.sh`/`jspm`/vendor policy) |
| Tailwind playground | Prefer official `@tailwindcss/browser` / documented script for **browser-only** authoring in v4; fall back cautiously to legacy Play CDN note in `html-spa-design`. |
| Chart.js | v4 CDN module build |
| D3 | v7 modular import |
| Marked/Micromark | For markdown transpile when not using `react-markdown` |
| dompurify | Post-markdown sanitization |

### Loader ordering

1. Theme tokens `:root`/attribute selectors.
2. Tailwind/brace runtime.
3. Sanitizer + Markdown parser helpers.
4. Application module (`type="module"`).

### Integrity

If policy requires SRI, append `integrity=` + `crossorigin` attributes sourced from CDN provider tables at delivery time—not placeholder hashes.

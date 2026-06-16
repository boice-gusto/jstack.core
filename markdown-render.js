/**
 * Shared Markdown → safe DOM (marked + DOMPurify from jsDelivr). Used by md-preview.js and docs.js.
 */

/** @type {{ parse: (src: string) => string } | null} */
let markedApi = null;

/** @type {((dirty: string, cfg: { RETURN_DOM_FRAGMENT: boolean }) => DocumentFragment) | null} */
let purifyToFragment = null;

/**
 * @returns {Promise<void>}
 */
export async function ensureMarkdownLibs() {
  if (markedApi && purifyToFragment) {
    return;
  }
  const [markedMod, domMod] = await Promise.all([
    import("https://cdn.jsdelivr.net/npm/marked@14.1.4/+esm"),
    import("https://cdn.jsdelivr.net/npm/dompurify@3.1.7/+esm"),
  ]);
  const marked = markedMod.marked;
  marked.setOptions({ gfm: true, breaks: false });
  markedApi = { parse: (src) => marked.parse(src) };
  const purify = domMod.default;
  purifyToFragment = (dirty, cfg) => purify.sanitize(dirty, cfg);
}

/**
 * Remove leading YAML frontmatter (--- … ---) from SKILL.md source before rendering body.
 * @param {string} raw
 * @returns {string}
 */
export function stripYamlFrontmatter(raw) {
  const t = raw ?? "";
  if (!t.startsWith("---")) {
    return t;
  }
  const endMarker = t.indexOf("\n---", 3);
  if (endMarker === -1) {
    return t;
  }
  return t.slice(endMarker + 4).replace(/^\r?\n?/, "");
}

/**
 * @param {string} markdown
 * @returns {Promise<DocumentFragment>}
 */
export async function markdownToSafeFragment(markdown) {
  await ensureMarkdownLibs();
  if (!markedApi || !purifyToFragment) {
    throw new Error("Markdown libraries failed to load (offline or blocked CDN).");
  }
  const rawHtml = markedApi.parse(markdown);
  const frag = purifyToFragment(rawHtml, { RETURN_DOM_FRAGMENT: true });
  if (!(frag instanceof DocumentFragment)) {
    throw new Error("Sanitizer did not return a fragment.");
  }
  return frag;
}

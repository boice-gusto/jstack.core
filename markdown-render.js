/**
 * Shared Markdown → safe DOM (marked + DOMPurify from jsDelivr). Used by md-preview.js and docs.js.
 */

/**
 * @type {{
 *   parse: (src: string) => string,
 *   sanitize: (dirty: string, cfg: { RETURN_DOM_FRAGMENT: boolean }) => DocumentFragment,
 * } | null}
 */
let libs = null;

/**
 * @returns {Promise<void>}
 */
export async function ensureMarkdownLibs() {
  if (libs) {
    return;
  }
  // Pinned versions: keep in sync with the npm-installed versions used by the
  // bundled build path (package.json `marked`/`dompurify`). dompurify@3.1.7 was
  // previously pinned here and is in the disclosed-vulnerable range for
  // GHSA-v2wj-7wpq-c8vv / CVE-2026-0540 (missing rawtext-element handling —
  // noscript/xmp/noembed/noframes/iframe — in SAFE_FOR_XML lets an attribute value
  // like `title="</noscript><img src=x onerror=...>"` survive sanitize() unescaped).
  // Fixed upstream in dompurify 3.3.2; pinned here to a version well past that fix.
  const [markedMod, domMod] = await Promise.all([
    import("https://cdn.jsdelivr.net/npm/marked@15.0.12/+esm"),
    import("https://cdn.jsdelivr.net/npm/dompurify@3.4.1/+esm"),
  ]);
  const marked = markedMod.marked;
  marked.setOptions({ gfm: true, breaks: false });
  const purify = domMod.default;
  libs = {
    parse: (src) => marked.parse(src),
    sanitize: (dirty, cfg) => purify.sanitize(dirty, cfg),
  };
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
  if (!libs) {
    throw new Error(
      "Markdown libraries failed to load (offline or blocked CDN).",
    );
  }
  const rawHtml = libs.parse(markdown);
  const frag = libs.sanitize(rawHtml, { RETURN_DOM_FRAGMENT: true });
  if (!(frag instanceof DocumentFragment)) {
    throw new Error("Sanitizer did not return a fragment.");
  }
  return frag;
}

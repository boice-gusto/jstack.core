/**
 * Browser bundle path: marked + DOMPurify from npm (no CDN). Aliased as ./markdown-render.js in docs:build.
 */

import DOMPurify from "dompurify";
import { marked } from "marked";

marked.setOptions({ gfm: true, breaks: false });

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
  const rawHtml = marked.parse(markdown);
  const frag = DOMPurify.sanitize(rawHtml, { RETURN_DOM_FRAGMENT: true });
  if (!(frag instanceof DocumentFragment)) {
    throw new Error("Sanitizer did not return a fragment.");
  }
  return frag;
}

/**
 * @returns {Promise<void>}
 */
export async function ensureMarkdownLibs() {
  // No-op: libs are bundled.
}

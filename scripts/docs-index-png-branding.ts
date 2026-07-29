/**
 * Docs single-file build: embed the brand PNG as data URLs in the favicon + header
 * mark regions (markers in index.html).
 * Used by jstack.core and jstack.gusto (each passes its package root as `repoRoot`).
 *
 * Inlines a 128px mark, not the 1024px source. The data URL is emitted THREE times
 * (favicon, apple-touch-icon, header mark) and the mark renders at 40x40 — inlining
 * the 1.7 MB 1024px original produced a ~7 MB `index.html` and ~9 MB `docs/index.html`
 * in each repo (~32 MB of tracked HTML) for an image never displayed above 128px.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

const INDEX_FAVICON_BEGIN = "<!-- jstack:generated-favicon -->";
const INDEX_FAVICON_END = "<!-- /jstack:generated-favicon -->";
const INDEX_BRAND_MARK_BEGIN = "<!-- jstack:generated-brand-mark -->";
const INDEX_BRAND_MARK_END = "<!-- /jstack:generated-brand-mark -->";

/** Preferred small mark for inlining; falls back to the full-size source if absent. */
const LOGO_MARK_REL = "assets/logo-mark-128.png";
const LOGO_FALLBACK_REL = "assets/logo.png";

function resolveMarkPath(repoRoot: string): string {
  const small = join(repoRoot, LOGO_MARK_REL);
  return existsSync(small) ? small : join(repoRoot, LOGO_FALLBACK_REL);
}

function replaceBetweenMarkerPair(
  html: string,
  begin: string,
  end: string,
  innerBetweenMarkers: string,
): string {
  const i0 = html.indexOf(begin);
  const i1 = html.indexOf(end);
  if (i0 === -1 || i1 === -1 || i1 < i0) {
    throw new Error(`Expected ${begin} before ${end}`);
  }
  const i1End = i1 + end.length;
  const block = begin + innerBetweenMarkers + end;
  return html.slice(0, i0) + block + html.slice(i1End);
}

/**
 * Single-file `docs/index.html`: inline PNG favicon + brand mark (no separate asset fetch).
 */
export async function patchDocsIndexPngBranding(
  html: string,
  repoRoot: string,
): Promise<string> {
  const logoPath = resolveMarkPath(repoRoot);
  const buf = await readFile(logoPath);
  const dataUrl = `data:image/png;base64,${buf.toString("base64")}`;
  let out = html;
  out = replaceBetweenMarkerPair(
    out,
    INDEX_FAVICON_BEGIN,
    INDEX_FAVICON_END,
    `\n    <link rel="icon" href="${dataUrl}" type="image/png" sizes="any" />\n    <link rel="apple-touch-icon" href="${dataUrl}" />\n    `,
  );
  out = replaceBetweenMarkerPair(
    out,
    INDEX_BRAND_MARK_BEGIN,
    INDEX_BRAND_MARK_END,
    `\n        <div class="brand-mark-wrap">\n          <img class="brand-mark" src="${dataUrl}" width="40" height="40" alt="" decoding="async" />\n        </div>\n        `,
  );
  return out;
}

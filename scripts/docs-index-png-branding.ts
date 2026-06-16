/**
 * Docs single-file build: embed `./assets/logo-placeholder.png` as data URLs
 * in the favicon + header mark regions (markers in index.html).
 * Used by jstack.core and jstack.gusto (each passes its package root as `repoRoot`).
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const INDEX_FAVICON_BEGIN = "<!-- jstack:generated-favicon -->";
const INDEX_FAVICON_END = "<!-- /jstack:generated-favicon -->";
const INDEX_BRAND_MARK_BEGIN = "<!-- jstack:generated-brand-mark -->";
const INDEX_BRAND_MARK_END = "<!-- /jstack:generated-brand-mark -->";

const LOGO_REL = "assets/logo-placeholder.png";

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
  const logoPath = join(repoRoot, LOGO_REL);
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

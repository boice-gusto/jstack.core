/**
 * Portable jstack mark (isometric stack + J): favicons and docs brand mark.
 * Report shells use `jstack.core/assets/logo-placeholder.png` (data URL) for the header mark.
 *
 * When changing the SVG artwork, update consumers that paste a literal (search JSTACK_MARK_SVG).
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function coreLogoPlaceholderDataUrl(): string {
  const abs = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "logo-placeholder.png");
  if (!existsSync(abs)) {
    throw new Error(`Core logo-placeholder missing: ${abs}`);
  }
  const buf = readFileSync(abs);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

export const JSTACK_MARK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="jstack">' +
  '<path fill="#3d5a73" d="M16 90 42 76 48 80 22 94z"/>' +
  '<path fill="#4d6f86" d="M22 76 48 62 48 74 22 88z"/>' +
  '<path fill="#6a8fa8" d="M22 62 48 48 48 60 22 74z"/>' +
  '<path fill="#7ba3d4" fill-rule="evenodd" d="M54 24h46v12H66v38c0 16 12 26 30 26h4v12H94c-26 0-42-16-42-42V24z"/>' +
  "</svg>";

export function jstackMarkSvgWithClass(className: string): string {
  const safe = className.replace(/"/g, "");
  return JSTACK_MARK_SVG.replace("<svg ", `<svg class="${safe}" `);
}

/** Single-file HTML: favicon without a separate file. */
export function buildJstackFaviconLink(): string {
  const href = `data:image/svg+xml,${encodeURIComponent(JSTACK_MARK_SVG)}`;
  return `<link rel="icon" type="image/svg+xml" href="${href}" />`;
}

/** Tailwind report shell: logo placeholder + wordmark row above #root. */
export function buildJstackReportBrandHeader(): string {
  const href = coreLogoPlaceholderDataUrl();
  return (
    '<div class="flex items-center gap-2 mb-2 text-slate-600">' +
    `<img class="w-10 h-10 shrink-0 rounded-lg object-contain" alt="" src="${href}" />` +
    '<span class="font-semibold text-sm">jstack</span>' +
    "</div>"
  );
}

/** Docs catalog (`index.html`): inline mark only; `.brand-mark-wrap` sized in docs.css. */
export function buildJstackDocsBrandMarkHtml(): string {
  return `<span class="brand-mark-wrap" aria-hidden="true">${jstackMarkSvgWithClass("brand-mark")}</span>`;
}

/**
 * Minimal HTML shells without Tailwind (eval viewer, throughput): logo placeholder + wordmark.
 * Pair with local CSS for `.jstack-plain-brand`, `.jstack-plain-brand-svg` (40×40 img).
 */
export function buildJstackPlainBrandHeader(): string {
  const href = coreLogoPlaceholderDataUrl();
  return (
    '<div class="jstack-plain-brand">' +
    `<img class="jstack-plain-brand-svg" alt="" src="${href}" width="40" height="40" style="object-fit:contain;border-radius:8px" />` +
    '<span class="jstack-plain-brand-text">jstack</span>' +
    "</div>"
  );
}

const INDEX_FAVICON_BEGIN = "<!-- jstack:generated-favicon -->";
const INDEX_FAVICON_END = "<!-- /jstack:generated-favicon -->";
const INDEX_BRAND_MARK_BEGIN = "<!-- jstack:generated-brand-mark -->";
const INDEX_BRAND_MARK_END = "<!-- /jstack:generated-brand-mark -->";

const EVAL_FAVICON_BEGIN = "<!-- jstack:eval-favicon -->";
const EVAL_FAVICON_END = "<!-- /jstack:eval-favicon -->";
const EVAL_BRAND_BEGIN = "<!-- jstack:eval-brand -->";
const EVAL_BRAND_END = "<!-- /jstack:eval-brand -->";

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

/** Docs catalog `index.html`: data-URL favicon + inline mark in header. */
export function patchDocsIndexBranding(html: string): string {
  let out = html;
  out = replaceBetweenMarkerPair(
    out,
    INDEX_FAVICON_BEGIN,
    INDEX_FAVICON_END,
    `\n    ${buildJstackFaviconLink()}\n    `,
  );
  out = replaceBetweenMarkerPair(
    out,
    INDEX_BRAND_MARK_BEGIN,
    INDEX_BRAND_MARK_END,
    `\n        ${buildJstackDocsBrandMarkHtml()}\n        `,
  );
  return out;
}

/** Self-contained eval viewer template (`evals/viewer.html`). */
export function patchEvalViewerTemplate(html: string): string {
  let out = html;
  out = replaceBetweenMarkerPair(
    out,
    EVAL_FAVICON_BEGIN,
    EVAL_FAVICON_END,
    `\n  ${buildJstackFaviconLink()}\n  `,
  );
  out = replaceBetweenMarkerPair(out, EVAL_BRAND_BEGIN, EVAL_BRAND_END, `\n  ${buildJstackPlainBrandHeader()}\n  `);
  return out;
}

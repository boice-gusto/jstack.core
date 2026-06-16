import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ENCODING_UTF8 } from "@jstack/constants/paths";
import {
  buildJstackFaviconLink,
  buildJstackReportBrandHeader,
} from "@jstack/constants/jstackMarkSvg";
import { inlinePluginReportAssets } from "@jstack/constants/reportPluginAssets";
import { findPluginRoot, findProjectRoot, loadDefaults, readConfigOptional } from "../lib/config.js";
import { extractReportsBranding, mergeReportBranding } from "../lib/report-branding.js";

/** Inline JSON payload into templates/reports/shells/default.html */
export function runReportRender(opts: { data: string; out: string; shell?: string }): void {
  const projectRoot = findProjectRoot();
  const pluginRoot = findPluginRoot();
  const dataPath = opts.data.startsWith("/") ? opts.data : join(projectRoot, opts.data);
  if (!existsSync(dataPath)) {
    console.error(`Missing data file: ${dataPath}`);
    process.exitCode = 1;
    return;
  }
  const rawPayload = readFileSync(dataPath, ENCODING_UTF8).trim();
  /** Avoid `</script>` (or any `<`) in JSON closing the host <script> tag in HTML. */
  const payload = rawPayload.replace(/</g, "\\u003c");
  const defaults = loadDefaults(pluginRoot);
  const cfg = readConfigOptional(projectRoot);
  const { css } = mergeReportBranding(
    extractReportsBranding(defaults) ?? {},
    cfg ? (extractReportsBranding(cfg) ?? {}) : {},
  );

  const shellRel = opts.shell?.trim() || join("templates", "reports", "shells", "default.html");
  const shellPath = shellRel.startsWith("/") ? shellRel : join(pluginRoot, shellRel);
  if (!existsSync(shellPath)) {
    console.error(`Missing shell: ${shellPath}`);
    process.exitCode = 1;
    return;
  }
  let html = readFileSync(shellPath, ENCODING_UTF8);
  html = html.replace("/*__JSTACK_BRANDING_CSS__*/", css);
  const customHeadExtrasPath = join(
    pluginRoot,
    "templates",
    "reports",
    "head-extras.html",
  );
  const headExtras = existsSync(customHeadExtrasPath)
    ? readFileSync(customHeadExtrasPath, ENCODING_UTF8).trim()
    : buildJstackFaviconLink();
  html = html.replace("<!--__JSTACK_HEAD_EXTRAS__-->", headExtras);
  const customBrandHeaderPath = join(
    pluginRoot,
    "templates",
    "reports",
    "brand-header.html",
  );
  let brandHeader = existsSync(customBrandHeaderPath)
    ? readFileSync(customBrandHeaderPath, ENCODING_UTF8).trim()
    : buildJstackReportBrandHeader();
  brandHeader = inlinePluginReportAssets(brandHeader, pluginRoot);
  html = html.replace("<!--__JSTACK_BRAND_HEADER__-->", brandHeader);
  const emptyDataTag =
    '<script type="application/json" id="jstack-report-data"></script>';
  if (!html.includes(emptyDataTag)) {
    console.error(
      "Shell is missing the exact empty JSON script tag. Expected:\n" + emptyDataTag,
    );
    process.exitCode = 1;
    return;
  }
  html = html.replace(
    emptyDataTag,
    `<script type="application/json" id="jstack-report-data">${payload}</script>`,
  );
  const outPath = opts.out.startsWith("/") ? opts.out : join(projectRoot, opts.out);
  writeFileSync(outPath, html, ENCODING_UTF8);
  console.log(`Wrote ${outPath}`);
  console.log("");
  console.log("## Links");
  console.log("");
  console.log(`- Local HTML: ${outPath}`);
}

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Tokens in report HTML fragments; resolved to base64 data URLs at render time. */
const PLUGIN_ASSET_TOKEN = /__JSTACK_PLUGIN_ASSET__([^_]+)__/g;

function mimeForAsset(fileName: string): string {
  if (fileName.endsWith(".svg")) return "image/svg+xml";
  if (fileName.endsWith(".png")) return "image/png";
  if (fileName.endsWith(".webp")) return "image/webp";
  if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

/**
 * Replace `__JSTACK_PLUGIN_ASSET__{filename}__` with a data URL from `{pluginRoot}/assets/{filename}`.
 * Safe when the fragment has no tokens (returns input unchanged).
 */
export function inlinePluginReportAssets(html: string, pluginRoot: string): string {
  return html.replace(PLUGIN_ASSET_TOKEN, (_m, fileName: string) => {
    const abs = join(pluginRoot, "assets", fileName);
    if (!existsSync(abs)) {
      throw new Error(`Plugin report asset missing: ${abs}`);
    }
    const buf = readFileSync(abs);
    const mime = mimeForAsset(fileName);
    return `data:${mime};base64,${buf.toString("base64")}`;
  });
}

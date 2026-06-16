import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import { findPluginRoot } from "../lib/config.js";

/** Maps to scripts in package.json (single source of truth). */
const NPM_SCRIPT = {
  generate: "docs:generate",
  build: "docs:build",
  serve: "docs:serve",
  preview: "docs:preview",
} as const;

export type DocsAction = keyof typeof NPM_SCRIPT;

/**
 * Runs `bun run docs:*` from the plugin root (same as contributors run from jstack.core).
 * `serve` and `preview` may block until Ctrl+C.
 */
export function runDocs(action: DocsAction): void {
  const pluginRoot = findPluginRoot();
  const pkgJson = join(pluginRoot, "package.json");
  if (!existsSync(pkgJson)) {
    console.error(
      chalk.red("package.json not found at plugin root; set CLAUDE_PLUGIN_ROOT or run from jstack.core"),
    );
    process.exitCode = 1;
    return;
  }
  const script = NPM_SCRIPT[action];
  const res = spawnSync("bun", ["run", script], { cwd: pluginRoot, stdio: "inherit" });
  process.exitCode = res.status ?? 0;
}

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import { findPluginRoot } from "../lib/config.js";

export interface RunEvalOptions {
  skill?: string;
  /** Extra argv after action, e.g. ["--threshold", "90", "--viewer"] */
  extra?: string[];
}

/**
 * Spawns `bun evals/run-evals.ts <action> ...` from the plugin root so paths resolve in monorepos.
 */
export function runEval(action: string, opts?: RunEvalOptions): void {
  const pluginRoot = findPluginRoot();
  const runner = join(pluginRoot, "evals", "run-evals.ts");
  if (!existsSync(runner)) {
    console.error(chalk.red("evals/run-evals.ts not found (set CLAUDE_PLUGIN_ROOT or run from the jstack plugin directory)"));
    process.exitCode = 1;
    return;
  }
  const parts = [runner, action];
  if (opts?.skill) {
    parts.push("--skill", opts.skill);
  }
  if (opts?.extra?.length) {
    parts.push(...opts.extra);
  }
  const res = spawnSync("bun", parts, { cwd: pluginRoot, stdio: "inherit" });
  process.exitCode = res.status ?? 0;
}

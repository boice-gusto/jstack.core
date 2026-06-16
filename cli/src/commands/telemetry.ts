import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import { findPluginRoot } from "../lib/config.js";

export function runTelemetry(action: string): void {
  const script = join(findPluginRoot(), "telemetry", "cli.ts");
  if (!existsSync(script)) {
    console.error(chalk.red("telemetry/cli.ts missing"));
    process.exitCode = 1;
    return;
  }
  const res = spawnSync("bun", [script, action], { stdio: "inherit" });
  process.exitCode = res.status ?? 0;
}

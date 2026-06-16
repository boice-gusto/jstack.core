import chalk from "chalk";
import { findProjectRoot, readConfigOptional } from "../lib/config.js";
import { listRoutinesFromConfig } from "../lib/scheduler.js";

export function runStatus(): void {
  const root = findProjectRoot();
  const cfg = readConfigOptional(root);
  if (!cfg) {
    console.log(chalk.yellow("No jstack.config.json — run jstack setup"));
    return;
  }
  const team = cfg.team as { name?: string; timezone?: string } | undefined;
  console.log(chalk.bold("jstack status"));
  console.log(`  Team:     ${team?.name ?? "(unset)"}`);
  console.log(`  Timezone: ${team?.timezone ?? "UTC"}`);
  const mcp = cfg.mcp_servers ?? {};
  console.log(`  MCP srv:  ${Object.keys(mcp).length} registered`);
  const routines = listRoutinesFromConfig(cfg);
  for (const r of routines) {
    console.log(`  Routine:  ${r.id} ${r.enabled ? "on" : "off"} ${r.cron || "(manual)"}`);
  }
}

import chalk from "chalk";
import { readFileSync } from "node:fs";
import { configPath, findProjectRoot } from "../lib/config.js";

export function runConfigShow(): void {
  const root = findProjectRoot();
  const p = configPath(root);
  console.log(chalk.blue(p));
  console.log(readFileSync(p, "utf8"));
}

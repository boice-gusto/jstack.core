import chalk from "chalk";
import { existsSync, readFileSync } from "node:fs";
import { configPath, findProjectRoot } from "../lib/config.js";

/**
 * Print the resolved config path and its contents.
 *
 * Missing-config used to surface as a raw `ENOENT` stack trace from `readFileSync`, because this
 * command read the file directly instead of going through the helpers in `lib/config.js` that every
 * sibling command uses. `status` and `doctor` both print an actionable line for the same condition;
 * this now matches them. A parse failure is reported separately from a missing file — they need
 * different fixes, and printing the file path plus the parser's message is what makes the difference
 * actionable.
 */
export function runConfigShow(): void {
  const root = findProjectRoot();
  const p = configPath(root);

  if (!existsSync(p)) {
    console.error(chalk.yellow(`No config at ${p}`));
    console.error(
      "Run: jstack setup   (or `jstack setup --schema` for the field-by-field wizard)",
    );
    process.exitCode = 1;
    return;
  }

  const raw = readFileSync(p, "utf8");
  try {
    JSON.parse(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(chalk.red(`${p} is not valid JSON: ${msg}`));
    console.error("Fix the syntax error, then run: jstack doctor");
    process.exitCode = 1;
    return;
  }

  console.log(chalk.blue(p));
  console.log(raw);
}

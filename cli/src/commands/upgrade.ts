import { existsSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import {
  findPluginRoot,
  findProjectRoot,
  readConfigOptional,
} from "../lib/config.js";
import {
  checkDistributionUpdate,
  type UpdateCheckResult,
} from "../lib/update-check.js";

/**
 * Pure formatter for the version-check result -- no filesystem/network access, so it's
 * fully unit-testable with zero mocking. `runUpgrade` below is the thin I/O wrapper (real
 * findPluginRoot/config/fetch) that isn't separately unit-tested; it was proven live instead
 * (`bun run cli/src/index.ts upgrade` against this real repo) since mocking its collaborators
 * (`../lib/config.js`) leaked across unrelated test files that import the same shared module --
 * see upgrade.test.ts's header comment for what that leak looked like.
 */
export function formatUpgradeMessage(
  result: UpdateCheckResult,
  isGitCheckout: boolean,
): string[] {
  if (!result.local_version) {
    return ["No VERSION file found -- can't determine the current version."];
  }
  if (!result.remote_version) {
    return [
      `Local version ${result.local_version}. Could not reach the remote VERSION file ` +
        "(offline, or the distribution URL changed) -- can't check for an update right now.",
    ];
  }
  if (!result.upgrade_available) {
    return [`jstack is up to date (${result.local_version}).`];
  }

  const lines = [
    `Update available: ${result.local_version} -> ${result.remote_version}`,
  ];
  if (isGitCheckout) {
    lines.push("This is a git checkout. To upgrade:");
    lines.push("  git fetch origin");
    lines.push("  git checkout main && git pull");
  } else {
    lines.push(
      "Pin your package/git ref to the new version manually -- this checkout isn't a git " +
        "repo, so there's no single command that applies to every install method.",
    );
  }
  return lines;
}

/**
 * Real version check + concrete next step, replacing a stub that told users to run this
 * command (via doctor's own "see jstack upgrade" message) while doing nothing itself.
 * Does not attempt an automatic git pull / package upgrade -- that would need to know which
 * distribution mechanism installed this checkout, which isn't tracked anywhere. What it can
 * do honestly: report the real local/remote version gap and the right command for a git
 * checkout, which is how this repo is actually distributed today.
 */
export async function runUpgrade(): Promise<void> {
  const pluginRoot = findPluginRoot();
  const cfg = readConfigOptional(findProjectRoot());
  const versionUrl = (cfg?.distribution?.version_url ?? "").trim();
  const result = await checkDistributionUpdate(
    pluginRoot,
    versionUrl.length > 0 ? versionUrl : undefined,
  );
  const isGitCheckout = existsSync(join(pluginRoot, ".git"));
  const lines = formatUpgradeMessage(result, isGitCheckout);

  const color =
    !result.local_version || !result.remote_version
      ? chalk.yellow
      : result.upgrade_available
        ? chalk.blue
        : chalk.green;
  console.log(color(lines[0]));
  for (const line of lines.slice(1)) {
    console.log(line.startsWith("  ") ? chalk.dim(line) : line);
  }
}

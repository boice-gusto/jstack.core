#!/usr/bin/env bun
/**
 * Open the self-contained onboarding wizard in the default browser.
 *
 * The wizard is deliberately dependency-free and works over `file://`, so this is pure
 * convenience — printing the path is a valid fallback on any platform where we can't
 * hand off to a system opener.
 */
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const wizard = join(repoRoot, "onboarding", "wizard.html");

if (!existsSync(wizard)) {
  console.error(`Missing ${wizard}`);
  process.exit(1);
}

console.log(`Onboarding wizard: ${wizard}`);
console.log("Nothing is uploaded — it runs entirely in the browser.\n");

const opener =
  process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";

// `--no-open` keeps this usable in CI / headless shells, where launching a browser
// would either fail or hang.
if (process.argv.includes("--no-open")) process.exit(0);

const child = spawn(opener, [wizard], {
  stdio: "ignore",
  detached: true,
  shell: process.platform === "win32",
});

child.on("error", () => {
  console.log(`Could not launch "${opener}". Open the path above manually.`);
});
child.unref();

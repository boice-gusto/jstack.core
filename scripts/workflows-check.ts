#!/usr/bin/env bun
/**
 * Structural checks for jstack.core plugin JSON and skill trees, then runs
 * eval validate + quick (same gate as `package.json` `check`).
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ENCODING_UTF8 } from "../constants/paths.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_JSON: string[] = [
  join(".claude-plugin", "plugin.json"),
  join(".cursor-plugin", "plugin.json"),
  join(".codex-plugin", "plugin.json"),
  "hooks/hooks.json",
  join(".agents", "plugins", "marketplace.json"),
];

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

for (const rel of REQUIRED_JSON) {
  const p = join(root, rel);
  if (!existsSync(p)) fail(`Missing required file: ${rel}`);
  try {
    JSON.parse(readFileSync(p, ENCODING_UTF8));
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    fail(`Invalid JSON ${rel}: ${m}`);
  }
  console.log(`OK ${rel}`);
}

const skillsRoot = join(root, "skills");
if (!existsSync(skillsRoot)) fail("Missing skills/");

function walkSkillDirs(dir: string, rel: string): void {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (!statSync(p).isDirectory()) continue;
    const skillMd = join(p, "SKILL.md");
    if (existsSync(skillMd)) {
      console.log(`OK ${rel}/${name}/SKILL.md`);
    } else {
      walkSkillDirs(p, `${rel}/${name}`);
    }
  }
}
walkSkillDirs(skillsRoot, "skills");

const agentsRoot = join(root, "agents");
if (!existsSync(agentsRoot)) fail("Missing agents/");

const preamble = join(root, "prompts", "setup", "preamble.md");
if (!existsSync(preamble)) fail("Missing prompts/setup/preamble.md");

function runBun(args: string[]): void {
  const proc = Bun.spawnSync(["bun", ...args], {
    cwd: root,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (proc.exitCode !== 0) {
    fail(`bun ${args.join(" ")} failed with exit ${proc.exitCode}`);
  }
}

console.log("\n=== Agent markdown + jstack: refs ===\n");
runBun(["run", "scripts/agents-check.ts"]);

console.log("\n=== Eval YAML + structural (jstack.core runner) ===\n");
runBun(["run", "eval:validate"]);
runBun(["run", "eval:quick"]);

console.log("jstack.core workflows-check passed.");

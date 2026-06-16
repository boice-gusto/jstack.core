#!/usr/bin/env bun
/**
 * Report `references/deep-dive.md` presence for skills in DEEP_DIVE_SKILLS
 * (keep keys in sync with `scripts/apply_detailed_skills.py` DEEP_DIVE_SKILLS).
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE_ROOT = join(__dirname, "..");

/** Must match `DEEP_DIVE_SKILLS` in `apply_detailed_skills.py`. */
const DEEP_DIVE_KEYS: readonly string[] = [
  "prioritize",
  "sprint/planning",
  "research/competitive",
  "intake",
  "project",
];

function main(): void {
  const skillsRoot = join(CORE_ROOT, "skills");
  console.log("Deep-dive reference status (skills/references/deep-dive.md)\n");
  let missing = 0;
  for (const key of DEEP_DIVE_KEYS) {
    const deepPath = join(skillsRoot, ...key.split("/"), "references", "deep-dive.md");
    const skillMd = join(skillsRoot, ...key.split("/"), "SKILL.md");
    const hasSkill = existsSync(skillMd);
    const hasDeep = existsSync(deepPath);
    if (!hasDeep) {
      missing += 1;
    }
    const status = hasDeep ? "ok" : "MISSING";
    const skillNote = hasSkill ? "" : " (no SKILL.md)";
    console.log(`  ${key.padEnd(22)} ${status}${skillNote}`);
  }
  console.log("");
  if (missing > 0) {
    console.log(`${missing} skill(s) lack references/deep-dive.md. Add files before expanding DEEP_DIVE_SKILLS.`);
    process.exitCode = 1;
  } else {
    console.log("All listed skills have deep-dive references.");
  }
}

main();

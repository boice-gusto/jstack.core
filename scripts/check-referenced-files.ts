#!/usr/bin/env bun
/**
 * Fail when a skill's SKILL.md mentions a `templates/`, `prompts/`, or `skills/` path
 * (in prose or frontmatter `description:`) that doesn't exist on disk.
 *
 * A 2026-08 review found 4 `notion/*` skills whose description cited a
 * `templates/notion/<name>.json` file that had never been created (the design called for it in
 * 3 cases -- the templates were added; the 4th, `notion/standup`, never actually needed a static
 * template file, so its description was corrected to stop claiming one). Nothing else in
 * `bun run check` reads prose/description content against the filesystem, so a skill can cite a
 * path that never existed, or that existed once and was renamed out from under it, with no gate
 * catching it -- exactly what happened here.
 *
 * Deliberately mechanical, not semantic: this only checks that a *quoted path* exists, the same
 * binary fact `check-router-children.ts`/`validate-chains.ts` already check for chain targets.
 * It does not attempt to judge whether a description's *meaning* still matches its skill's body
 * (a text-similarity heuristic for that was prototyped and rejected -- see
 * check-description-references.ts's file comment for why: this codebase's own convention writes
 * a trigger description and a body mission statement in deliberately different words, so
 * word-overlap similarity is near-zero even for skills confirmed correct by hand, and can't
 * distinguish that from real drift).
 *
 * Two escapes, both required to avoid false positives on real, intentional patterns already in
 * this repo: (1) a path following "if present" / "if it exists" / "optional" within 80 chars is
 * a deliberately-optional reference (see skills/recon/SKILL.md) and is skipped; (2) a path
 * following "e.g." within 80 chars is a fill-in-the-blank example (see
 * skills/skill-creator/SKILL.md's `skills/my-domain/SKILL.md`) and is skipped.
 *
 * Usage:
 *   bun run scripts/check-referenced-files.ts
 *   bun run scripts/check-referenced-files.ts --strict
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverAllSkillRelativePaths } from "../evals/discover.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const skillsRoot = join(root, "skills");
const strict = process.argv.includes("--strict");

const PATH_RE =
  /`?((?:templates|prompts|skills)\/[a-zA-Z0-9_/.-]+\.(?:json|md|html))`?/g;
const HEDGE_RE = /if present|if it exists|optional|e\.g\./i;
const HEDGE_WINDOW = 80;

const relPaths = discoverAllSkillRelativePaths(skillsRoot);
const errors: string[] = [];
let refsChecked = 0;

for (const rel of relPaths) {
  const skillMdPath = join(
    skillsRoot,
    ...rel.split("/").filter(Boolean),
    "SKILL.md",
  );
  const text = readFileSync(skillMdPath, "utf8");

  for (const match of text.matchAll(PATH_RE)) {
    const p = match[1];
    const abs = join(root, p);
    if (existsSync(abs)) {
      refsChecked++;
      continue;
    }
    // "e.g." precedes the path ("e.g. `skills/my-domain/SKILL.md`"); "if present"/"optional"
    // follows it ("...jql-cookbook.md` if present.") -- check a window on both sides.
    const matchStart = match.index ?? 0;
    const matchEnd = matchStart + match[0].length;
    const context =
      text.slice(Math.max(0, matchStart - HEDGE_WINDOW), matchStart) +
      text.slice(matchEnd, matchEnd + HEDGE_WINDOW);
    if (HEDGE_RE.test(context)) continue; // deliberately optional or an example, not a real cite
    refsChecked++;
    errors.push(`${rel}/SKILL.md: references ${p}, which does not exist`);
  }
}

if (errors.length > 0) {
  console.error(
    `check-referenced-files found ${errors.length} broken reference(s):\n`,
  );
  for (const e of errors) console.error(`  - ${e}`);
  if (strict) process.exit(1);
} else {
  console.log(
    `check-referenced-files OK (${relPaths.length} skills scanned, ${refsChecked} file reference(s) resolved)`,
  );
}

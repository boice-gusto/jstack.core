#!/usr/bin/env bun
/**
 * Fail when a skill's frontmatter `description:` names a disambiguation target
 * ("use jstack:<slug> instead", "not for X, use jstack:<slug>") that doesn't resolve to a real
 * skill.
 *
 * A 2026-08 review found and hand-fixed 3 routing collisions between same-category sibling
 * skills (jira/append vs jira/update, notion/report vs notion/team-report,
 * self/draft-messages vs self/explain) by adding exactly this kind of "use X instead" prose to
 * each description. `validate-chains.ts` already resolves `<!-- chains-to: -->` comments against
 * the same `jstack:<slug>` naming convention, but nothing checks the *disambiguation* mentions
 * living in the `description:` field itself -- so a typo'd or renamed target there would silently
 * stop disambiguating (Claude picks the skill anyway, sees a dangling pointer, and the routing
 * ambiguity this prose exists to prevent comes right back) with no gate catching it.
 *
 * Deliberately narrow: this does NOT attempt to detect a routing collision by text similarity.
 * A same-category description-similarity heuristic was prototyped and rejected -- on this
 * repo's real content it flagged parent/child router relationships (a router describing its own
 * children) and skills that merely share domain vocabulary as false positives, with no reliable
 * way to tell those apart from a real collision without the judgment an LLM review pass already
 * provides. A noisy gate that cries wolf teaches people to ignore its real signals too, which is
 * worse than not gating at all -- see docs/agents-config-matrix.md's own history for why this
 * project treats a heuristic's precision as a hard requirement, not a nice-to-have. Detecting
 * *new* collisions stays a manual/LLM review task (see skills/skill-creator's own review
 * checklist); this script only keeps the disambiguation prose that already exists honest.
 *
 * Usage:
 *   bun run scripts/check-description-references.ts
 *   bun run scripts/check-description-references.ts --strict
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverAllSkillRelativePaths } from "../evals/discover.js";
import {
  buildSuffixToRelPath,
  chainStepSkillExists,
} from "../evals/chain-resolve.js";
import { parseYamlFrontmatter } from "./lib/parse-frontmatter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const skillsRoot = join(root, "skills");
const strict = process.argv.includes("--strict");

/** `use jstack:<slug>` or `` use `jstack:<slug>` ``, optionally followed by "instead". Matches
 * every disambiguation phrasing found in this repo's descriptions as of the check being written
 * (see file comment) -- widen if a new phrasing is introduced and this stops catching it. */
const USE_REF_RE = /use\s+`?jstack:([a-z0-9-/]+)`?/gi;

const relPaths = discoverAllSkillRelativePaths(skillsRoot);
const suffixToRel = buildSuffixToRelPath(skillsRoot, relPaths);
const errors: string[] = [];
let refsChecked = 0;

for (const rel of relPaths) {
  const skillMdPath = join(
    skillsRoot,
    ...rel.split("/").filter(Boolean),
    "SKILL.md",
  );
  const raw = readFileSync(skillMdPath, "utf8");
  const parsed = parseYamlFrontmatter(raw);
  const description =
    parsed.status === "ok" ? parsed.meta.description : undefined;
  if (typeof description !== "string") continue;

  for (const match of description.matchAll(USE_REF_RE)) {
    refsChecked++;
    const ref = `jstack:${match[1]}`;
    if (!chainStepSkillExists(skillsRoot, ref, suffixToRel)) {
      errors.push(
        `${rel}/SKILL.md: description references ${ref}, which does not resolve to a real skill`,
      );
    }
  }
}

if (errors.length > 0) {
  console.error(
    `check-description-references found ${errors.length} broken reference(s):\n`,
  );
  for (const e of errors) console.error(`  - ${e}`);
  if (strict) process.exit(1);
} else {
  console.log(
    `check-description-references OK (${relPaths.length} skills scanned, ${refsChecked} disambiguation reference(s) resolved)`,
  );
}

#!/usr/bin/env bun
/**
 * Skill names within one edit-distance must disambiguate each other in their descriptions.
 *
 * `jstack-workflow-builder` (skill-chain / routine / policy designer) and `jstack-workflows-builder`
 * (browser-flow YAML author) differ by a single letter and serve unrelated domains. Nothing surfaced
 * that: chain validation resolves both fine, and the depth gates score each on its own. A model or a
 * human picking from a 137-entry catalog by name alone has no way to tell them apart, and the failure
 * is silent — you get a browser script when you wanted a routine chain.
 *
 * The rule is not "no similar names" (renaming 137 skills is entangled with an unresolved naming
 * question). It is that a near-collision must be called out in BOTH descriptions, so whichever one the
 * reader lands on points at the other.
 *
 * Usage: bun run scripts/check-name-collisions.ts
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Glob } from "bun";

// `JSTACK_CHECK_ROOT` lets a test point this gate at a synthetic fixture tree. Production runs
// never set it, so behaviour is unchanged; without it these gates could only be verified by
// mutating the real repo, which is how earlier verification work destroyed uncommitted files.
const root = process.env.JSTACK_CHECK_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = join(root, "skills");

/** Levenshtein distance, capped early — we only care about <= 2. */
function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = tmp;
    }
  }
  return prev[b.length];
}

interface S { rel: string; name: string; desc: string }
const skills: S[] = [];
for (const rel of new Glob("**/SKILL.md").scanSync(skillsRoot)) {
  const raw = readFileSync(join(skillsRoot, rel), "utf8");
  const name = raw.match(/^name:\s*(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
  const desc = raw.match(/^description:\s*(.+)$/m)?.[1] ?? "";
  if (name) skills.push({ rel: dirname(rel), name, desc });
}

const errors: string[] = [];
for (let i = 0; i < skills.length; i++) {
  for (let j = i + 1; j < skills.length; j++) {
    const a = skills[i];
    const b = skills[j];
    if (distance(a.name, b.name) > 1) continue;
    // Each must name the other, so a reader landing on either is redirected.
    const aNamesB = a.desc.includes(b.name);
    const bNamesA = b.desc.includes(a.name);
    if (!aNamesB || !bNamesA) {
      const missing = [!aNamesB ? a.rel : null, !bNamesA ? b.rel : null].filter(Boolean).join(" and ");
      errors.push(
        `"${a.name}" (${a.rel}) and "${b.name}" (${b.rel}) differ by one character but serve different ` +
          `purposes. ${missing} must name the other in its description so a reader picking from the ` +
          `catalog by name is redirected.`,
      );
    }
  }
}

if (errors.length > 0) {
  console.error(`check-name-collisions FAILED — ${errors.length} undisambiguated near-collision(s):\n`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log(`check-name-collisions OK (${skills.length} skills; near-collisions all disambiguated)`);

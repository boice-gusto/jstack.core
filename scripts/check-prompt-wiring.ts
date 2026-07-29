#!/usr/bin/env bun
/**
 * Every file under `prompts/` must be loaded at runtime by at least one skill or agent.
 *
 * `prompts/` is injected verbatim into model prompts, so a file nothing loads changes no behaviour no
 * matter how good it is. Seven of twenty were in that state — both policy files, all three chains, both
 * unselected tones, and four of five personas. `review-policy.md` and `incident-policy.md` were read by
 * nothing at all, while `setup/preamble.md` was loaded 135 times: the `!cat ${CLAUDE_PLUGIN_ROOT}/...`
 * mechanism worked, it simply had never been applied to them. Rewriting an unloaded file for quality is
 * effort that reaches no model.
 *
 * A generic mention of the DIRECTORY does not count — `sdlc/SKILL.md` said "read from
 * prompts/policies/" for a long time while loading nothing. Only an actual `!cat` of the file counts.
 *
 * Usage: bun run scripts/check-prompt-wiring.ts
 */
import { readFileSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { Glob } from "bun";

// `JSTACK_CHECK_ROOT` lets a test point this gate at a synthetic fixture tree. Production runs
// never set it, so behaviour is unchanged; without it these gates could only be verified by
// mutating the real repo, which is how earlier verification work destroyed uncommitted files.
const root = process.env.JSTACK_CHECK_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "..");

/** Prompt files that are deliberately not `!cat`'d, each with a reason. */
const EXEMPT: Record<string, string> = {};

// Collect every `!cat`'d prompt path from skills and agents.
const loaded = new Map<string, Set<string>>();
for (const dir of ["skills", "agents"]) {
  for (const rel of new Glob("**/*.md").scanSync(join(root, dir))) {
    const body = readFileSync(join(root, dir, rel), "utf8");
    for (const m of body.matchAll(/!cat\s+\$\{CLAUDE_PLUGIN_ROOT\}\/(prompts\/[A-Za-z0-9_./-]+\.md)/g)) {
      if (!loaded.has(m[1])) loaded.set(m[1], new Set());
      loaded.get(m[1])!.add(`${dir}/${dirname(rel)}`);
    }
  }
}

const orphans: string[] = [];
let ok = 0;
for (const rel of new Glob("**/*.md").scanSync(join(root, "prompts"))) {
  const key = `prompts/${rel}`;
  if (key in EXEMPT) continue;
  if (loaded.has(key)) {
    ok++;
    continue;
  }
  orphans.push(key);
}

// A `!cat` of a prompt file that does not exist is the inverse failure.
const missing: string[] = [];
for (const [p, consumers] of loaded) {
  try {
    readFileSync(join(root, p), "utf8");
  } catch {
    missing.push(`${p} is !cat'd by ${[...consumers].join(", ")} but does not exist`);
  }
}

const errors = [
  ...orphans.map(
    (o) =>
      `${o} is loaded by nothing — inject it with ` +
      `\`!cat \${CLAUDE_PLUGIN_ROOT}/${o}\` from the skill whose domain it governs ` +
      `(see POLICY_LOADS in scripts/apply_detailed_skills.py), or add it to EXEMPT with a reason.`,
  ),
  ...missing,
];

if (errors.length > 0) {
  console.error(`check-prompt-wiring FAILED — ${errors.length} issue(s):\n`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log(`check-prompt-wiring OK (${ok} prompt file(s), all loaded by at least one skill or agent)`);
void relative;

/**
 * Extract the per-skill facts that make a generated eval specific to its skill.
 *
 * The problem this solves: 249 of 419 skill eval YAML files were byte-identical scaffold once the
 * skill name was normalized away. The worst were 107 copies of a negative case whose entire prompt
 * was "Reply with only the single word: pong" and 97 copies of a rubric that asked each skill to
 * describe itself, with `pass_threshold: 1` out of two generic criteria. None of them could fail for
 * a reason specific to the skill under test, so a skill could be badly wrong and still pass.
 *
 * Each SKILL.md already carries the material needed to write a real test — a declared out-of-scope
 * boundary, an output shape, and a failure-mode table. This module reads those out so the generator
 * can assert against them.
 *
 * Coverage across the 136 shipped skills at the time of writing:
 *   out-of-scope clause    84
 *   output-shape section  133
 *   failure-mode table    134
 *   chains-to targets      22
 *   write-gated (DMI)      40
 */
import { readFileSync } from "node:fs";

export interface SkillFacts {
  /** Frontmatter `name`, e.g. `jstack-jira-create`. */
  id: string;
  /** Repo-relative skill dir, e.g. `jira/create`. */
  rel: string;
  description: string;
  category: string;
  /** `disable-model-invocation: true` — a write/operational skill that must not self-trigger. */
  writeGated: boolean;
  /** Text of the `- **Out of scope:** ...` clause, or "" when the skill declares none. */
  outOfScope: string;
  /** Headings/labels the skill says it emits, from its `## Output shape` section. */
  outputLabels: string[];
  /** First-column entries of the `## Failure modes` table (the triggers). */
  failureTriggers: string[];
  /** `<!-- chains-to: jstack:foo -->` targets. */
  chainsTo: string[];
}

/**
 * Capture a markdown section body.
 *
 * Deliberately compiled WITHOUT the `m` flag: with it, `$` in the terminating lookahead means
 * end-of-line, so every section captured as empty. That silently reported 0 failure-mode tables
 * across 136 skills when there are in fact 134.
 */
function section(md: string, heading: string): string {
  const re = new RegExp(
    `\\n##+\\s+${heading}[^\\n]*\\n([\\s\\S]*?)(?=\\n##\\s|$)`,
    "i",
  );
  return (md.match(re)?.[1] ?? "").trim();
}

/** Words that mean a table row is the header, not a real trigger. */
const HEADER_CELL =
  /^(trigger|failure|symptom|mode|when|situation|condition|case|scenario)\b/i;

function tableFirstColumn(body: string): string[] {
  return [...body.matchAll(/^\|\s*([^|]+?)\s*\|/gm)]
    .map((m) => m[1].trim())
    .filter((c) => c.length > 0 && !/^[-:\s]+$/.test(c) && !HEADER_CELL.test(c))
    .map((c) => c.replace(/\*\*/g, "").replace(/`/g, "").trim())
    .filter((c) => c.length > 3);
}

/** Bold labels and bullet leaders the skill says it emits. */
function outputLabels(body: string): string[] {
  const labels = new Set<string>();
  for (const m of body.matchAll(/\*\*([^*]{3,60})\*\*/g))
    labels.add(m[1].trim().replace(/:$/, ""));
  for (const m of body.matchAll(
    /^\s*(?:[-*]|\d+\.)\s+([A-Z][^.\n—:]{3,50})(?=[—:.\n])/gm,
  )) {
    labels.add(m[1].trim());
  }
  return [...labels].filter((l) => !/^https?:/i.test(l)).slice(0, 6);
}

function frontmatterScalar(md: string, key: string): string {
  const m = md.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
}

export function extractSkillFacts(
  skillMdPath: string,
  rel: string,
): SkillFacts {
  const md = readFileSync(skillMdPath, "utf8");
  const failBody = section(md, "Failure modes");
  return {
    id: frontmatterScalar(md, "name") || `jstack-${rel.replace(/\//g, "-")}`,
    rel,
    description: frontmatterScalar(md, "description"),
    category: frontmatterScalar(md, "category"),
    writeGated: /^disable-model-invocation:\s*true\s*$/m.test(md),
    outOfScope:
      md.match(/^-\s+\*\*Out of scope:\*\*\s*(.+)$/m)?.[1]?.trim() ?? "",
    outputLabels: outputLabels(section(md, "Output shape")),
    failureTriggers: tableFirstColumn(failBody).slice(0, 4),
    chainsTo: [...md.matchAll(/chains-to:\s*([a-z0-9:_/-]+)/gi)].map(
      (m) => m[1],
    ),
  };
}

/**
 * Trim a declared out-of-scope clause into a short noun phrase usable inside a prompt.
 *
 * These clauses are written for a reader ("Actually posting — produce a draft for user approval.")
 * and often carry a trailing instruction after an em dash, plus markdown links. Only the part before
 * the dash names the thing the skill refuses to do.
 */
export function outOfScopeAsk(outOfScope: string): string {
  let s = outOfScope.split(/\s+—\s+|\s+--\s+/)[0];
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1"); // markdown links → text
  s = s.replace(/\*\*/g, "").replace(/`/g, "").trim();
  s = s.replace(/\.$/, "");
  // Drop a leading "If ..." conditional; it does not name an action.
  if (/^if\b/i.test(s)) s = s.replace(/^if[^,]*,\s*/i, "");
  return s;
}

/**
 * Resolve `jstack:...` chain step tokens to SKILL.md paths (same rules as validate-chains).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Same capture as scripts/agents-check.ts — suffix after `jstack-` in frontmatter name line. */
const NAME_LINE = /^name:\s*["']?jstack-([a-z0-9-]+)["']?\s*$/im;

export function buildSuffixToRelPath(
  skillsRoot: string,
  relPaths: string[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const rel of relPaths) {
    const skillMd = join(skillsRoot, ...rel.split("/").filter(Boolean), "SKILL.md");
    const raw = readFileSync(skillMd, "utf8");
    const m = raw.match(NAME_LINE);
    const suffix = m?.[1];
    if (suffix === undefined) {
      throw new Error(`${skillMd}: missing or invalid name: jstack-<suffix>`);
    }
    const prev = map.get(suffix);
    if (prev !== undefined) {
      throw new Error(
        `duplicate skill name suffix "${suffix}" (${prev} vs ${rel}); fix SKILL.md names`,
      );
    }
    map.set(suffix, rel);
  }
  return map;
}

function skillFileForPathParts(skillsRoot: string, parts: string[]): string {
  return join(skillsRoot, ...parts, "SKILL.md");
}

/** Absolute path to SKILL.md if it exists, else null. */
export function resolveChainStepSkillPath(
  skillsRoot: string,
  jstackRef: string,
  suffixToRel: Map<string, string>,
): string | null {
  const id = jstackRef.replace(/^jstack:/, "");
  if (id.includes("/")) {
    const pathParts = id.split("/").filter(Boolean);
    const p = skillFileForPathParts(skillsRoot, pathParts);
    return existsSync(p) ? p : null;
  }
  const direct = skillFileForPathParts(skillsRoot, [id]);
  if (existsSync(direct)) return direct;
  const rel = suffixToRel.get(id);
  if (rel !== undefined) {
    const p = skillFileForPathParts(skillsRoot, rel.split("/").filter(Boolean));
    return existsSync(p) ? p : null;
  }
  return null;
}

export function chainStepSkillExists(
  skillsRoot: string,
  jstackRef: string,
  suffixToRel: Map<string, string>,
): boolean {
  return resolveChainStepSkillPath(skillsRoot, jstackRef, suffixToRel) !== null;
}

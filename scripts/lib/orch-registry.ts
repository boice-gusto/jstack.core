import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface OrchRegistry {
  orchestrators: Set<string>;
  /** router -> raw comma string of children (annotations like "store-note (team / personal)" kept as-is). */
  children: Map<string, string>;
}

/**
 * Parses the `ORCH_CHILDREN` dict literal out of scripts/apply_detailed_skills.py -- the source
 * of truth `check-router-children.ts` enforces against disk and `validate-router-matrix.ts`
 * cross-checks against the eval matrix. `ORCHESTRATORS` is derived from the same dict's keys,
 * mirroring the Python source's own `ORCHESTRATORS = set(ORCH_CHILDREN.keys())` (2026-08 audit:
 * the two used to be independently hand-maintained set/dict literals with the same key set,
 * kept in sync only by discipline).
 */
export function loadOrchRegistry(root: string): OrchRegistry {
  const genSrc = readFileSync(
    join(root, "scripts", "apply_detailed_skills.py"),
    "utf8",
  );

  const childrenMatch = genSrc.match(/ORCH_CHILDREN\s*=\s*\{([\s\S]*?)\n\}/);
  if (!childrenMatch) {
    throw new Error("could not find ORCH_CHILDREN in apply_detailed_skills.py");
  }
  const children = new Map<string, string>();
  for (const line of childrenMatch[1].split("\n")) {
    const kv = line.match(/^\s*"([^"]+)":\s*"([^"]*)"/);
    if (kv) children.set(kv[1], kv[2]);
  }

  return { orchestrators: new Set(children.keys()), children };
}

import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface OrchRegistry {
  orchestrators: Set<string>;
  /** router -> raw comma string of children (annotations like "store-note (team / personal)" kept as-is). */
  children: Map<string, string>;
}

/**
 * Parses the `ORCHESTRATORS` set literal and `ORCH_CHILDREN` dict literal out of
 * scripts/apply_detailed_skills.py -- the source of truth `check-router-children.ts` enforces
 * against disk and `validate-router-matrix.ts` cross-checks against the eval matrix. Both used
 * to independently regex-parse the same Python source with near-identical regexes; any
 * formatting change to that file risked breaking one gate's parse while the other kept working,
 * since nothing kept them in lockstep.
 */
export function loadOrchRegistry(root: string): OrchRegistry {
  const genSrc = readFileSync(
    join(root, "scripts", "apply_detailed_skills.py"),
    "utf8",
  );

  const orchMatch = genSrc.match(/ORCHESTRATORS\s*=\s*\{([\s\S]*?)\}/);
  if (!orchMatch) {
    throw new Error("could not find ORCHESTRATORS in apply_detailed_skills.py");
  }
  const orchestrators = new Set(
    [...orchMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]),
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

  return { orchestrators, children };
}

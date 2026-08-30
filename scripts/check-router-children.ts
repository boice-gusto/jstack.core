#!/usr/bin/env bun
/**
 * Fail when a router skill's advertised child list disagrees with what is on disk.
 *
 * `ORCH_CHILDREN` in `scripts/apply_detailed_skills.py` drives the "## Sub-skills (pick the most
 * specific)" block in every orchestrator's generated body. It is hand-maintained, and it had drifted
 * on TEN of fifteen routers: `notion` omitted 5 real children, `incident` omitted 2 of 3, `sprint`
 * omitted 2 of 3, and so on. A user asking for a Notion standup page met a router that did not know
 * that child existed — and nothing failed, because the repo's other gates check eval coverage and
 * chain resolution, never the prose child list.
 *
 * Why a gate rather than deriving the list from disk: the order is curated and load-bearing. `jira`
 * reads "get, create, update, intake, transition, notify, append" — workflow order, not alphabetical
 * — which tells the model which child is the common case. Deriving would sort that information away.
 * So the list stays hand-ordered and this gate makes drift impossible instead.
 *
 * Also verifies the inverse: a router that claims to route in its `description` must actually be
 * registered in `ORCHESTRATORS`, or its generated body silently gets the non-routing template.
 * `computer-use` shipped in exactly that state — "Route computer-use requests…" in its description,
 * absent from `ORCHESTRATORS`, and no sub-skills index despite having a real child.
 *
 * Usage: bun run scripts/check-router-children.ts
 */
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYamlFrontmatter } from "./lib/parse-frontmatter.js";
import { loadOrchRegistry } from "./lib/orch-registry.js";

// `JSTACK_CHECK_ROOT` lets a test point this gate at a synthetic fixture tree. Production runs
// never set it, so behaviour is unchanged; without it these gates could only be verified by
// mutating the real repo, which is how earlier verification work destroyed uncommitted files.
const root =
  process.env.JSTACK_CHECK_ROOT ??
  join(dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = join(root, "skills");

/** Immediate subdirectories that are themselves skills. */
function diskChildren(router: string): string[] {
  const dir = join(skillsRoot, router);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, "SKILL.md")))
    .map((d) => d.name)
    .sort();
}

const { orchestrators, children } = loadOrchRegistry(root);
const errors: string[] = [];
let checked = 0;

// 1. Every registered router must advertise every child that exists on disk.
for (const [router, listed] of children) {
  checked++;
  const disk = diskChildren(router);
  if (disk.length === 0) {
    errors.push(
      `ORCH_CHILDREN lists "${router}" but skills/${router}/ has no child skills on disk.`,
    );
    continue;
  }
  // Substring match, because entries carry annotations like "store-note (team / personal)".
  const missing = disk.filter((c) => !listed.includes(c));
  if (missing.length > 0) {
    errors.push(
      `router "${router}" does not advertise ${missing.length} real child skill(s): ${missing.join(", ")} ` +
        `— add them to ORCH_CHILDREN["${router}"] in scripts/apply_detailed_skills.py and regenerate.`,
    );
  }
  // A listed child that does not exist sends the model at a dead route.
  const phantom = listed
    .split(",")
    .map((t) => t.trim().replace(/\s*\(.*\)$/, ""))
    .filter((t) => t.length > 0 && !disk.includes(t));
  if (phantom.length > 0) {
    errors.push(
      `router "${router}" advertises ${phantom.length} child(ren) that do not exist: ${phantom.join(", ")}.`,
    );
  }
  if (!orchestrators.has(router)) {
    errors.push(
      `"${router}" is in ORCH_CHILDREN but not in ORCHESTRATORS, so its index is never emitted.`,
    );
  }
}

// 2. A skill whose description claims to route must be registered as an orchestrator.
for (const entry of readdirSync(skillsRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const md = join(skillsRoot, entry.name, "SKILL.md");
  if (!existsSync(md)) continue;
  const raw = readFileSync(md, "utf8");
  // A block-scalar description (`description: >` / `|`) used to be invisible to the old
  // single-line regex here -- it would capture just the `>`/`|` marker itself, never the real
  // routing-claim text on the following lines. The shared parser handles block scalars.
  const parsedFm = parseYamlFrontmatter(raw);
  const parsedDescription =
    parsedFm.status === "ok" ? parsedFm.meta.description : undefined;
  const desc =
    typeof parsedDescription === "string"
      ? parsedDescription
      : (raw.match(/^description:\s*(.+)$/m)?.[1] ?? "");
  const claimsRouting =
    /^route\b|\brequests? to the (right|most specific)\b/i.test(desc);
  if (!claimsRouting) continue;
  if (diskChildren(entry.name).length === 0) {
    errors.push(
      `skills/${entry.name} says it routes ("${desc.slice(0, 60)}…") but has no child skills on disk.`,
    );
  } else if (!orchestrators.has(entry.name)) {
    errors.push(
      `skills/${entry.name} says it routes and has children, but is absent from ORCHESTRATORS — ` +
        `its generated body gets the non-routing template and no sub-skills index.`,
    );
  }
}

if (errors.length > 0) {
  console.error(`check-router-children FAILED — ${errors.length} issue(s):\n`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log(
  `check-router-children OK (${checked} router(s); child lists match disk)`,
);

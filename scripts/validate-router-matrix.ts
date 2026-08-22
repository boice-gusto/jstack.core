#!/usr/bin/env bun
/**
 * Ensures evals/router-skills.json and evals/scenarios/packs/router-matrix.yaml stay in sync:
 * one scenario per canonical router, scenario id matches router, each scenario targets only that router.
 *
 * Also cross-checks router-skills.json against `ORCHESTRATORS` in scripts/apply_detailed_skills.py —
 * the list that actually drives each router's generated "Sub-skills" index and real children on disk
 * (enforced by scripts/check-router-children.ts). The two lists answer different questions ("does this
 * skill route to children" vs. "does this skill have a routing-scenario eval") but nothing previously
 * required them to agree. `computer-use`, `design`, and `pe` are registered orchestrators with real
 * children on disk yet were absent from router-skills.json, so they got zero routing-scenario coverage
 * from `router-matrix.yaml` and no gate ever caught the gap — a router could gain real children and
 * still ship with no test proving requests route to them.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadScenarioPackFromPath } from "../evals/scenario-pack.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const routerJsonPath = join(root, "evals", "router-skills.json");
const matrixPackPath = join(
  root,
  "evals",
  "scenarios",
  "packs",
  "router-matrix.yaml",
);

interface RouterSkillsFile {
  routers: string[];
}

function sortedCopy(xs: string[]): string[] {
  return [...xs].sort();
}

/**
 * Orchestrators registered in scripts/apply_detailed_skills.py that declare at least one real
 * child (via ORCH_CHILDREN) — the same source-of-truth scripts/check-router-children.ts enforces
 * against disk. A router with zero declared children (e.g. a future orchestrator stub) is not
 * counted here; only skills that actually route to something belong in the eval matrix.
 */
function loadOrchestratorsWithChildren(): Set<string> {
  const genSrc = readFileSync(
    join(root, "scripts", "apply_detailed_skills.py"),
    "utf8",
  );
  const orchMatch = genSrc.match(/ORCHESTRATORS\s*=\s*\{([\s\S]*?)\}/);
  const childrenMatch = genSrc.match(/ORCH_CHILDREN\s*=\s*\{([\s\S]*?)\n\}/);
  if (!orchMatch || !childrenMatch) {
    throw new Error(
      "could not find ORCHESTRATORS/ORCH_CHILDREN in apply_detailed_skills.py",
    );
  }
  const orchestrators = new Set(
    [...orchMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]),
  );
  const withChildren = new Set<string>();
  for (const line of childrenMatch[1].split("\n")) {
    const kv = line.match(/^\s*"([^"]+)":\s*"([^"]*)"/);
    if (kv && kv[2].trim().length > 0 && orchestrators.has(kv[1])) {
      withChildren.add(kv[1]);
    }
  }
  return withChildren;
}

/**
 * Orchestrators deliberately excluded from router-skills.json, with a stated reason.
 *
 * `shortcuts` is a hand-authored (SKIP) skill that already carries a bespoke routing/out-of-scope
 * eval (`skills/shortcuts/evals/004-routing-and-out-of-scope-decline.yaml`) covering the same
 * ground the generated router-matrix scenario would — adding it to the generic matrix would
 * duplicate coverage rather than close a gap.
 */
const ORCHESTRATOR_EXEMPT: Record<string, string> = {
  shortcuts:
    "hand-authored routing/out-of-scope eval already exists (skills/shortcuts/evals/004-routing-and-out-of-scope-decline.yaml)",
};

/**
 * router-skills.json entries deliberately absent from ORCH_CHILDREN, with a stated reason.
 *
 * `federated-search` "routes" by selecting among external MCP providers (Jira, Notion, Slack,
 * etc.), not by dispatching to a child skill folder — it has no skills/federated-search/<child>
 * on disk and is not, and should not be, in apply_detailed_skills.py's ORCHESTRATORS.
 */
const ROUTER_JSON_EXEMPT: Record<string, string> = {
  "federated-search":
    "routes to external MCP providers, not child skills — see skills/federated-search/SKILL.md",
};

function main(): void {
  const errors: string[] = [];

  if (!existsSync(routerJsonPath)) {
    console.error(`Missing ${routerJsonPath}`);
    process.exit(1);
  }
  if (!existsSync(matrixPackPath)) {
    console.error(`Missing ${matrixPackPath}`);
    process.exit(1);
  }

  const { routers } = JSON.parse(
    readFileSync(routerJsonPath, "utf8"),
  ) as RouterSkillsFile;
  if (!Array.isArray(routers) || routers.length === 0) {
    console.error("router-skills.json: routers must be a non-empty array");
    process.exit(1);
  }

  const routerSet = new Set(routers);
  if (routerSet.size !== routers.length) {
    errors.push("router-skills.json: duplicate router entries");
  }

  // Cross-check against apply_detailed_skills.py's ORCHESTRATORS/ORCH_CHILDREN, the source of
  // truth check-router-children.ts already enforces against disk. A real orchestrator missing
  // here silently ships with zero routing-scenario coverage.
  const orchestratorsWithChildren = loadOrchestratorsWithChildren();
  for (const o of orchestratorsWithChildren) {
    if (ORCHESTRATOR_EXEMPT[o]) continue;
    if (!routerSet.has(o)) {
      errors.push(
        `"${o}" is a registered orchestrator with real children (ORCH_CHILDREN in ` +
          `scripts/apply_detailed_skills.py) but is missing from router-skills.json — it gets no ` +
          `routing-scenario coverage from router-matrix.yaml. Add it to router-skills.json's ` +
          `"routers" and add a matching scenario to evals/scenarios/packs/router-matrix.yaml, or add ` +
          `it to ORCHESTRATOR_EXEMPT here with a reason.`,
      );
    }
  }
  for (const r of routers) {
    if (orchestratorsWithChildren.has(r) || ROUTER_JSON_EXEMPT[r]) continue;
    errors.push(
      `router-skills.json lists "${r}" but it is not a registered orchestrator with real ` +
        `children in scripts/apply_detailed_skills.py (ORCHESTRATORS + ORCH_CHILDREN) — either it ` +
        `is stale, or it routes to something other than child skills (e.g. external providers) and ` +
        `should be added to ROUTER_JSON_EXEMPT here with a reason.`,
    );
  }

  let pack;
  try {
    pack = loadScenarioPackFromPath(matrixPackPath);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }

  if (pack.id !== "router-matrix") {
    errors.push(
      `router-matrix pack id must be "router-matrix", got "${pack.id}"`,
    );
  }

  const targetSet = new Set(pack.default_targets);
  for (const r of routers) {
    if (!targetSet.has(r)) {
      errors.push(`router ${r} missing from router-matrix default_targets`);
    }
  }
  for (const t of pack.default_targets) {
    if (!routerSet.has(t)) {
      errors.push(
        `router-matrix default_targets has "${t}" not listed in router-skills.json`,
      );
    }
  }

  const scenarioIds = new Set<string>();
  for (const s of pack.scenarios) {
    if (scenarioIds.has(s.id)) {
      errors.push(`duplicate scenario id: ${s.id}`);
    }
    scenarioIds.add(s.id);

    if (!routerSet.has(s.id)) {
      errors.push(
        `scenario id "${s.id}" is not a canonical router from router-skills.json`,
      );
    }

    const tg = s.targets;
    if (tg == null || tg.length !== 1 || tg[0] !== s.id) {
      errors.push(
        `scenario "${s.id}" must have targets: [${s.id}] (got ${JSON.stringify(tg ?? null)})`,
      );
    }
  }

  for (const r of routers) {
    if (!scenarioIds.has(r)) {
      errors.push(`missing router-matrix scenario with id "${r}"`);
    }
  }

  if (pack.scenarios.length !== routers.length) {
    errors.push(
      `expected ${routers.length} scenarios (one per router), got ${pack.scenarios.length}`,
    );
  }

  if (
    sortedCopy(pack.default_targets).join(",") !== sortedCopy(routers).join(",")
  ) {
    errors.push(
      "default_targets must list the same routers as router-skills.json (order may differ)",
    );
  }

  if (errors.length) {
    console.error("Router matrix validation failed:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log(
    `Router matrix OK (${routers.length} routers; pack ${pack.id}; scenarios ${pack.scenarios.length}).`,
  );
}

main();

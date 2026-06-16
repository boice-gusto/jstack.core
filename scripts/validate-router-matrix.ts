#!/usr/bin/env bun
/**
 * Ensures evals/router-skills.json and evals/scenarios/packs/router-matrix.yaml stay in sync:
 * one scenario per canonical router, scenario id matches router, each scenario targets only that router.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadScenarioPackFromPath } from "../evals/scenario-pack.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const routerJsonPath = join(root, "evals", "router-skills.json");
const matrixPackPath = join(root, "evals", "scenarios", "packs", "router-matrix.yaml");

interface RouterSkillsFile {
  routers: string[];
}

function sortedCopy(xs: string[]): string[] {
  return [...xs].sort();
}

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

  const { routers } = JSON.parse(readFileSync(routerJsonPath, "utf8")) as RouterSkillsFile;
  if (!Array.isArray(routers) || routers.length === 0) {
    console.error("router-skills.json: routers must be a non-empty array");
    process.exit(1);
  }

  const routerSet = new Set(routers);
  if (routerSet.size !== routers.length) {
    errors.push("router-skills.json: duplicate router entries");
  }

  let pack;
  try {
    pack = loadScenarioPackFromPath(matrixPackPath);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }

  if (pack.id !== "router-matrix") {
    errors.push(`router-matrix pack id must be "router-matrix", got "${pack.id}"`);
  }

  const targetSet = new Set(pack.default_targets);
  for (const r of routers) {
    if (!targetSet.has(r)) {
      errors.push(`router ${r} missing from router-matrix default_targets`);
    }
  }
  for (const t of pack.default_targets) {
    if (!routerSet.has(t)) {
      errors.push(`router-matrix default_targets has "${t}" not listed in router-skills.json`);
    }
  }

  const scenarioIds = new Set<string>();
  for (const s of pack.scenarios) {
    if (scenarioIds.has(s.id)) {
      errors.push(`duplicate scenario id: ${s.id}`);
    }
    scenarioIds.add(s.id);

    if (!routerSet.has(s.id)) {
      errors.push(`scenario id "${s.id}" is not a canonical router from router-skills.json`);
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

  if (sortedCopy(pack.default_targets).join(",") !== sortedCopy(routers).join(",")) {
    errors.push("default_targets must list the same routers as router-skills.json (order may differ)");
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

#!/usr/bin/env bun
/**
 * Validates `<!-- chains-to: ... -->` in each skill's SKILL.md under skills/.
 * Every well-formed `jstack:<slug>` must resolve to an existing SKILL.md:
 * - Slash form `jstack:foo/bar` → skills/foo/bar/SKILL.md (same as run-evals runChain).
 * - Hyphen form `jstack:foo-bar` → skills/foo-bar/SKILL.md if present, else match
 *   `name: jstack-<suffix>` suffix the same way as scripts/agents-check.ts (suffix maps to rel path).
 * Also validates evals/chain-evals.json step targets exist (structural only).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverAllSkillRelativePaths } from "../evals/discover.js";
import {
  buildSuffixToRelPath,
  chainStepSkillExists,
} from "../evals/chain-resolve.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const skillsRoot = join(root, "skills");
const chainEvalsPath = join(root, "evals", "chain-evals.json");

/** Well-formed gate-style tokens (path or hyphen slug). */
const JSTACK_TOKEN = /\bjstack:([a-z0-9-/]+)\b/g;

const CHAINS_TO_COMMENT = /<!--\s*chains-to:\s*([\s\S]*?)\s*-->/gi;

interface ChainEvalsFile {
  chains?: { name: string; steps: string[] }[];
}

function validateChainEvalsJson(errors: string[], suffixToRel: Map<string, string>): void {
  if (!existsSync(chainEvalsPath)) {
    errors.push(`missing ${chainEvalsPath}`);
    return;
  }
  let data: ChainEvalsFile;
  try {
    data = JSON.parse(readFileSync(chainEvalsPath, "utf8")) as ChainEvalsFile;
  } catch (e) {
    errors.push(`chain-evals.json: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }
  const chains = data.chains;
  if (!Array.isArray(chains)) {
    errors.push("chain-evals.json: expected top-level { chains: [...] }");
    return;
  }
  for (const c of chains) {
    if (typeof c.name !== "string" || !Array.isArray(c.steps)) {
      errors.push(`chain-evals: invalid entry ${JSON.stringify(c)}`);
      continue;
    }
    for (const step of c.steps) {
      const s = String(step);
      if (!s.startsWith("jstack:")) {
        errors.push(`chain ${c.name}: step "${s}" must start with jstack:`);
        continue;
      }
      if (!chainStepSkillExists(skillsRoot, s, suffixToRel)) {
        errors.push(`chain ${c.name}: missing SKILL.md for ${s}`);
      }
    }
  }
}

/**
 * Routine chains live in TWO places and neither was validated:
 *   - `config/defaults.json` → `routines.<id>.chain` (bare slugs, read by `listRoutinesFromConfig`)
 *   - `config/schedules/<id>.json` → `chain` (`jstack:`-prefixed, read by `loadScheduleFile`)
 *
 * Three failure modes were possible silently:
 *   1. a chain step naming a skill that does not exist (fails only at run time),
 *   2. the two sources disagreeing about which skills a routine actually runs,
 *   3. a routine id (`weekly_digest`) never matching its schedule filename (`weekly-digest.json`),
 *      so `loadScheduleFile` returns null for it.
 */
function validateRoutineChains(
  errors: string[],
  warnings: string[],
  suffixToRel: Map<string, string>,
): void {
  const defaultsPath = join(root, "config", "defaults.json");
  if (!existsSync(defaultsPath)) return;

  let routines: Record<string, { chain?: unknown }> = {};
  try {
    const defaults = JSON.parse(readFileSync(defaultsPath, "utf8")) as Record<string, unknown>;
    routines = (defaults.routines as Record<string, { chain?: unknown }>) ?? {};
  } catch (e) {
    errors.push(`config/defaults.json is unparseable: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }

  const normalize = (step: string) => (step.startsWith("jstack:") ? step : `jstack:${step}`);
  const schedulesDir = join(root, "config", "schedules");

  for (const [id, routine] of Object.entries(routines)) {
    const configChain = Array.isArray(routine?.chain) ? (routine.chain as unknown[]).map(String) : [];

    for (const step of configChain) {
      if (!chainStepSkillExists(skillsRoot, normalize(step), suffixToRel)) {
        errors.push(`config/defaults.json routines.${id}.chain references missing skill "${step}"`);
      }
    }

    // `loadScheduleFile` looks up `config/schedules/<routine-id>.json` verbatim, so an id
    // with underscores can never reach a hyphenated filename.
    const exactPath = join(schedulesDir, `${id}.json`);
    const hyphenId = id.replace(/_/g, "-");
    const hyphenPath = join(schedulesDir, `${hyphenId}.json`);
    if (!existsSync(exactPath) && existsSync(hyphenPath)) {
      errors.push(
        `routine id "${id}" cannot resolve its schedule file: loadScheduleFile() reads ` +
          `config/schedules/${id}.json but the file on disk is ${hyphenId}.json. ` +
          `Rename the file to ${id}.json, or rename the routine key to "${hyphenId}".`,
      );
    }

    const schedulePath = existsSync(exactPath) ? exactPath : existsSync(hyphenPath) ? hyphenPath : null;
    if (!schedulePath) continue;

    let scheduleChain: string[] = [];
    try {
      const schedule = JSON.parse(readFileSync(schedulePath, "utf8")) as { chain?: unknown };
      scheduleChain = Array.isArray(schedule.chain) ? (schedule.chain as unknown[]).map(String) : [];
    } catch (e) {
      errors.push(`${schedulePath} is unparseable: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }

    for (const step of scheduleChain) {
      if (!chainStepSkillExists(skillsRoot, normalize(step), suffixToRel)) {
        errors.push(`${schedulePath} chain references missing skill "${step}"`);
      }
    }

    // Both sources are live and read independently, so a divergence means the routine's
    // behavior depends on which reader ran — that is a correctness problem, not cosmetics.
    if (configChain.length > 0 && scheduleChain.length > 0) {
      const a = configChain.map(normalize).join(" → ");
      const b = scheduleChain.map(normalize).join(" → ");
      if (a !== b) {
        warnings.push(
          `routine "${id}" chain differs between sources — defaults.json says [${a}] but ` +
            `config/schedules/${hyphenId}.json says [${b}]. Both are read independently; ` +
            `reconcile them so the routine runs the same steps either way.`,
        );
      }
    }
  }
}

function main(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  const relPaths = discoverAllSkillRelativePaths(skillsRoot);
  let suffixToRel: Map<string, string>;
  try {
    suffixToRel = buildSuffixToRelPath(skillsRoot, relPaths);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }

  for (const rel of relPaths) {
    const skillMd = join(skillsRoot, ...rel.split("/").filter(Boolean), "SKILL.md");
    const text = readFileSync(skillMd, "utf8");

    let m: RegExpExecArray | null;
    const re = new RegExp(CHAINS_TO_COMMENT.source, CHAINS_TO_COMMENT.flags);
    while ((m = re.exec(text)) !== null) {
      const body = m[1]?.trim() ?? "";
      if (body.length === 0) continue;

      const tokens: string[] = [];
      let tm: RegExpExecArray | null;
      const tokRe = new RegExp(JSTACK_TOKEN.source, JSTACK_TOKEN.flags);
      while ((tm = tokRe.exec(body)) !== null) {
        tokens.push(`jstack:${tm[1]}`);
      }

      if (tokens.length === 0) {
        warnings.push(
          `${rel}/SKILL.md: chains-to has no well-formed jstack:<slug> tokens: ${JSON.stringify(body.slice(0, 120))}`,
        );
        continue;
      }

      const stripped = body.replace(/\bjstack:[a-z0-9-/]+\b/g, "").replace(/[\s,]+/g, "").trim();
      if (stripped.length > 0) {
        warnings.push(
          `${rel}/SKILL.md: chains-to may contain prose outside jstack tokens: ${JSON.stringify(body.slice(0, 160))}`,
        );
      }

      for (const t of tokens) {
        if (!chainStepSkillExists(skillsRoot, t, suffixToRel)) {
          errors.push(`${rel}/SKILL.md: chains-to references missing skill ${t}`);
        }
      }
    }
  }

  validateChainEvalsJson(errors, suffixToRel);
  validateRoutineChains(errors, warnings, suffixToRel);

  for (const w of warnings) console.warn(`WARN ${w}`);
  if (errors.length) {
    console.error("validate-chains failed:");
    for (const e of errors) console.error(`  ${e}`);
    process.exit(1);
  }

  console.log(
    `validate-chains OK (${relPaths.length} skills scanned; chain-evals structural check OK).`,
  );
}

main();

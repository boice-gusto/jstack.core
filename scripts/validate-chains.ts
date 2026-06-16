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

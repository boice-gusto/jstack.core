#!/usr/bin/env bun
/**
 * Generate per-skill semantic eval YAML: smoke (001), boundary (002), graded rubric (003), plus a
 * routing case (004) for canonical orchestrators.
 *
 * The problem this rewrite fixes: 249 of 419 eval files were byte-identical scaffold once the skill
 * name was normalized away, because the negative and rubric documents were module-level constants.
 * 107 skills shared a negative case whose entire prompt was "Reply with only the single word: pong",
 * and 97 shared a rubric asking each skill to describe itself with `pass_threshold: 1` of two generic
 * items. None could fail for a reason specific to the skill under test. The document builders now
 * live in `scripts/lib/skill-eval-docs.ts` and derive their assertions from each SKILL.md's declared
 * out-of-scope clause, unique description, and failure-mode table. (`## Output shape` was tried and
 * rejected: it is templated boilerplate, so 133 skills yield identical labels.)
 *
 * Two modes, because the old generator could only ever CREATE:
 *   (default)   fill gaps only — a skill that already has enough cases is left alone
 *   --rewrite   also upgrade files that are recognizably generated scaffold
 *
 * `--rewrite` will never touch a hand-authored eval. A file is only eligible if it carries the
 * `generated-by:` marker this script writes, or matches a known legacy template signature. Anything
 * else is counted as "kept hand-authored" and left exactly as it is — the same protection the `SKIP`
 * set provides for hand-maintained SKILL.md bodies.
 *
 * Usage:
 *   bun run scripts/generate-skill-evals.ts [--dry-run]
 *   bun run scripts/generate-skill-evals.ts --rewrite [--dry-run]
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import {
  discoverAllSkillRelativePaths,
  discoverEvalCases,
} from "../evals/discover.js";
import { extractSkillFacts } from "./lib/skill-eval-facts.js";
import { parseYamlFrontmatter } from "./lib/parse-frontmatter.js";
import {
  GENERATED_MARKER,
  NEG_NAME,
  RUBRIC_NAME,
  SMOKE_NAME,
  boundaryDoc,
  rubricDoc,
  smokeDoc,
  type EvalDoc,
} from "./lib/skill-eval-docs.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const skillsRoot = join(root, "skills");
const PARAPHRASE_NAME = "004-paraphrase-routing.yaml";

const dry = process.argv.includes("--dry-run");
const rewrite = process.argv.includes("--rewrite");

/** The marker value written into every generated file (without the `generated-by: ` key prefix). */
const MARKER_VALUE = GENERATED_MARKER.split(": ")[1];

/**
 * Signatures of the scaffold this script used to emit.
 *
 * Needed because the 249 pre-existing files predate the `generated-by:` marker. Each signature is a
 * string only the old template contains, so a match is proof the file was machine-written.
 */
const LEGACY_SIGNATURES: Record<string, string[]> = {
  [NEG_NAME]: ["Reply with only the single word: pong"],
  [RUBRIC_NAME]: [
    "Identifies a purpose, audience, or primary use of the skill",
    "response states what the skill is for, when to use it, or which role it helps",
  ],
  [SMOKE_NAME]: [
    "Outline what you would produce for a **hypothetical** internal request",
  ],
  // All 16 orchestrator routing cases were byte-identical: the old template had no per-skill part.
  [PARAPHRASE_NAME]: [
    "Names a concrete child route, child skill folder, or one focused clarifying question",
    "Does not present fictional ticket keys, channel IDs, or verified API results",
  ],
};

/** Is this file safe to overwrite? Only marker-bearing or known-legacy files are. */
function isGenerated(path: string, filename: string): boolean {
  if (!existsSync(path)) return true; // nothing to lose
  const body = readFileSync(path, "utf8");
  if (body.includes(MARKER_VALUE)) return true;
  const sigs = LEGACY_SIGNATURES[filename] ?? [];
  return sigs.length > 0 && sigs.every((s) => body.includes(s));
}

function dumpDoc(doc: EvalDoc | Record<string, unknown>): string {
  return yaml.dump(doc, { lineWidth: 100, noRefs: true });
}

function loadCanonicalRouters(): Set<string> {
  const path = join(root, "evals", "router-skills.json");
  if (!existsSync(path)) {
    throw new Error(
      `Missing ${path} (canonical router list for paraphrase eval generation)`,
    );
  }
  const raw = JSON.parse(readFileSync(path, "utf8")) as { routers?: unknown };
  if (!Array.isArray(raw.routers))
    throw new Error(`${path}: expected { routers: string[] }`);
  return new Set(raw.routers.map((r) => String(r)));
}

function str(v: unknown, max = 400): string {
  if (v == null) return "";
  const s = String(v).trim();
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

/**
 * Frontmatter for the paraphrase-routing case only (skillId falls back to a derived name,
 * and `whenToUse` degrading to "" is harmless — see call site). This used to swallow ANY
 * parse error and return `{}` with zero indication anything failed, which is the same
 * silent-failure shape that once cost 27/137 skill files their frontmatter (see the comment
 * in `skills-depth-check.ts`). Warn to stderr instead so a broken SKILL.md is visible, then
 * continue with the same safe empty-frontmatter fallback rather than dropping the skill from
 * eval generation entirely.
 */
function parseFrontmatter(md: string, rel: string): Record<string, unknown> {
  const parsed = parseYamlFrontmatter(md);
  if (parsed.status !== "ok") {
    const reason =
      parsed.status === "invalid" ? parsed.error : "missing YAML frontmatter";
    console.error(
      `generate-skill-evals: ${rel}/SKILL.md frontmatter failed to parse (${reason}) — ` +
        "using empty frontmatter for this skill's paraphrase-routing case.",
    );
    return {};
  }
  return parsed.meta;
}

interface Tally {
  created: number;
  upgraded: number;
  keptHandAuthored: number;
  unchanged: number;
  fallbacks: Map<string, string[]>;
}

function main(): void {
  const canonicalRouters = loadCanonicalRouters();
  const t: Tally = {
    created: 0,
    upgraded: 0,
    keptHandAuthored: 0,
    unchanged: 0,
    fallbacks: new Map(),
  };

  for (const rel of discoverAllSkillRelativePaths(skillsRoot)) {
    const skillPath = join(skillsRoot, ...rel.split("/"));
    const evalsDir = join(skillPath, "evals");
    const facts = extractSkillFacts(join(skillPath, "SKILL.md"), rel);

    const planned: Array<[string, EvalDoc]> = [
      [SMOKE_NAME, smokeDoc(facts)],
      [NEG_NAME, boundaryDoc(facts)],
      [RUBRIC_NAME, rubricDoc(facts)],
    ];

    // Gap-fill mode preserves the old behavior: leave a skill alone once it has enough cases.
    const enough = discoverEvalCases(skillPath, 120).length >= 3;

    for (const [filename, doc] of planned) {
      const out = join(evalsDir, filename);
      const exists = existsSync(out);

      if (exists && !rewrite) {
        t.unchanged++;
        continue;
      }
      if (!exists && enough && !rewrite) {
        t.unchanged++;
        continue;
      }
      if (exists && !isGenerated(out, filename)) {
        t.keptHandAuthored++;
        continue;
      }

      const body = dumpDoc(doc);
      if (exists && readFileSync(out, "utf8") === body) {
        t.unchanged++;
        continue;
      }

      if (!dry) {
        mkdirSync(evalsDir, { recursive: true });
        writeFileSync(out, body);
      }
      if (exists) t.upgraded++;
      else t.created++;

      if (doc["generic-fallback"]) {
        const list = t.fallbacks.get(filename) ?? [];
        list.push(rel);
        t.fallbacks.set(filename, list);
      }
    }
  }

  // ── Paraphrase routing, canonical orchestrators only ────────────────────────
  let paraphrase = 0;
  for (const rel of discoverAllSkillRelativePaths(skillsRoot)) {
    if (!canonicalRouters.has(rel)) continue;
    const skillPath = join(skillsRoot, ...rel.split("/"));
    const evalsDir = join(skillPath, "evals");
    const paraphrasePath = join(evalsDir, PARAPHRASE_NAME);
    if (!existsSync(evalsDir)) continue;
    if (
      existsSync(paraphrasePath) &&
      !isGenerated(paraphrasePath, PARAPHRASE_NAME)
    ) {
      t.keptHandAuthored++;
      continue;
    }
    if (existsSync(paraphrasePath) && !rewrite) continue;

    const md = readFileSync(join(skillPath, "SKILL.md"), "utf8");
    const fm = parseFrontmatter(md, rel);
    const skillId = str(fm.name) || `jstack-${rel.replace(/\//g, "-")}`;
    const whenToUse =
      typeof fm.when_to_use === "string" ? str(fm.when_to_use, 400) : "";
    const facts = extractSkillFacts(join(skillPath, "SKILL.md"), rel);

    // Real child routes, so the criterion can name what this orchestrator actually owns.
    const children = readdirSync(skillPath, { withFileTypes: true })
      .filter(
        (d) =>
          d.isDirectory() && existsSync(join(skillPath, d.name, "SKILL.md")),
      )
      .map((d) => d.name);

    const criteria = [
      "Names a concrete child route, child skill folder, or one focused clarifying question",
      "Does not present fictional ticket keys, channel IDs, or verified API results",
    ];
    if (children.length > 0) {
      criteria.push(
        `Any named route is one this orchestrator actually owns: ${children.join(", ")}`,
      );
    }
    if (facts.outOfScope) {
      criteria.push(
        "Does not absorb work the skill declares out of scope; routes or declines it",
      );
    }

    const paraphraseDoc: Record<string, unknown> = {
      name: "Orchestrator routing — paraphrased user request",
      prompt: [
        `You are applying the jstack skill **${skillId}** (path: \`${rel}\`) — a **domain orchestrator**. Child skills live under \`skills/${rel}/\`.`,
        whenToUse ? `Discovery triggers (when_to_use): ${whenToUse}` : "",
        "",
        "User request: The user describes what they want using **informal language** (no jstack skill names, no slash commands).",
        "",
        "Respond with: (1) the **single** child skill you would route to first **or** (2) **one** clarifying question you would ask before routing. Do not claim you called Slack, Jira, Notion, GitHub, or gbrain. Keep under ~300 words.",
      ]
        .filter(Boolean)
        .join("\n"),
      criteria,
      expect_skill: true,
      timeout: 120,
      "generated-by": MARKER_VALUE,
    };

    const body = dumpDoc(paraphraseDoc);
    if (
      existsSync(paraphrasePath) &&
      readFileSync(paraphrasePath, "utf8") === body
    )
      continue;
    if (!dry) writeFileSync(paraphrasePath, body);
    paraphrase++;
  }

  // ── Report ──────────────────────────────────────────────────────────────────
  const p = dry ? "[dry-run] would " : "";
  console.log(
    `${p}create ${t.created}, ${p}upgrade ${t.upgraded} scaffold file(s).`,
  );
  console.log(
    `kept hand-authored: ${t.keptHandAuthored}   already current: ${t.unchanged}`,
  );
  console.log(`paraphrase routing: ${p}write ${paraphrase}`);

  // Never let a weaker generic form pass silently. A skill with no out-of-scope clause falls back to
  // the old trivia case, and that is a real coverage gap worth naming rather than burying in a count.
  if (t.fallbacks.size > 0) {
    console.log(
      "\nGeneric fallbacks used (per-skill fact missing from SKILL.md):",
    );
    for (const [filename, skills] of [...t.fallbacks].sort()) {
      console.log(`  ${filename}: ${skills.length} skill(s)`);
      if (filename === NEG_NAME) {
        console.log(
          "    No `- **Out of scope:**` clause, so no per-skill boundary test could be",
        );
        console.log(
          "    derived. Adding one upgrades these to real refusal tests.",
        );
      }
    }
  }
}

main();

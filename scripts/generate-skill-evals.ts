#!/usr/bin/env bun
/**
 * Ensures every skill under skills/ has at least two semantic eval YAML files (smoke + negative)
 * and, when still missing, a third `003-graded-assert.yaml` with `grading.rubric` + `assert` blocks
 * (LLM judge + programmatic checks, merged in evals/grade.ts).
 *
 * Usage: bun run scripts/generate-skill-evals.ts [--dry-run]
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { discoverAllSkillRelativePaths, discoverEvalCases } from "../evals/discover.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const skillsRoot = join(root, "skills");

const SMOKE_NAME = "001-skill-smoke.yaml";
const NEG_NAME = "002-negative-trivia.yaml";
const RUBRIC_NAME = "003-graded-assert.yaml";
const PARAPHRASE_NAME = "004-paraphrase-routing.yaml";

function loadCanonicalRouters(): Set<string> {
  const path = join(root, "evals", "router-skills.json");
  if (!existsSync(path)) {
    throw new Error(`Missing ${path} (canonical router list for paraphrase eval generation)`);
  }
  const raw = JSON.parse(readFileSync(path, "utf8")) as { routers?: unknown };
  if (!Array.isArray(raw.routers)) {
    throw new Error(`${path}: expected { routers: string[] }`);
  }
  return new Set(raw.routers.map((r) => String(r)));
}

function countEvalCaseFiles(evalsDir: string): number {
  if (!existsSync(evalsDir)) return 0;
  return readdirSync(evalsDir).filter(
    (f) =>
      (f.endsWith(".yaml") || f.endsWith(".yml")) &&
      f !== "eval-config.yaml" &&
      f !== "eval-config.yml",
  ).length;
}

function parseFrontmatter(md: string): Record<string, unknown> {
  if (!md.startsWith("---\n")) return {};
  const end = md.indexOf("\n---\n", 4);
  if (end === -1) return {};
  try {
    const block = md.slice(4, end);
    return (yaml.load(block) as Record<string, unknown>) ?? {};
  } catch {
    return {};
  }
}

function str(v: unknown, max = 400): string {
  if (v == null) return "";
  const s = String(v).trim();
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

function main() {
  const canonicalRouters = loadCanonicalRouters();
  const dry = process.argv.includes("--dry-run");
  let created = 0;
  let skipped = 0;
  let createdRubric = 0;
  let skippedRubric = 0;

  for (const rel of discoverAllSkillRelativePaths(skillsRoot)) {
    const skillPath = join(skillsRoot, ...rel.split("/"));
    const evalsDir = join(skillPath, "evals");
    const skillMd = join(skillPath, "SKILL.md");
    const md = readFileSync(skillMd, "utf8");
    const fm = parseFrontmatter(md);
    const skillId = str(fm.name) || `jstack-${rel.replace(/\//g, "-")}`;
    const description = str(fm.description, 350);
    const category = str(fm.category);

    const existing = discoverEvalCases(skillPath, 120);
    if (existing.length >= 2) {
      skipped++;
      continue;
    }

    const hasSmoke = existsSync(join(evalsDir, SMOKE_NAME));
    const hasNeg = existsSync(join(evalsDir, NEG_NAME));
    mkdirSync(evalsDir, { recursive: true });

    const smokeDoc = {
      name: "Skill smoke — outline without live integrations",
      prompt: [
        `You are applying the jstack skill **${skillId}** (path: \`${rel}\`).`,
        category ? `Category: ${category}.` : "",
        description ? `Skill description: ${description}` : "",
        "",
        "User request: Outline what you would produce for a **hypothetical** internal request. Include section headings or a short numbered plan and **one example bullet** per section. Do **not** claim to have called Slack, Jira, Notion, GitHub, or gbrain APIs; say what you would need from config or the user if required.",
        "",
        "Keep the response under ~400 words.",
      ]
        .filter(Boolean)
        .join("\n"),
      criteria: [
        "Provides more than one section, step, or labeled part (not a single-sentence stub)",
        "Explicitly avoids presenting fictional ticket IDs, channel IDs, customer names, or real URLs as verified facts",
        "Mentions configuration, user approval, pasted context, or tool limits where the skill would need them, OR states assumptions clearly",
      ],
      expect_skill: true,
      timeout: 120,
    };

    const negDoc = {
      name: "Negative — minimal reply (no full skill run)",
      prompt: "Reply with only the single word: pong",
      criteria: [
        "Response is very short (roughly one word or a tiny phrase, optionally with light punctuation)",
        "Does not produce a long multi-section report, checklist, or workflow as the main content",
      ],
      expect_skill: false,
      timeout: 90,
    };

    if (existing.length === 0) {
      if (!hasSmoke) {
        const out = join(evalsDir, SMOKE_NAME);
        if (!dry) writeFileSync(out, yaml.dump(smokeDoc, { lineWidth: 100, noRefs: true }));
        console.log(`${dry ? "[dry-run] " : ""}write ${out}`);
        created++;
      }
      if (!hasNeg) {
        const out = join(evalsDir, NEG_NAME);
        if (!dry) writeFileSync(out, yaml.dump(negDoc, { lineWidth: 100, noRefs: true }));
        console.log(`${dry ? "[dry-run] " : ""}write ${out}`);
        created++;
      }
    } else {
      if (!hasNeg) {
        const out = join(evalsDir, NEG_NAME);
        if (!dry) writeFileSync(out, yaml.dump(negDoc, { lineWidth: 100, noRefs: true }));
        console.log(`${dry ? "[dry-run] " : ""}write ${out}`);
        created++;
      } else if (!hasSmoke) {
        const out = join(evalsDir, SMOKE_NAME);
        if (!dry) writeFileSync(out, yaml.dump(smokeDoc, { lineWidth: 100, noRefs: true }));
        console.log(`${dry ? "[dry-run] " : ""}write ${out}`);
        created++;
      }
    }
  }

  for (const rel of discoverAllSkillRelativePaths(skillsRoot)) {
    const skillPath = join(skillsRoot, ...rel.split("/"));
    const evalsDir = join(skillPath, "evals");
    const rubricPath = join(evalsDir, RUBRIC_NAME);
    if (!existsSync(evalsDir)) {
      skippedRubric++;
      continue;
    }
    if (countEvalCaseFiles(evalsDir) >= 3 || existsSync(rubricPath)) {
      skippedRubric++;
      continue;
    }

    const skillMd = join(skillPath, "SKILL.md");
    const md = readFileSync(skillMd, "utf8");
    const fm = parseFrontmatter(md);
    const skillId = str(fm.name) || `jstack-${rel.replace(/\//g, "-")}`;

    const rubricDoc = {
      name: "Graded rubric + programmatic assert",
      prompt: [
        `You are applying the jstack skill **${skillId}** (path: \`${rel}\`).`,
        "",
        "User: In 2–4 short bullet points, say what this skill is for, who it helps, and one limitation or thing it does *not* do. Under ~200 words. Do not claim to have run external tools or APIs.",
      ].join("\n"),
      grading: {
        rubric: [
          {
            description: "Identifies a purpose, audience, or primary use of the skill",
            pass_if: "response states what the skill is for, when to use it, or which role it helps",
          },
          {
            description: "Names a boundary, limitation, prerequisite, or non-goal",
            pass_if: "response mentions a constraint, what is out of scope, or what the user must provide",
          },
        ],
        pass_threshold: 1,
      },
      assert: {
        response_not_contains: ["<script"],
        response_min_length: 15,
      },
      expect_skill: true,
      timeout: 120,
    };

    if (!dry) {
      mkdirSync(evalsDir, { recursive: true });
      writeFileSync(rubricPath, yaml.dump(rubricDoc, { lineWidth: 100, noRefs: true }));
    }
    console.log(`${dry ? "[dry-run] " : ""}write ${rubricPath}`);
    createdRubric++;
  }

  console.log(
    `\nDone. Smoke/negative: ${created} file(s) ${dry ? "would be " : ""}created, ${skipped} skill(s) already had 2+ cases.`,
  );
  console.log(
    `Rubric+assert: ${createdRubric} file(s) ${dry ? "would be " : ""}created, ${skippedRubric} skill(s) skipped (already 3+ cases or ${RUBRIC_NAME} present).`,
  );

  let createdParaphrase = 0;
  for (const rel of discoverAllSkillRelativePaths(skillsRoot)) {
    if (!canonicalRouters.has(rel)) continue;
    const skillPath = join(skillsRoot, ...rel.split("/"));
    const evalsDir = join(skillPath, "evals");
    const paraphrasePath = join(evalsDir, PARAPHRASE_NAME);
    if (!existsSync(evalsDir) || existsSync(paraphrasePath)) continue;

    const skillMd = join(skillPath, "SKILL.md");
    const md = readFileSync(skillMd, "utf8");
    const fm = parseFrontmatter(md);
    const skillId = str(fm.name) || `jstack-${rel.replace(/\//g, "-")}`;
    const whenRaw = fm.when_to_use;
    const whenToUse = typeof whenRaw === "string" ? str(whenRaw, 400) : "";

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
      criteria: [
        "Names a concrete child route, child skill folder, or one focused clarifying question",
        "Does not present fictional ticket keys, channel IDs, or verified API results",
      ],
      expect_skill: true,
      timeout: 120,
    };

    if (!dry) {
      writeFileSync(paraphrasePath, yaml.dump(paraphraseDoc, { lineWidth: 100, noRefs: true }));
    }
    console.log(`${dry ? "[dry-run] " : ""}write ${paraphrasePath}`);
    createdParaphrase++;
  }

  console.log(
    `\nParaphrase routing: ${createdParaphrase} file(s) ${dry ? "would be " : ""}created.`,
  );
}

main();

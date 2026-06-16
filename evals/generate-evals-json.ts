#!/usr/bin/env bun
/**
 * Writes evals/evals.json with one entry per discovered skill (structural inventory).
 * Run after adding/removing skills: bun run evals/generate-evals-json.ts
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverAllSkillRelativePaths } from "./discover.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const skillsRoot = join(root, "skills");
const outPath = join(root, "evals", "evals.json");

const rels = discoverAllSkillRelativePaths(skillsRoot);
const doc = {
  evals: rels.map((skill) => ({ skill })),
};

writeFileSync(outPath, JSON.stringify(doc, null, 2) + "\n");
console.log(`Wrote ${outPath} (${doc.evals.length} skills).`);

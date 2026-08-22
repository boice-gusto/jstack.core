#!/usr/bin/env bun
/**
 * Validates agents/*.md: YAML frontmatter (name, description) and every
 * `jstack:<suffix>` token against each SKILL.md `name` field (jstack-prefixed).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverAllSkillRelativePaths } from "../evals/discover.js";
import { parseYamlFrontmatter } from "./lib/parse-frontmatter.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const NAME_PREFIX = /^jstack-([a-z0-9-]+)$/;
const JSTACK_TOKEN = /\bjstack:([a-z0-9-]+)\b/g;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const skillsRoot = join(root, "skills");
const skillSuffixes = new Set<string>();
for (const rel of discoverAllSkillRelativePaths(skillsRoot)) {
  const skillPath = join(skillsRoot, rel, "SKILL.md");
  const { meta, error } = parseYamlFrontmatter(readFileSync(skillPath, "utf8"));
  const name = typeof meta.name === "string" ? meta.name : "";
  const suffixMatch = name.match(NAME_PREFIX);
  if (error || !suffixMatch) {
    fail(
      `${skillPath}: missing or invalid frontmatter line name: jstack-<suffix>` +
        (error ? ` (${error})` : ""),
    );
  }
  skillSuffixes.add(suffixMatch[1]);
}

const agentsDir = join(root, "agents");
if (!existsSync(agentsDir)) fail("Missing agents/");

const errors: string[] = [];

for (const fileName of readdirSync(agentsDir)) {
  if (!fileName.endsWith(".md")) continue;
  const agentPath = join(agentsDir, fileName);
  const full = readFileSync(agentPath, "utf8");

  const { meta, frontmatterText, error } = parseYamlFrontmatter(full);
  if (frontmatterText === undefined) {
    errors.push(`${fileName}: missing YAML frontmatter (--- ... ---)`);
    continue;
  }
  if (error) {
    errors.push(`${fileName}: invalid YAML frontmatter: ${error}`);
    continue;
  }
  if (!meta || typeof meta !== "object") {
    errors.push(`${fileName}: frontmatter must be a mapping`);
    continue;
  }
  const rec = meta;
  if (typeof rec.name !== "string" || rec.name.trim() === "") {
    errors.push(
      `${fileName}: frontmatter must include non-empty string 'name'`,
    );
  }
  if (typeof rec.description !== "string" || rec.description.trim() === "") {
    errors.push(
      `${fileName}: frontmatter must include non-empty string 'description'`,
    );
  }

  const seen = new Set<string>();
  const tokenIterable = full.matchAll(JSTACK_TOKEN);
  for (const m of tokenIterable) {
    const suffix = m[1];
    if (suffix === undefined || seen.has(suffix)) continue;
    seen.add(suffix);
    if (!skillSuffixes.has(suffix)) {
      errors.push(
        `${fileName}: unknown jstack:${suffix} (no skills/**/SKILL.md with name: jstack-${suffix})`,
      );
    }
  }
}

if (errors.length > 0) {
  console.error("agents-check failed:\n");
  for (const line of errors) {
    console.error(`  - ${line}`);
  }
  process.exit(1);
}

console.log(
  `agents-check OK (${skillSuffixes.size} skill suffixes, agents/*.md validated).`,
);

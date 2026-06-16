#!/usr/bin/env bun
/**
 * Validates agents/*.md: YAML frontmatter (name, description) and every
 * `jstack:<suffix>` token against each SKILL.md `name` field (jstack-prefixed).
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const NAME_LINE = /^name:\s*["']?jstack-([a-z0-9-]+)["']?\s*$/im;
const JSTACK_TOKEN = /\bjstack:([a-z0-9-]+)\b/g;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function collectSkillMdPaths(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  const here = join(dir, "SKILL.md");
  if (existsSync(here)) {
    out.push(here);
  }
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (!statSync(p).isDirectory()) continue;
    out.push(...collectSkillMdPaths(p));
  }
  return out;
}

const skillSuffixes = new Set<string>();
for (const skillPath of collectSkillMdPaths(join(root, "skills"))) {
  const raw = readFileSync(skillPath, "utf8");
  const nameMatch = raw.match(NAME_LINE);
  if (!nameMatch?.[1]) {
    fail(`${skillPath}: missing or invalid frontmatter line name: jstack-<suffix>`);
  }
  skillSuffixes.add(nameMatch[1]);
}

const agentsDir = join(root, "agents");
if (!existsSync(agentsDir)) fail("Missing agents/");

const errors: string[] = [];

for (const fileName of readdirSync(agentsDir)) {
  if (!fileName.endsWith(".md")) continue;
  const agentPath = join(agentsDir, fileName);
  const full = readFileSync(agentPath, "utf8");

  const fmMatch = full.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) {
    errors.push(`${fileName}: missing YAML frontmatter (--- ... ---)`);
    continue;
  }
  let parsed: unknown;
  try {
    parsed = yaml.load(fmMatch[1]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`${fileName}: invalid YAML frontmatter: ${msg}`);
    continue;
  }
  if (!parsed || typeof parsed !== "object") {
    errors.push(`${fileName}: frontmatter must be a mapping`);
    continue;
  }
  const rec = parsed as Record<string, unknown>;
  if (typeof rec.name !== "string" || rec.name.trim() === "") {
    errors.push(`${fileName}: frontmatter must include non-empty string 'name'`);
  }
  if (typeof rec.description !== "string" || rec.description.trim() === "") {
    errors.push(`${fileName}: frontmatter must include non-empty string 'description'`);
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

console.log(`agents-check OK (${skillSuffixes.size} skill suffixes, agents/*.md validated).`);

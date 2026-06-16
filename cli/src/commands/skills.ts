import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import chalk from "chalk";
import * as p from "@clack/prompts";
import { findPluginRoot } from "../lib/config.js";
import { exitCancelled, handleCancel, isInteractive, nonInteractiveHint } from "../lib/cliUi.js";

export type SkillIndexEntry = {
  path: string;
  rel: string;
  name: string;
  description: string;
};

function walkSkillMd(dir: string, base: string, out: { path: string; rel: string }[]): void {
  if (!existsSync(dir)) return;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith(".")) continue;
    const p = join(dir, ent.name);
    if (ent.isDirectory()) walkSkillMd(p, base, out);
    else if (ent.name === "SKILL.md") out.push({ path: p, rel: relative(base, p) });
  }
}

function parseFrontmatter(raw: string): { name: string; description: string } {
  let name = "";
  let description = "";
  if (!raw.startsWith("---")) return { name, description };
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return { name, description };
  const block = raw.slice(3, end);
  let inDesc = false;
  const descLines: string[] = [];
  for (const line of block.split("\n")) {
    if (inDesc) {
      if (/^\S/.test(line) && !line.startsWith(" ")) {
        inDesc = false;
      } else {
        descLines.push(line.replace(/^\s+/, ""));
        continue;
      }
    }
    const m = line.match(/^name:\s*(.*)$/);
    if (m) {
      name = m[1].trim().replace(/^["']|["']$/g, "");
      continue;
    }
    const d = line.match(/^description:\s*(.*)$/);
    if (d) {
      const rest = d[1].trim();
      if (rest === "|" || rest === ">-") {
        inDesc = true;
      } else {
        description = rest.replace(/^["']|["']$/g, "");
      }
    }
  }
  if (descLines.length) description = descLines.join(" ").trim();
  return { name, description };
}

/** Collect SKILL.md entries under plugin `skills/` (and optional overlay). Exported for browse/pick and tests. */
export function collectSkills(pluginRoot: string, extraRoot?: string): SkillIndexEntry[] {
  const skillsDir = join(pluginRoot, "skills");
  const found: { path: string; rel: string }[] = [];
  walkSkillMd(skillsDir, pluginRoot, found);
  const entries: SkillIndexEntry[] = [];
  for (const f of found) {
    const raw = readFileSync(f.path, "utf8");
    const fm = parseFrontmatter(raw);
    entries.push({
      path: f.path,
      rel: f.rel,
      name: fm.name || f.rel,
      description: fm.description,
    });
  }
  if (extraRoot && existsSync(extraRoot)) {
    const extraSkills = join(extraRoot, "skills");
    const found2: { path: string; rel: string }[] = [];
    walkSkillMd(extraSkills, extraRoot, found2);
    for (const f of found2) {
      const raw = readFileSync(f.path, "utf8");
      const fm = parseFrontmatter(raw);
      entries.push({
        path: f.path,
        rel: `[overlay] ${f.rel}`,
        name: fm.name || f.rel,
        description: fm.description,
      });
    }
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  return entries;
}

export function runSkillsIndex(opts: { json?: boolean; overlay?: string }): void {
  const pluginRoot = findPluginRoot();
  const overlay = opts.overlay?.trim() || process.env.JSTACK_GUSTO_ROOT?.trim();
  const entries = collectSkills(pluginRoot, overlay && overlay.length > 0 ? overlay : undefined);
  if (opts.json) {
    console.log(JSON.stringify({ skills: entries }, null, 2));
    return;
  }
  for (const e of entries) {
    console.log(`${e.name}\t${e.rel}`);
  }
}

/** Interactive picker over all skills; `--json` matches `skills index`. */
export async function runSkillsBrowse(opts: { json?: boolean; overlay?: string }): Promise<void> {
  const pluginRoot = findPluginRoot();
  const overlay = opts.overlay?.trim() || process.env.JSTACK_GUSTO_ROOT?.trim();
  const entries = collectSkills(pluginRoot, overlay && overlay.length > 0 ? overlay : undefined);

  if (opts.json) {
    console.log(JSON.stringify({ skills: entries }, null, 2));
    return;
  }

  if (!isInteractive()) {
    console.error(chalk.yellow(nonInteractiveHint()));
    process.exitCode = 1;
    return;
  }

  if (entries.length === 0) {
    console.log(chalk.dim("No SKILL.md files found."));
    return;
  }

  const picked = await p.select<string>({
    message: "Select a skill",
    options: entries.map((e) => ({
      value: e.rel,
      label: e.name.length > 0 ? e.name : e.rel,
      hint:
        e.description.length > 72 ? `${e.description.slice(0, 72)}…` : e.description || undefined,
    })),
  });

  if (handleCancel(picked)) exitCancelled();

  const hit = entries.find((e) => e.rel === picked);
  if (!hit) {
    console.error(chalk.red("Selection mismatch."));
    process.exitCode = 1;
    return;
  }

  console.log(chalk.bold(hit.path));
  console.log(chalk.dim(`SKILL.md: ${hit.rel}`));
  console.log("");
  console.log(chalk.dim("Tip: open the path in your editor or run:"));
  console.log(chalk.dim(`  jstack skills show ${hit.name || hit.rel.split("/")[0] || hit.rel}`));
}

/** Filter by substring then pick; `--json` matches `skills index`. */
export async function runSkillsPick(opts: { json?: boolean; overlay?: string }): Promise<void> {
  const pluginRoot = findPluginRoot();
  const overlay = opts.overlay?.trim() || process.env.JSTACK_GUSTO_ROOT?.trim();
  const entries = collectSkills(pluginRoot, overlay && overlay.length > 0 ? overlay : undefined);

  if (opts.json) {
    console.log(JSON.stringify({ skills: entries }, null, 2));
    return;
  }

  if (!isInteractive()) {
    console.error(chalk.yellow(nonInteractiveHint()));
    process.exitCode = 1;
    return;
  }

  if (entries.length === 0) {
    console.log(chalk.dim("No SKILL.md files found."));
    return;
  }

  const filterRaw = await p.text({
    message: "Filter skills (name, path, or description; empty = show all)",
    placeholder: "e.g. doctor",
  });

  if (handleCancel(filterRaw)) exitCancelled();

  const needle = String(filterRaw).trim().toLowerCase();
  const filtered =
    needle.length === 0
      ? entries
      : entries.filter(
          (e) =>
            e.name.toLowerCase().includes(needle) ||
            e.rel.toLowerCase().includes(needle) ||
            e.description.toLowerCase().includes(needle),
        );

  if (filtered.length === 0) {
    console.log(chalk.yellow("No skills matched."));
    return;
  }

  const picked = await p.select<string>({
    message: "Pick a skill",
    options: filtered.map((e) => ({
      value: e.rel,
      label: e.name.length > 0 ? e.name : e.rel,
      hint: e.rel,
    })),
  });

  if (handleCancel(picked)) exitCancelled();

  const hit = filtered.find((e) => e.rel === picked);
  if (!hit) {
    console.error(chalk.red("Selection mismatch."));
    process.exitCode = 1;
    return;
  }

  console.log(chalk.bold(hit.path));
  console.log(chalk.dim(`SKILL.md: ${hit.rel}`));
}

export function runSkillsShow(id: string, opts: { json?: boolean; overlay?: string }): void {
  const pluginRoot = findPluginRoot();
  const overlay = opts.overlay?.trim() || process.env.JSTACK_GUSTO_ROOT?.trim();
  const entries = collectSkills(pluginRoot, overlay && overlay.length > 0 ? overlay : undefined);
  const needle = id.trim().toLowerCase().replace(/^jstack:/, "");
  const hit = entries.find(
    (e) =>
      e.name.toLowerCase() === needle ||
      e.name.toLowerCase() === `jstack:${needle}` ||
      e.rel.toLowerCase().includes(needle),
  );
  if (!hit) {
    console.error(`Unknown skill: ${id}`);
    process.exitCode = 1;
    return;
  }
  if (opts.json) {
    console.log(JSON.stringify(hit, null, 2));
    return;
  }
  console.log(hit.path);
  console.log(hit.description);
}

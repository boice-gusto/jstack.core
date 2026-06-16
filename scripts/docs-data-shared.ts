// Shared helpers for docs:generate and docs:build (skill catalog from SKILL.md files).
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

export type SkillRecord = {
  id: string;
  name: string;
  path: string;
  relPath: string;
  /** Skill path slug for evals: `jstack:<slug>` (matches evals/eval-config `skillGateId`). */
  gateId: string;
  description: string;
  whenToUse: string;
  category: string;
  categoryKey: string;
};

/** Repo-relative path like `skills/foo/bar/SKILL.md` -> gate slug `foo/bar`. */
export function skillRelPathToGateSlug(repoRelPath: string): string {
  return repoRelPath
    .replace(/^skills\//, "")
    .replace(/\/SKILL\.md$/i, "")
    .split("/")
    .filter(Boolean)
    .join("/");
}

export function skillGateIdFromRelPath(repoRelPath: string): string {
  const slug = skillRelPathToGateSlug(repoRelPath);
  return `jstack:${slug}`;
}

const FRONTMATTER_KEY_LINE = /^(name|description|when_to_use|category):\s*(.*)$/;

export function parseFrontmatter(raw: string): { meta: Record<string, string>; rest: string } {
  if (!raw.startsWith("---")) {
    return { meta: {}, rest: raw };
  }
  const endMarker = raw.indexOf("\n---", 3);
  if (endMarker === -1) {
    return { meta: {}, rest: raw };
  }
  const block = raw.slice(3, endMarker).replace(/^\r?\n?/, "");
  const rest = raw.slice(endMarker + 4).replace(/^\r?\n?/, "");
  const lines = block.split(/\r?\n/);
  const meta: Record<string, string> = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line === undefined) {
      i++;
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const m = line.match(FRONTMATTER_KEY_LINE);
    if (!m) {
      i++;
      continue;
    }
    const k = m[1];
    let v = (m[2] ?? "").trimEnd();
    const t = v.trim();
    if (t === ">-" || t === ">" || t === "|" || t === "|-" || (k === "description" && t === "")) {
      const parts: string[] = [];
      if (t !== ">-" && t !== ">" && t !== "|" && t !== "|-" && v.length > 0) {
        parts.push(v);
      }
      i++;
      while (i < lines.length) {
        const L = lines[i];
        if (L === undefined) break;
        if (FRONTMATTER_KEY_LINE.test(L)) break;
        const trimmed = L.replace(/^\s+/, "").trimEnd();
        if (trimmed.length > 0) {
          parts.push(trimmed);
        }
        i++;
      }
      if (k !== undefined) {
        meta[k] = parts.join(" ").replace(/\s+/g, " ").trim();
      }
      continue;
    }
    if (k !== undefined) {
      meta[k] = v.trim();
    }
    i++;
  }
  return { meta, rest };
}

export async function walkSkillMds(dir: string, out: string[] = []): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      await walkSkillMds(p, out);
    } else if (e.name === "SKILL.md") {
      out.push(p);
    }
  }
  return out;
}

export async function walkAllMarkdownUnderSkills(dir: string, out: string[] = []): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      await walkAllMarkdownUnderSkills(p, out);
    } else if (e.name.toLowerCase().endsWith(".md")) {
      out.push(p);
    }
  }
  return out;
}

export function formatCategoryLabel(key: string): string {
  if (key.length === 0) return "General";
  return key
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export async function buildSkillRecords(repoRoot: string, skillsRoot: string): Promise<SkillRecord[]> {
  const absPaths = await walkSkillMds(skillsRoot);
  const records: SkillRecord[] = [];

  for (const abs of absPaths.sort()) {
    const raw = await readFile(abs, "utf8");
    const { meta } = parseFrontmatter(raw);
    const rel = relative(repoRoot, abs).split("\\").join("/");
    const name = meta.name ?? rel.replace(/^skills\//, "").replace(/\/SKILL\.md$/, "");
    const description = meta.description ?? "";
    const whenToUse = meta.when_to_use ?? "";
    const categoryField = meta.category?.trim();
    const pathParts = rel.replace(/^skills\//, "").split("/");
    const categoryKey = categoryField && categoryField.length > 0 ? categoryField : pathParts[0] ?? "general";
    const uniqueId = rel
      .toLowerCase()
      .replace(/^skills\//, "")
      .replace(/\/skill\.md$/i, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    records.push({
      id: uniqueId.length > 0 ? uniqueId : "skill",
      name,
      path: rel,
      relPath: rel,
      gateId: skillGateIdFromRelPath(rel),
      description,
      whenToUse,
      category: formatCategoryLabel(categoryKey),
      categoryKey: categoryKey.toLowerCase(),
    });
  }

  return records.sort((a, b) => a.name.localeCompare(b.name));
}

export function buildSkillsPayload(skills: SkillRecord[]): {
  generatedAt: string;
  count: number;
  skills: SkillRecord[];
} {
  return {
    generatedAt: new Date().toISOString(),
    count: skills.length,
    skills,
  };
}

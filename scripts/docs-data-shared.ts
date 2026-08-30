// Shared helpers for docs:generate and docs:build (skill catalog from SKILL.md files).
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

export type SkillRecord = {
  id: string;
  name: string;
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

const FRONTMATTER_KEY_LINE =
  /^(name|description|when_to_use|category):\s*(.*)$/;

export function parseFrontmatter(raw: string): {
  meta: Record<string, string>;
  rest: string;
} {
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
    if (
      t === ">-" ||
      t === ">" ||
      t === "|" ||
      t === "|-" ||
      (k === "description" && t === "")
    ) {
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

export async function walkSkillMds(
  dir: string,
  out: string[] = [],
): Promise<string[]> {
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

export async function walkAllMarkdownUnderSkills(
  dir: string,
  out: string[] = [],
): Promise<string[]> {
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

export async function buildSkillRecords(
  repoRoot: string,
  skillsRoot: string,
  /**
   * Defaults to a fresh `readFile` per skill. A caller that's already read every SKILL.md into
   * memory for another purpose (e.g. `build-landing-page.ts`'s `mdByRelPath`) can pass a lookup
   * into that cache instead, so the same file isn't read from disk twice in one run.
   */
  readContent: (absPath: string) => Promise<string> = (p) =>
    readFile(p, "utf8"),
  /**
   * Defaults to a fresh `walkSkillMds`. A caller that already walked the whole skills/ tree for
   * another purpose (e.g. `build-landing-page.ts`'s `walkAllMarkdownUnderSkills`, which visits
   * every .md file, SKILL.md included) can pass that already-collected list filtered down to
   * SKILL.md paths instead, so the tree isn't walked twice in one run.
   */
  skillMdAbsPaths?: string[],
): Promise<SkillRecord[]> {
  const absPaths = skillMdAbsPaths ?? (await walkSkillMds(skillsRoot));
  const records: SkillRecord[] = [];

  for (const abs of absPaths.sort()) {
    const raw = await readContent(abs);
    const { meta } = parseFrontmatter(raw);
    const rel = relative(repoRoot, abs).split("\\").join("/");
    const name =
      meta.name ?? rel.replace(/^skills\//, "").replace(/\/SKILL\.md$/, "");
    const description = meta.description ?? "";
    const whenToUse = meta.when_to_use ?? "";
    const categoryField = meta.category?.trim();
    const pathParts = rel.replace(/^skills\//, "").split("/");
    const categoryKey =
      categoryField && categoryField.length > 0
        ? categoryField
        : (pathParts[0] ?? "general");
    const uniqueId = rel
      .toLowerCase()
      .replace(/^skills\//, "")
      .replace(/\/skill\.md$/i, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    records.push({
      id: uniqueId.length > 0 ? uniqueId : "skill",
      name,
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

/**
 * One `<script type="application/json">` payload plus the bootstrap-IIFE binding that reads it
 * back onto a `window.*` global at page load.
 */
export interface InlineJsonBinding {
  scriptId: string;
  /** e.g. "__JSTACK_SKILLS__" (assigned as `window.<globalName>`). */
  globalName: string;
  /** JS variable name inside the generated bootstrap closure. */
  varName: string;
  json: string;
}

/**
 * Builds the `<script type="application/json" id="...">...</script>` tags plus the single
 * bootstrap `<script>` that reads them back onto `window.*`, indented to match `index.html`'s
 * existing body indentation. `generate-docs-data.ts` and `build-landing-page.ts` each hand-rolled
 * this (one binding vs. three) with their own copy of `parseJsonScript` and their own marker
 * splice logic -- this is the data-driven replacement for both.
 */
export function buildInlineJsonMarkerBlock(
  bindings: InlineJsonBinding[],
): string {
  const scriptTags = bindings.map(
    (b) =>
      `    <script type="application/json" id="${b.scriptId}">${b.json}</script>`,
  );
  const bootstrapLines = [
    "(function () {",
    "  function parseJsonScript(id) {",
    "    var el = document.getElementById(id);",
    "    if (!el) return null;",
    "    try {",
    '      return JSON.parse(el.textContent || "null");',
    "    } catch (e) {",
    "      return null;",
    "    }",
    "  }",
    ...bindings.flatMap((b) => [
      `  var ${b.varName} = parseJsonScript("${b.scriptId}");`,
      `  if (${b.varName}) window.${b.globalName} = ${b.varName};`,
    ]),
    "})();",
  ];
  const indentedBootstrap = bootstrapLines
    .join("\n")
    .split("\n")
    .join("\n      ");
  return [
    ...scriptTags,
    "    <script>",
    `      ${indentedBootstrap}`,
    "    </script>",
  ].join("\n");
}

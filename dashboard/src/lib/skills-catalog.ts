import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

import { z } from "zod";

import { getJstackCoreRoot, getSkillCatalogPath } from "@/server/env";

const SkillEntrySchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  path: z.string(),
  relPath: z.string().optional(),
  gateId: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
});

const CatalogSchema = z.object({
  skills: z.array(SkillEntrySchema),
});

export type SkillCatalogEntry = z.infer<typeof SkillEntrySchema> & {
  schemaPaths: string[];
};

function listSchemaPaths(skillMdPath: string): string[] {
  const skillDir = dirname(skillMdPath);
  const schemasDir = join(skillDir, "references", "schemas");
  if (!existsSync(schemasDir)) return [];
  try {
    const names = readdirSync(schemasDir);
    return names
      .filter((n) => n.endsWith(".json"))
      .map((n) => join(schemasDir, n))
      .sort();
  } catch {
    return [];
  }
}

export function loadSkillCatalog(): SkillCatalogEntry[] {
  const root = getJstackCoreRoot();
  const catalogPath = getSkillCatalogPath();
  const raw = readFileSync(catalogPath, "utf8");
  const parsed = CatalogSchema.safeParse(JSON.parse(raw) as unknown);
  if (!parsed.success) {
    throw new Error(`Invalid skill-catalog.json: ${parsed.error.message}`);
  }
  return parsed.data.skills.map((s) => {
    const abs = join(root, s.path);
    return {
      ...s,
      schemaPaths: listSchemaPaths(abs),
    };
  });
}

export function loadSkillMarkdownById(skillId: string): { content: string; absPath: string } | null {
  const catalog = loadSkillCatalog();
  const entry = catalog.find((s) => s.id === skillId);
  if (entry === undefined) return null;
  const root = getJstackCoreRoot();
  const abs = join(root, entry.path);
  if (!existsSync(abs)) return null;
  const content = readFileSync(abs, "utf8");
  return { content, absPath: abs };
}

export function getSkillEntry(skillId: string): SkillCatalogEntry | null {
  const catalog = loadSkillCatalog();
  return catalog.find((s) => s.id === skillId) ?? null;
}

const MAX_SKILL_DOC_BYTES = 200_000;
const MAX_SKILL_DOCS_TOTAL_BYTES = 900_000;
const MAX_SKILL_DOC_FILES = 40;

export type SkillDocumentChunk = {
  relPath: string;
  title: string;
  markdown: string;
};

function isPathInsideRoot(rootReal: string, fileReal: string): boolean {
  const prefix = rootReal.endsWith(sep) ? rootReal : `${rootReal}${sep}`;
  return fileReal === rootReal || fileReal.startsWith(prefix);
}

function* walkMarkdownFiles(dir: string): Generator<string> {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (name.startsWith(".")) {
      continue;
    }
    const full = join(dir, name);
    let st: ReturnType<typeof statSync> | undefined;
    try {
      st = statSync(full, { throwIfNoEntry: false });
    } catch {
      continue;
    }
    if (st === undefined) {
      continue;
    }
    if (st.isDirectory()) {
      yield* walkMarkdownFiles(full);
    } else if (st.isFile() && name.endsWith(".md")) {
      yield full;
    }
  }
}

/**
 * Loads SKILL.md (or catalog path) plus markdown under references/ for UI preview.
 * Paths are constrained under the skill directory after realpath.
 */
export function loadSkillDocumentsById(skillId: string): SkillDocumentChunk[] | null {
  const loaded = loadSkillMarkdownById(skillId);
  if (loaded === null) {
    return null;
  }
  let skillRootReal: string;
  let mainFileReal: string;
  try {
    skillRootReal = realpathSync(dirname(loaded.absPath));
    mainFileReal = realpathSync(loaded.absPath);
  } catch {
    return null;
  }
  if (!isPathInsideRoot(skillRootReal, mainFileReal)) {
    return null;
  }

  const chunks: SkillDocumentChunk[] = [];
  let totalBytes = 0;

  const pushFile = (absPath: string, title: string): void => {
    if (chunks.length >= MAX_SKILL_DOC_FILES) {
      return;
    }
    let st: ReturnType<typeof statSync>;
    try {
      st = statSync(absPath);
    } catch {
      return;
    }
    if (!st.isFile() || st.size > MAX_SKILL_DOC_BYTES) {
      return;
    }
    let fileReal: string;
    try {
      fileReal = realpathSync(absPath);
    } catch {
      return;
    }
    if (!isPathInsideRoot(skillRootReal, fileReal)) {
      return;
    }
    const markdown = readFileSync(absPath, "utf8");
    if (totalBytes + markdown.length > MAX_SKILL_DOCS_TOTAL_BYTES) {
      return;
    }
    totalBytes += markdown.length;
    const relPath = relative(skillRootReal, fileReal).split(sep).join("/");
    chunks.push({ relPath, title, markdown });
  };

  pushFile(loaded.absPath, "SKILL.md");

  const refDir = join(skillRootReal, "references");
  if (existsSync(refDir)) {
    const sorted = [...walkMarkdownFiles(refDir)].sort();
    for (const abs of sorted) {
      let fileReal: string;
      try {
        fileReal = realpathSync(abs);
      } catch {
        continue;
      }
      if (resolve(fileReal) === resolve(mainFileReal)) {
        continue;
      }
      const rel = relative(skillRootReal, fileReal).split(sep).join("/");
      pushFile(abs, rel);
    }
  }

  return chunks.length > 0 ? chunks : null;
}

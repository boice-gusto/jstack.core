import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  isPageTemplate,
  type NotionTemplate,
  type NotionTemplateCatalog,
  NotionTemplateCatalogSchema,
  type NotionTemplateSet,
  NotionTemplateSetSchema,
} from "./types.js";

const CATALOG_FILENAME_RE = /\.json$/;

export type LoadCatalogOptions = {
  catalogDir: string;
  activeSet?: string;
};

export type LoadedTemplate = NotionTemplate & {
  set_id: string;
  resolved_content?: string;
};

export class CatalogLoadError extends Error {
  readonly file: string;
  readonly cause?: unknown;
  constructor(message: string, file: string, cause?: unknown) {
    super(`${message} (${file})`);
    this.file = file;
    this.cause = cause;
    this.name = "CatalogLoadError";
  }
}

function listCatalogFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((n) => CATALOG_FILENAME_RE.test(n))
    .map((n) => join(dir, n))
    .filter((p) => statSync(p).isFile());
}

function loadSet(file: string): NotionTemplateSet {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    throw new CatalogLoadError("invalid JSON", file, err);
  }
  const parsed = NotionTemplateSetSchema.safeParse(raw);
  if (!parsed.success) {
    throw new CatalogLoadError(`schema validation failed: ${parsed.error.message}`, file);
  }
  return parsed.data;
}

export function loadCatalog(opts: LoadCatalogOptions): NotionTemplateCatalog {
  const dir = resolve(opts.catalogDir);
  const files = listCatalogFiles(dir);
  const sets: Record<string, NotionTemplateSet> = {};
  for (const file of files) {
    const set = loadSet(file);
    if (sets[set.id]) {
      throw new CatalogLoadError(`duplicate set id "${set.id}"`, file);
    }
    sets[set.id] = set;
  }
  const ids = Object.keys(sets);
  if (ids.length === 0) {
    throw new CatalogLoadError("no catalog sets found", dir);
  }
  const activeSet = opts.activeSet ?? (ids.includes("official") ? "official" : ids[0]);
  if (!sets[activeSet]) {
    throw new CatalogLoadError(`active_set "${activeSet}" not present in catalog`, dir);
  }
  const catalog: NotionTemplateCatalog = { active_set: activeSet, sets };
  const validated = NotionTemplateCatalogSchema.safeParse(catalog);
  if (!validated.success) {
    throw new CatalogLoadError(`catalog assembly failed: ${validated.error.message}`, dir);
  }
  return validated.data;
}

export function resolveTemplateContent(
  catalogDir: string,
  template: NotionTemplate,
): string | undefined {
  if (!isPageTemplate(template)) return undefined;
  const path = join(resolve(catalogDir), template.content_path);
  try {
    return readFileSync(path, "utf8");
  } catch (err) {
    throw new CatalogLoadError(
      `content_path missing for template "${template.id}"`,
      path,
      err,
    );
  }
}

export function templatesForSurface(
  set: NotionTemplateSet,
  surface: NotionTemplate["surface"],
): NotionTemplate[] {
  return set.templates.filter((t) => t.surface === surface);
}

export function findTemplate(
  catalog: NotionTemplateCatalog,
  setId: string,
  templateId: string,
): NotionTemplate | undefined {
  return catalog.sets[setId]?.templates.find((t) => t.id === templateId);
}

export function activeSet(catalog: NotionTemplateCatalog): NotionTemplateSet {
  const set = catalog.sets[catalog.active_set];
  if (!set) {
    throw new CatalogLoadError(
      `active_set "${catalog.active_set}" missing`,
      "(in-memory catalog)",
    );
  }
  return set;
}

export type { NotionTemplate, NotionTemplateCatalog, NotionTemplateSet } from "./types.js";
export {
  isPageTemplate,
  isDatabaseTemplate,
  NotionTemplateSchema,
  NotionTemplateSetSchema,
  NotionTemplateCatalogSchema,
} from "./types.js";

// Convenience: default catalog dir relative to the plugin root.
export function defaultCatalogDir(pluginRoot: string): string {
  return join(pluginRoot, "templates", "notion", "catalog");
}

// Re-export so consumers don't need to import node:path.
export { dirname, join, resolve };

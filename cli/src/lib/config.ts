import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  CONFIG_DIR,
  DEFAULTS_FILE,
  ENCODING_UTF8,
  ENV,
  JSTACK_CONFIG_FILE,
  JSTACK_CORE_PKG_DIR,
  JSTACK_GUSTO_PKG_DIR,
  SKILLS_DIR,
  WALK_LIMITS,
} from "@jstack/constants/paths";
import { JstackConfigSchema, type JstackConfig } from "../types/config.js";

export function findProjectRoot(cwd = process.cwd()): string {
  let dir = cwd;
  for (let i = 0; i < WALK_LIMITS.PROJECT_ROOT_MAX_STEPS; i++) {
    if (existsSync(join(dir, JSTACK_CONFIG_FILE))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return cwd;
}

export function configPath(root: string): string {
  return join(root, JSTACK_CONFIG_FILE);
}

export function defaultsPath(pluginRoot: string): string {
  return join(pluginRoot, CONFIG_DIR, DEFAULTS_FILE);
}

function isRecordJson(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

const _defaultsCache = new Map<string, Record<string, unknown>>();

export function loadDefaults(pluginRoot: string): Record<string, unknown> {
  const cached = _defaultsCache.get(pluginRoot);
  if (cached) return cached;
  const p = defaultsPath(pluginRoot);
  if (!existsSync(p)) return {};
  const raw: unknown = JSON.parse(readFileSync(p, ENCODING_UTF8));
  const result = isRecordJson(raw) ? raw : {};
  _defaultsCache.set(pluginRoot, result);
  return result;
}

export function readConfig(root: string): JstackConfig {
  const p = configPath(root);
  if (!existsSync(p)) {
    throw new Error(`Missing ${p}. Run: jstack setup`);
  }
  const raw: unknown = JSON.parse(readFileSync(p, ENCODING_UTF8));
  return JstackConfigSchema.parse(raw);
}

export function readConfigOptional(root: string): JstackConfig | null {
  try {
    return readConfig(root);
  } catch {
    return null;
  }
}

export function writeConfig(root: string, cfg: JstackConfig): void {
  const p = configPath(root);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(cfg, null, 2) + "\n", ENCODING_UTF8);
}

/**
 * Sentinel value used to mark a field as "explicitly skipped" in a partial
 * config / wizard output. When `mergeDeep` encounters this value it deletes
 * the corresponding key in the merged output, distinguishing "skip" from
 * empty string or undefined.
 */
export const SKIP_SENTINEL: unique symbol = Symbol.for("jstack:skip");
export type SkipSentinel = typeof SKIP_SENTINEL;
export function isSkipSentinel(v: unknown): v is SkipSentinel {
  return v === SKIP_SENTINEL;
}

export function mergeDeep<T extends Record<string, unknown>>(base: T, over: Partial<T>): T {
  const out = { ...base };
  for (const k of Object.keys(over)) {
    const v = over[k as keyof T];
    if (v === undefined) continue;
    if (isSkipSentinel(v)) {
      delete (out as Record<string, unknown>)[k];
      continue;
    }
    const b = base[k as keyof T];
    if (
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      b &&
      typeof b === "object" &&
      !Array.isArray(b)
    ) {
      (out as Record<string, unknown>)[k] = mergeDeep(
        b as Record<string, unknown>,
        v as Record<string, unknown>,
      );
    } else {
      (out as Record<string, unknown>)[k] = v as unknown;
    }
  }
  return out;
}

/**
 * Recursively remove `SKIP_SENTINEL` values from a value tree. Returns a
 * deep copy; the input is not mutated.
 *
 * - Top-level sentinel returns `undefined` (caller must handle).
 * - In arrays, sentinel elements are filtered out.
 * - In plain objects, keys whose pruned child is `undefined` are removed.
 * - Empty objects are preserved (no auto-collapse).
 */
export function pruneSkipped<T>(value: T): T {
  if (isSkipSentinel(value)) {
    return undefined as unknown as T;
  }
  if (Array.isArray(value)) {
    const result: unknown[] = [];
    for (const item of value) {
      if (isSkipSentinel(item)) continue;
      const pruned = pruneSkipped(item);
      if (pruned === undefined && item !== undefined) continue;
      result.push(pruned);
    }
    return result as unknown as T;
  }
  if (value && typeof value === "object") {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(src)) {
      const child = src[k];
      if (isSkipSentinel(child)) continue;
      const pruned = pruneSkipped(child);
      if (pruned === undefined && child !== undefined) continue;
      out[k] = pruned;
    }
    return out as unknown as T;
  }
  return value;
}

/** Resolve plugin root: env CLAUDE_PLUGIN_ROOT or walk up for config/defaults.json */
export function findPluginRoot(cwd = process.cwd()): string {
  const envRoot = process.env[ENV.CLAUDE_PLUGIN_ROOT];
  if (envRoot && existsSync(envRoot)) {
    return resolve(envRoot);
  }
  let dir = cwd;
  for (let i = 0; i < WALK_LIMITS.PLUGIN_ROOT_MAX_STEPS; i++) {
    if (existsSync(join(dir, CONFIG_DIR, DEFAULTS_FILE)) && existsSync(join(dir, SKILLS_DIR))) {
      return dir;
    }
    // Monorepo layout: prefer org overlay (e.g. jstack.gusto) over jstack.core when both exist
    const nestedGusto = join(dir, JSTACK_GUSTO_PKG_DIR);
    if (
      existsSync(join(nestedGusto, CONFIG_DIR, DEFAULTS_FILE)) &&
      existsSync(join(nestedGusto, SKILLS_DIR))
    ) {
      return resolve(nestedGusto);
    }
    const nested = join(dir, JSTACK_CORE_PKG_DIR);
    if (existsSync(join(nested, CONFIG_DIR, DEFAULTS_FILE)) && existsSync(join(nested, SKILLS_DIR))) {
      return resolve(nested);
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return cwd;
}

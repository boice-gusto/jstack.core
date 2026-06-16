/**
 * Cross-skill scenario packs: same stress prompts applied to many skills (Claude CLI execute + judge).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import type { EvalCase, EvalFileSpec } from "./eval-config.js";
import { parseAssert } from "./discover.js";

export interface ScenarioPackFile {
  id: string;
  name?: string;
  description?: string;
  /** Default pass threshold for scenario runs (criteria + asserts). */
  default_threshold?: number;
  /** Default timeout per scenario when not set on scenario. */
  default_timeout?: number;
  /** If true, scenarios inherit strict_grader unless overridden. */
  strict_grader_default?: boolean;
  /** Skills to run when `--all-skills` is not passed and `--skill` is not passed. */
  default_targets: string[];
  scenarios: ScenarioDefinition[];
}

export interface ScenarioDefinition {
  id: string;
  name: string;
  prompt: string;
  criteria: string[];
  files?: { path: string; content?: string }[];
  assert?: unknown;
  expect_skill?: boolean;
  timeout?: number;
  strict_grader?: boolean;
  /**
   * When set, this scenario is only expanded for these skill rel paths (e.g. router matrix: one scenario per router).
   * When omitted or empty, the scenario runs for every target skill (legacy pack behavior).
   */
  targets?: string[];
}

function safeLoad(path: string): ScenarioPackFile {
  const raw = yaml.load(readFileSync(path, "utf8"));
  if (typeof raw !== "object" || raw === null) throw new Error(`${path}: pack must be a mapping`);
  const o = raw as Record<string, unknown>;
  const id = String(o.id ?? "");
  if (!id) throw new Error(`${path}: pack must have id`);
  const default_targets = o.default_targets;
  if (!Array.isArray(default_targets) || default_targets.length === 0) {
    throw new Error(`${path}: default_targets must be a non-empty array`);
  }
  const scenarios = o.scenarios;
  if (!Array.isArray(scenarios) || scenarios.length === 0) {
    throw new Error(`${path}: scenarios must be a non-empty array`);
  }
  const parsed: ScenarioDefinition[] = [];
  for (const s of scenarios) {
    if (typeof s !== "object" || s === null) throw new Error(`${path}: invalid scenario`);
    const sc = s as Record<string, unknown>;
    const sid = String(sc.id ?? "");
    const name = String(sc.name ?? sid);
    const prompt = String(sc.prompt ?? "");
    const criteria = sc.criteria;
    if (!sid || !prompt.trim()) throw new Error(`${path}: scenario ${name} needs id and prompt`);
    if (!Array.isArray(criteria) || criteria.length === 0) {
      throw new Error(`${path}: scenario ${sid} needs criteria`);
    }
    const filesRaw = sc.files;
    const files: ScenarioDefinition["files"] = [];
    if (Array.isArray(filesRaw)) {
      for (const f of filesRaw) {
        if (f && typeof f === "object" && "path" in f) {
          const fr = f as Record<string, unknown>;
          files.push({ path: String(fr.path), content: fr.content != null ? String(fr.content) : "" });
        }
      }
    }
    const targetsRaw = sc.targets;
    const targets: string[] | undefined =
      Array.isArray(targetsRaw) && targetsRaw.length > 0 ? targetsRaw.map(String) : undefined;

    parsed.push({
      id: sid,
      name,
      prompt,
      criteria: criteria.map(String),
      files: files.length ? files : undefined,
      assert: sc.assert,
      expect_skill: sc.expect_skill !== false,
      timeout: typeof sc.timeout === "number" ? sc.timeout : undefined,
      strict_grader: sc.strict_grader === true ? true : sc.strict_grader === false ? false : undefined,
      targets,
    });
  }
  return {
    id,
    name: o.name != null ? String(o.name) : undefined,
    description: o.description != null ? String(o.description) : undefined,
    default_threshold: typeof o.default_threshold === "number" ? o.default_threshold : undefined,
    default_timeout: typeof o.default_timeout === "number" ? o.default_timeout : undefined,
    strict_grader_default: o.strict_grader_default === true,
    default_targets: default_targets.map(String),
    scenarios: parsed,
  };
}

export function listScenarioPacks(packsDir: string): string[] {
  if (!existsSync(packsDir)) return [];
  return readdirSync(packsDir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .map((f) => f.replace(/\.ya?ml$/i, ""))
    .sort();
}

export function loadScenarioPack(packsDir: string, packId: string): ScenarioPackFile {
  const base = join(packsDir, packId);
  const path = existsSync(`${base}.yaml`) ? `${base}.yaml` : `${base}.yml`;
  if (!existsSync(path)) {
    throw new Error(`Scenario pack not found: ${packId} (looked under ${packsDir})`);
  }
  return safeLoad(path);
}

/** Turn pack scenarios into EvalCase[] for one skill path (same execute/judge path as per-skill YAML). */
export function expandPackForSkill(
  pack: ScenarioPackFile,
  skillRel: string,
  packSourceLabel: string,
): EvalCase[] {
  const defaultTimeout = pack.default_timeout ?? 120;
  const inheritStrict = pack.strict_grader_default === true;
  return pack.scenarios.flatMap((s) => {
    if (s.targets != null && s.targets.length > 0 && !s.targets.includes(skillRel)) {
      return [];
    }
    const files: EvalFileSpec[] = (s.files ?? []).map((f) => ({
      path: f.path,
      content: f.content ?? "",
    }));
    const strict =
      s.strict_grader === true ? true : s.strict_grader === false ? false : inheritStrict;
    return [
      {
        name: `[${pack.id}] ${s.name}`,
        prompt: substituteTemplate(s.prompt, skillRel),
        criteria: s.criteria.map((c) => substituteTemplate(c, skillRel)),
        files,
        expect_skill: s.expect_skill !== false,
        timeout: s.timeout ?? defaultTimeout,
        strict_grader: strict || undefined,
        assert: parseAssert(s.assert),
        _source: `${packSourceLabel}#${s.id}@${skillRel}`,
      },
    ];
  });
}

function substituteTemplate(text: string, skillRel: string): string {
  return text
    .replace(/\{\{skill_path\}\}/g, skillRel)
    .replace(/\{\{SKILL_PATH\}\}/g, skillRel);
}

export function validatePackFile(path: string): string[] {
  const errors: string[] = [];
  try {
    safeLoad(path);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }
  return errors;
}

/** Load and parse a single scenario pack file (for validators and tooling). */
export function loadScenarioPackFromPath(path: string): ScenarioPackFile {
  return safeLoad(path);
}

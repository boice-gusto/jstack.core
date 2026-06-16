import { existsSync, readdirSync, readFileSync, type Dirent } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import type { EvalAssert, EvalCase, SkillEvalConfigFile } from "./eval-config.js";

function safeYamlLoad(text: string): unknown {
  try {
    return yaml.load(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("mapping values are not allowed")) throw e;
    return yamlFixColonsAndLoad(text);
  }
}

function yamlFixColonsAndLoad(text: string, maxFixes = 50): unknown {
  const lines = text.split("\n");
  const fixed = new Set<number>();
  for (let attempt = 0; attempt < maxFixes; attempt++) {
    try {
      return yaml.load(lines.join("\n"));
    } catch (err) {
      const mark = (err as { mark?: { line?: number } }).mark;
      const errLine = mark?.line;
      if (errLine === undefined) throw err;
      if (fixed.has(errLine)) throw err;
      const line = lines[errLine];
      const m = /^(\s+\w[\w_-]*):\s+(.+)$/.exec(line);
      if (!m) throw err;
      const value = m[2];
      const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      lines[errLine] = `${m[1]}: "${escaped}"`;
      fixed.add(errLine);
    }
  }
  return yaml.load(lines.join("\n"));
}

export function parseAssert(raw: unknown): EvalAssert | undefined {
  if (raw == null || typeof raw !== "object") return undefined;
  const a = raw as Record<string, unknown>;
  const response_contains = Array.isArray(a.response_contains)
    ? a.response_contains.map((x) => String(x))
    : undefined;
  const response_contains_any = Array.isArray(a.response_contains_any)
    ? a.response_contains_any.map((x) => String(x))
    : undefined;
  const response_not_contains = Array.isArray(a.response_not_contains)
    ? a.response_not_contains.map((x) => String(x))
    : undefined;
  const response_min_length =
    typeof a.response_min_length === "number" && a.response_min_length > 0
      ? a.response_min_length
      : undefined;
  const response_match_regex = Array.isArray(a.response_match_regex)
    ? a.response_match_regex.map((x) => String(x))
    : undefined;
  const has =
    (response_contains && response_contains.length > 0) ||
    (response_contains_any && response_contains_any.length > 0) ||
    (response_not_contains && response_not_contains.length > 0) ||
    response_min_length != null ||
    (response_match_regex && response_match_regex.length > 0);
  if (!has) return undefined;
  return {
    response_contains: response_contains?.length ? response_contains : undefined,
    response_contains_any: response_contains_any?.length ? response_contains_any : undefined,
    response_not_contains: response_not_contains?.length ? response_not_contains : undefined,
    response_min_length,
    response_match_regex: response_match_regex?.length ? response_match_regex : undefined,
  };
}

function normalizeRubricToCriteria(raw: Record<string, unknown>, caseObj: Record<string, unknown>): void {
  if (caseObj.criteria != null || raw.grading == null) return;
  const grading = raw.grading as Record<string, unknown>;
  const rubric = (grading.rubric as unknown[]) ?? [];
  const criteria: string[] = [];
  for (const entry of rubric) {
    if (typeof entry === "string") {
      criteria.push(entry);
      continue;
    }
    if (entry && typeof entry === "object") {
      const e = entry as Record<string, unknown>;
      const desc = String(e.description ?? "");
      const passIf = String(e.pass_if ?? "");
      if (passIf) criteria.push(`${desc} — PASS IF: ${passIf}`);
      else if (desc) criteria.push(desc);
    }
  }
  caseObj.criteria = criteria;
  const pt = grading.pass_threshold;
  if (typeof pt === "number") caseObj.case_pass_threshold = pt;
}

export function discoverEvalCases(skillPath: string, defaultTimeout: number): EvalCase[] {
  const evalsDir = join(skillPath, "evals");
  if (!existsSync(evalsDir)) return [];
  const names = readdirSync(evalsDir).filter((n) => n.endsWith(".yaml") || n.endsWith(".yml"));
  names.sort();
  const cases: EvalCase[] = [];
  for (const n of names) {
    if (n === "eval-config.yaml" || n === "eval-config.yml") continue;
    const fp = join(evalsDir, n);
    let raw: unknown;
    try {
      raw = safeYamlLoad(readFileSync(fp, "utf8"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`${fp}: ${msg}`);
    }
    if (typeof raw !== "object" || raw === null) {
      throw new Error(`${fp}: eval YAML must be a mapping`);
    }
    const o = raw as Record<string, unknown>;
    const caseObj: Record<string, unknown> = { ...o };
    normalizeRubricToCriteria(o, caseObj);
    const name = typeof caseObj.name === "string" ? caseObj.name : n.replace(/\.ya?ml$/i, "");
    const prompt = caseObj.prompt;
    const criteria = caseObj.criteria;
    const filesRaw = caseObj.files;
    const files: EvalCase["files"] = [];
    if (Array.isArray(filesRaw)) {
      for (const f of filesRaw) {
        if (f && typeof f === "object" && "path" in f) {
          const fr = f as Record<string, unknown>;
          files.push({
            path: String(fr.path),
            content: fr.content != null ? String(fr.content) : "",
          });
        }
      }
    }
    const expect_skill = caseObj.expect_skill !== false;
    const timeout = typeof caseObj.timeout === "number" ? caseObj.timeout : defaultTimeout;
    const case_pass_threshold =
      typeof caseObj.case_pass_threshold === "number" ? caseObj.case_pass_threshold : undefined;
    const assert = parseAssert(caseObj.assert);
    const strict_grader = caseObj.strict_grader === true;

    cases.push({
      name,
      prompt: typeof prompt === "string" ? prompt : "",
      criteria: Array.isArray(criteria) ? criteria.map(String) : [],
      files,
      expect_skill,
      timeout,
      case_pass_threshold,
      strict_grader,
      assert,
      _source: fp,
    });
  }
  return cases;
}

export function validateCases(cases: EvalCase[]): string[] {
  const errors: string[] = [];
  for (const c of cases) {
    const prefix = `${c._source} (${c.name})`;
    if (!c.prompt?.trim()) errors.push(`${prefix}: missing or empty 'prompt'`);
    if (!Array.isArray(c.criteria) || c.criteria.length === 0) {
      errors.push(`${prefix}: 'criteria' must be a non-empty list`);
    } else {
      c.criteria.forEach((crit, i) => {
        if (typeof crit !== "string") errors.push(`${prefix}: criteria[${i}] must be a string`);
      });
    }
  }
  return errors;
}

export function loadSkillEvalConfig(skillPath: string): SkillEvalConfigFile | undefined {
  for (const n of ["eval-config.yaml", "eval-config.yml"]) {
    const p = join(skillPath, "evals", n);
    if (!existsSync(p)) continue;
    const raw = safeYamlLoad(readFileSync(p, "utf8"));
    if (typeof raw !== "object" || raw === null) return {};
    return raw as SkillEvalConfigFile;
  }
  return undefined;
}

export function discoverAllSkillRelativePaths(skillsRoot: string): string[] {
  const out: string[] = [];
  function walkDir(absDir: string, rel: string) {
    if (existsSync(join(absDir, "SKILL.md"))) {
      out.push(rel);
    }
    let entries: Dirent[];
    try {
      entries = readdirSync(absDir, { withFileTypes: true }) as Dirent[];
    } catch {
      return;
    }
    for (const ent of entries) {
      const name = String(ent.name);
      if (!ent.isDirectory() || name.startsWith(".")) continue;
      walkDir(join(absDir, name), `${rel}/${name}`);
    }
  }
  if (!existsSync(skillsRoot)) return [];
  for (const ent of readdirSync(skillsRoot, { withFileTypes: true }) as Dirent[]) {
    const top = String(ent.name);
    if (!ent.isDirectory() || top.startsWith(".") || top === "_core") continue;
    walkDir(join(skillsRoot, top), top);
  }
  return [...new Set(out)].sort();
}

function hasSemanticYamlFiles(evalsDir: string): boolean {
  if (!existsSync(evalsDir)) return false;
  return readdirSync(evalsDir).some(
    (f) =>
      (f.endsWith(".yaml") || f.endsWith(".yml")) &&
      f !== "eval-config.yaml" &&
      f !== "eval-config.yml",
  );
}

export function discoverSkillsWithSemanticEvals(skillsRoot: string): string[] {
  return discoverAllSkillRelativePaths(skillsRoot).filter((rel) =>
    hasSemanticYamlFiles(join(skillsRoot, rel, "evals")),
  );
}

export interface CoverageRow {
  skill: string;
  hasEvals: boolean;
  caseCount: number;
}

export function evalCoverageReport(skillsRoot: string): CoverageRow[] {
  const rows: CoverageRow[] = [];
  for (const rel of discoverAllSkillRelativePaths(skillsRoot)) {
    const skillPath = join(skillsRoot, rel);
    const cases = discoverEvalCases(skillPath, 120);
    rows.push({
      skill: rel,
      hasEvals: cases.length > 0,
      caseCount: cases.length,
    });
  }
  return rows;
}

#!/usr/bin/env bun
/**
 * jstack eval CLI — structural, chain, gate, coverage, validate, semantic (LLM).
 *
 * Quick iteration (no API): bun run eval
 * Semantic (needs ANTHROPIC_API_KEY + claude on PATH): bun run eval semantic --skill recon
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkGates,
  evaluateSemanticSummaryGate,
  loadGateRules,
  normalizeGateSkillId,
} from "./gate-runner.js";
import {
  coverageRowsFromCases,
  discoverAllEvalCases,
  discoverAllSkillRelativePaths,
  discoverEvalCases,
  discoverSkillsWithSemanticEvals,
  evalCoverageReport,
  loadSkillEvalConfig,
  validateCases,
  type CoverageRow,
  type SkillEvalCases,
} from "./discover.js";
import {
  loadGlobalEvalEnv,
  mergeGateRule,
  numberFromEnv,
  sanitizePassThreshold,
  skillGateId,
} from "./eval-config.js";
import { executeCase, readSkillMd } from "./execute.js";
import { gradeCase } from "./grade.js";
import {
  buildSemanticSummary,
  printSkillTable,
  writeMultiReport,
  writeSemanticReportFiles,
} from "./report.js";
import type {
  CaseReport,
  SemanticCaseRecord,
  SemanticSummary,
} from "./report.js";
import type { EvalCase } from "./eval-config.js";
import {
  expandPackForSkill,
  listScenarioPacks,
  loadScenarioPack,
  validatePackFile,
} from "./scenario-pack.js";
import { buildSuffixToRelPath, chainStepSkillExists } from "./chain-resolve.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = join(__dirname, "..");
const skillsRoot = join(pluginRoot, "skills");
const reportsDir = join(pluginRoot, "evals", ".reports");

interface UnitEval {
  skill: string;
  input_contains?: string;
  expect_output_contains?: string[];
}

function loadUnit(): { evals: UnitEval[] } {
  const p = join(pluginRoot, "evals", "evals.json");
  return JSON.parse(readFileSync(p, "utf8")) as { evals: UnitEval[] };
}

function loadChain(): { chains: { name: string; steps: string[] }[] } {
  const p = join(pluginRoot, "evals", "chain-evals.json");
  return JSON.parse(readFileSync(p, "utf8")) as {
    chains: { name: string; steps: string[] }[];
  };
}

function parseArgs(argv: string[]) {
  const raw = argv[2] ?? "quick";
  /** Legacy: `run` was structural-only file checks. */
  const normalized = raw === "run" ? "structural" : raw;
  const out = {
    command: normalized,
    skill: undefined as string | undefined,
    threshold: undefined as number | undefined,
    pack: "core-stress" as string,
    allSkills: false,
    listPacks: false,
    maxSkills: undefined as number | undefined,
    dryRun: argv.includes("--dry-run"),
    viewer: argv.includes("--viewer"),
    maxCases: undefined as number | undefined,
    help: argv.includes("--help") || argv.includes("-h"),
  };
  const si = argv.indexOf("--skill");
  if (si >= 0 && argv[si + 1]) out.skill = argv[si + 1];
  const ti = argv.indexOf("--threshold");
  if (ti >= 0 && argv[ti + 1]) out.threshold = Number(argv[ti + 1]);
  const pi = argv.indexOf("--pack");
  if (pi >= 0 && argv[pi + 1]) out.pack = argv[pi + 1];
  out.allSkills = argv.includes("--all-skills");
  out.listPacks = argv.includes("--list-packs");
  const mi = argv.indexOf("--max-skills");
  if (mi >= 0 && argv[mi + 1]) out.maxSkills = Number(argv[mi + 1]);
  const mxc = argv.indexOf("--max-cases");
  if (mxc >= 0 && argv[mxc + 1]) out.maxCases = Number(argv[mxc + 1]);
  return out;
}

function runStructural(skillFilter?: string): { ok: number; total: number } {
  const rels = discoverAllSkillRelativePaths(skillsRoot);
  let ok = 0;
  let total = 0;
  for (const rel of rels) {
    if (
      skillFilter &&
      rel !== skillFilter &&
      !rel.startsWith(`${skillFilter}/`)
    )
      continue;
    total++;
    const skillFile = join(
      pluginRoot,
      "skills",
      ...rel.split("/").filter(Boolean),
      "SKILL.md",
    );
    const pass = existsSync(skillFile);
    console.log(pass ? `✔ ${rel}` : `✖ ${rel} (missing SKILL.md)`);
    if (pass) ok++;
  }
  console.log(
    `structural: ${ok}/${total} skills have SKILL.md (all discovered under skills/)`,
  );
  return { ok, total };
}

function runChain(): { ok: number; total: number } {
  const { chains } = loadChain();
  const relPaths = discoverAllSkillRelativePaths(skillsRoot);
  const suffixToRel = buildSuffixToRelPath(skillsRoot, relPaths);
  let ok = 0;
  for (const c of chains) {
    const missing = c.steps.filter(
      (s) => !chainStepSkillExists(skillsRoot, s, suffixToRel),
    );
    const pass = missing.length === 0;
    console.log(
      pass
        ? `✔ chain ${c.name}`
        : `✖ chain ${c.name} missing: ${missing.join(", ")}`,
    );
    if (pass) ok++;
  }
  console.log(`chains: ${ok}/${chains.length} passed`);
  return { ok, total: chains.length };
}

/**
 * Re-check gate rules against the metrics of a REAL prior semantic run.
 *
 * This command used to pass hard-coded `{tokens: 100, latency_ms: 100}` and the
 * literal string "action_items: []" to checkGates(), which trivially satisfied
 * every rule in gate-evals.json — the command could not fail regardless of what
 * any skill actually did. It now loads the newest `*-semantic-*.json` summary
 * written by `eval semantic` and gates on the recorded metrics, and refuses to
 * report a pass when there is no real run to judge.
 */
function runGate(skillFilter?: string): boolean {
  const rules = loadGateRules(pluginRoot);
  if (!rules.length) {
    console.error(
      "No gate rules defined in evals/gate-evals.json — nothing to enforce.",
    );
    return false;
  }
  const skill = skillFilter
    ? normalizeGateSkillId(skillFilter)
    : (rules[0]?.skill ?? "jstack:setup");

  const summary = loadLatestSemanticSummary(reportsDir, skill);
  if (!summary) {
    console.error(
      `No semantic run found in ${reportsDir} to gate against.\n` +
        `Gates score a real invocation's tokens/latency/output — they cannot be checked from static files.\n` +
        `Run: bun run eval semantic --skill ${stripSkillPrefix(skill)}`,
    );
    return false;
  }

  const { passed, failures, casesChecked } = evaluateSemanticSummaryGate(
    rules,
    skill,
    summary,
  );

  const result = {
    skill,
    source_report: summary.__sourcePath,
    ran_at: summary.timestamp,
    cases_checked: casesChecked,
    passed,
    failures,
  };
  console.log(JSON.stringify(result, null, 2));
  return result.passed;
}

function stripSkillPrefix(skill: string): string {
  return skill.startsWith("jstack:") ? skill.slice("jstack:".length) : skill;
}

/** Newest `*-semantic-*.json` summary in reportsDir, preferring one matching `skill`. */
function loadLatestSemanticSummary(
  dir: string,
  skill: string,
):
  | (SemanticSummary & {
      __sourcePath: string;
      results: (CaseReport & { response?: string })[];
    })
  | null {
  if (!existsSync(dir)) return null;
  const slug = stripSkillPrefix(skill).replaceAll("/", "-");
  const candidates = readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f.includes("-semantic-"))
    .sort()
    .reverse();
  const ordered = [
    ...candidates.filter((f) => f.startsWith(slug)),
    ...candidates.filter((f) => !f.startsWith(slug)),
  ];
  for (const f of ordered) {
    try {
      const parsed = JSON.parse(readFileSync(join(dir, f), "utf8"));
      if (Array.isArray(parsed?.results))
        return { ...parsed, __sourcePath: join(dir, f) };
    } catch {
      // Unreadable/partial report — try the next newest rather than silently passing.
    }
  }
  return null;
}

/**
 * `allCases` defaults to a fresh full walk+parse for standalone callers (`cmdValidate`).
 * `cmdQuick` passes an already-computed set instead, so the same skill's eval YAML isn't
 * re-read and re-parsed a second time in the same run.
 */
function runValidate(
  allCases: SkillEvalCases[] = discoverAllEvalCases(skillsRoot),
): { errors: string[]; skillsChecked: number } {
  const errors: string[] = [];
  let n = 0;
  const casesBySkill = new Map(allCases.map((c) => [c.skill, c.cases]));
  for (const rel of discoverSkillsWithSemanticEvals(skillsRoot)) {
    n++;
    errors.push(...validateCases(casesBySkill.get(rel) ?? []));
  }
  if (errors.length) {
    console.error("Eval YAML validation failed:");
    for (const e of errors) console.error(`  - ${e}`);
  } else {
    console.log(`Eval YAML OK (${n} skills with semantic evals).`);
  }
  return { errors, skillsChecked: n };
}

/** `rows` defaults to a fresh computation for standalone callers (`cmdCoverage`). */
function runCoverage(
  rows: CoverageRow[] = evalCoverageReport(skillsRoot),
): void {
  const withEvals = rows.filter((r) => r.hasEvals);
  const missing = rows.filter((r) => !r.hasEvals);
  console.log("\nSkill eval coverage (semantic YAML)\n");
  console.log(`With evals: ${withEvals.length} / ${rows.length}`);
  for (const r of withEvals) {
    console.log(`  ${r.skill}: ${r.caseCount} case(s)`);
  }
  console.log(`\nMissing semantic evals: ${missing.length}`);
  if (missing.length <= 40) {
    for (const r of missing) console.log(`  - ${r.skill}`);
  } else {
    missing.slice(0, 20).forEach((r) => console.log(`  - ${r.skill}`));
    console.log(`  ... and ${missing.length - 20} more`);
  }
}

function caseSlug(name: string): string {
  return name.replace(/\s+/g, "-").toLowerCase();
}

const scenarioPacksDir = join(pluginRoot, "evals", "scenarios", "packs");

interface RunSemanticCasesOptions {
  skillRel: string;
  cases: EvalCase[];
  env: ReturnType<typeof loadGlobalEvalEnv>;
  gateRules: ReturnType<typeof loadGateRules>;
  writeViewer: boolean;
  /** From CLI / env when skill eval-config has no pass_threshold */
  defaultPassThreshold: number;
  /** Scenario packs or explicit CLI: wins over skill eval-config threshold */
  passThresholdOverride?: number;
  /** Path under workspace (slash-separated); default `skillRel` */
  workspaceRel?: string;
  /** Report filename slug; default `skillRel` with `/` → `__` */
  reportSlug?: string;
  /** Label in JSON summary (`skill_name`) */
  summarySkillName?: string;
}

function runSemanticCases(opts: RunSemanticCasesOptions): {
  summary: ReturnType<typeof buildSemanticSummary>;
  passed: boolean;
} {
  const {
    skillRel,
    cases,
    env,
    gateRules,
    writeViewer,
    defaultPassThreshold,
    passThresholdOverride,
    workspaceRel,
    reportSlug,
    summarySkillName,
  } = opts;

  const valErrs = validateCases(cases);
  if (valErrs.length) {
    for (const e of valErrs) console.error(e);
    throw new Error(`Invalid eval cases for ${skillRel}`);
  }
  if (cases.length === 0) {
    throw new Error(`No eval cases for ${skillRel}`);
  }

  const skillPath = join(skillsRoot, ...skillRel.split("/").filter(Boolean));
  const skillCfg = loadSkillEvalConfig(skillPath);

  const skillGate = skillGateId(skillRel);
  const baseRule = gateRules.find((g) => g.skill === skillGate);
  const mergedGate = mergeGateRule(baseRule, skillCfg?.gate, skillGate);

  const workspaceSegments = (workspaceRel ?? skillRel)
    .split("/")
    .filter(Boolean);
  const skillWorkspace = join(env.workspaceDir, ...workspaceSegments);
  mkdirSync(skillWorkspace, { recursive: true });

  const skillContent = readSkillMd(pluginRoot, skillRel);

  const records: SemanticCaseRecord[] = [];
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const slug = caseSlug(c.name);
    const caseDir = join(skillWorkspace, slug);
    mkdirSync(caseDir, { recursive: true });
    console.log(
      `\n--- Execute [${i + 1}/${cases.length}] ${skillRel}: ${c.name} ---`,
    );
    const er = executeCase(env, skillRel, skillContent, c, caseDir);
    console.log(`status=${er.status} time=${er.elapsed}s tokens=${er.tokens}`);

    console.log(`\n--- Grade [${i + 1}/${cases.length}] ${c.name} ---`);
    let gr;
    if (er.status !== "completed") {
      gr = {
        expectations: c.criteria.map((t) => ({
          text: t,
          passed: false,
          evidence: `Execution ${er.status}`,
        })),
        summary: {
          passed: 0,
          failed: c.criteria.length,
          total: c.criteria.length,
          pass_rate: 0,
        },
      };
      writeFileSync(
        join(caseDir, "grading.json"),
        JSON.stringify(gr, null, 2) + "\n",
      );
    } else {
      gr = gradeCase(env, c, er, caseDir);
    }

    let gateFails: string[] = [];
    if (mergedGate && er.status === "completed") {
      const g = checkGates(
        [mergedGate],
        skillGate,
        { tokens: er.tokens, latency_ms: er.elapsed * 1000 },
        er.response,
      );
      gateFails = g.passed ? [] : g.failures;
    }
    if (gateFails.length) console.log(`gate failures: ${gateFails.join("; ")}`);
    const s = gr.summary;
    console.log(`criteria: ${s.passed}/${s.total} passed`);

    records.push({ case: c, exec: er, grading: gr, gateFailures: gateFails });
  }

  const label = summarySkillName ?? skillRel;
  const summary = buildSemanticSummary(label, records);
  const thresh =
    passThresholdOverride ??
    sanitizePassThreshold(skillCfg?.pass_threshold, defaultPassThreshold);
  const allGatesOk = records.every((r) => r.gateFailures.length === 0);
  const passed = summary.pass_rate >= thresh && allGatesOk;

  printSkillTable(summary, thresh);
  mkdirSync(reportsDir, { recursive: true });
  const slugOut = reportSlug ?? skillRel.replace(/\//g, "__");
  const files = writeSemanticReportFiles(
    reportsDir,
    slugOut,
    summary,
    pluginRoot,
  );
  console.log(`\nWrote: ${files.summaryPath}`);
  console.log(`Wrote: ${files.nextStepsPath}`);
  if (writeViewer && files.viewerPath)
    console.log(`Wrote: ${files.viewerPath}`);

  return { summary, passed };
}

function runSemanticSkill(
  rel: string,
  env: ReturnType<typeof loadGlobalEvalEnv>,
  threshold: number,
  gateRules: ReturnType<typeof loadGateRules>,
  writeViewer: boolean,
  maxCases?: number,
): { summary: ReturnType<typeof buildSemanticSummary>; passed: boolean } {
  const skillPath = join(skillsRoot, ...rel.split("/"));
  const skillCfg = loadSkillEvalConfig(skillPath);
  const t = skillCfg?.timeout ?? env.defaultTimeout;
  let cases = discoverEvalCases(skillPath, t);
  if (maxCases != null && Number.isFinite(maxCases) && maxCases > 0) {
    cases = cases.slice(0, maxCases);
  }
  return runSemanticCases({
    skillRel: rel,
    cases,
    env,
    gateRules,
    writeViewer,
    defaultPassThreshold: threshold,
  });
}

function printHelp(): void {
  console.log(`
jstack eval CLI

  bun run eval [command] [options]

Commands:
  quick (default)   Structural unit checks + chain checks + validate YAML + coverage summary (no LLM)
  structural        SKILL.md exists for every skill under skills/ (all discovered)
  chain             evals/chain-evals.json step presence
  gate              Sample gate check (see gate-evals.json)
  validate          Lint all skills/*/evals/*.yaml (no API)
  coverage          List skills with / without semantic evals
  semantic          Run LLM evals (needs ANTHROPIC_API_KEY and claude on PATH)
  scenarios         Run a YAML scenario pack across skills (same execute + judge as semantic)
  scenarios-validate  Lint all evals/scenarios/packs/*.yaml
  report            JSON summary of structural + chain counts

Options:
  --skill <path>    e.g. recon or knowledge/search (semantic, structural, scenarios, quick first section)
  --threshold <n>   Pass threshold for semantic / scenarios (overrides pack default_threshold when set)
  --pack <id>       Scenario pack id (default: core-stress); use with scenarios
  --all-skills      scenarios: run pack against every skill under skills/ (not only default_targets)
  --list-packs      scenarios: print pack ids and exit
  --max-skills <n>  scenarios: cap number of skills after target list is resolved
  --dry-run         scenarios: expand cases and validate only (no API / claude)
  --viewer          Write HTML viewer for semantic runs
  --max-cases <n>   semantic: run only the first N YAML cases per skill (e.g. 1 for smoke)
  --help            This help

Environment:
  ANTHROPIC_API_KEY   Required for semantic / scenarios
  JSTACK_EVAL_CLAUDE_BIN  Default: claude
  JSTACK_EVAL_STRICT_GRADER  If 1/true, use strict grader unless case disables it
`);
}

const args = parseArgs(process.argv);

if (args.help) {
  printHelp();
  process.exit(0);
}

type CliArgs = ReturnType<typeof parseArgs>;

function cmdStructural(args: CliArgs): number {
  const { ok, total } = runStructural(args.skill);
  return ok === total ? 0 : 1;
}

function cmdChain(_args: CliArgs): number {
  const { ok, total } = runChain();
  return ok === total ? 0 : 1;
}

function cmdGate(args: CliArgs): number {
  return runGate(args.skill) ? 0 : 1;
}

function cmdValidate(_args: CliArgs): number {
  const { errors } = runValidate();
  return errors.length ? 1 : 0;
}

function cmdCoverage(_args: CliArgs): number {
  runCoverage();
  return 0;
}

function cmdReport(_args: CliArgs): number {
  const { evals } = loadUnit();
  const { chains } = loadChain();
  const cov = evalCoverageReport(skillsRoot);
  const allSkills = discoverAllSkillRelativePaths(skillsRoot);
  console.log(
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        structural_skills_total: allSkills.length,
        evals_json_entries: evals.length,
        chain_total: chains.length,
        skills_total: cov.length,
        skills_with_semantic_evals: cov.filter((r) => r.hasEvals).length,
      },
      null,
      2,
    ),
  );
  return 0;
}

function cmdSemantic(args: CliArgs): number {
  const env = loadGlobalEvalEnv(pluginRoot);
  mkdirSync(env.workspaceDir, { recursive: true });
  if (!env.anthropicApiKey && !process.env.ANTHROPIC_API_KEY) {
    console.error(
      "semantic eval requires ANTHROPIC_API_KEY in the environment.",
    );
    return 1;
  }
  const threshold = args.threshold ?? env.passThreshold;
  const gateRules = loadGateRules(pluginRoot);
  let targets = discoverSkillsWithSemanticEvals(skillsRoot);
  if (args.skill) {
    targets = targets.filter(
      (t) => t === args.skill || t.startsWith(args.skill + "/"),
    );
    if (targets.length === 0) {
      console.error(`No semantic evals found for skill filter: ${args.skill}`);
      return 1;
    }
  }
  const parts: {
    skill: string;
    summary: ReturnType<typeof buildSemanticSummary>;
    passed_threshold: boolean;
  }[] = [];
  let allPass = true;
  for (const rel of targets) {
    try {
      const { summary, passed } = runSemanticSkill(
        rel,
        env,
        threshold,
        gateRules,
        args.viewer,
        args.maxCases,
      );
      if (!passed) allPass = false;
      parts.push({ skill: rel, summary, passed_threshold: passed });
    } catch (e) {
      console.error(e);
      allPass = false;
    }
  }
  if (parts.length > 1) {
    const multiPath = writeMultiReport(reportsDir, parts, threshold);
    console.log(`\nMulti-skill report: ${multiPath}`);
    console.log(`Also: ${join(reportsDir, "REPORT_LATEST.md")}`);
  }
  return allPass ? 0 : 1;
}

function cmdScenariosValidate(_args: CliArgs): number {
  if (!existsSync(scenarioPacksDir)) {
    console.log("No scenario packs directory; nothing to validate.");
    return 0;
  }
  const errors: string[] = [];
  for (const name of readdirSync(scenarioPacksDir)) {
    if (!/\.ya?ml$/i.test(name)) continue;
    errors.push(...validatePackFile(join(scenarioPacksDir, name)));
  }
  const packIds = listScenarioPacks(scenarioPacksDir);
  if (errors.length) {
    console.error("Scenario pack validation failed:");
    for (const e of errors) console.error(`  - ${e}`);
    return 1;
  }
  console.log(`Scenario packs OK (${packIds.length} pack(s)).`);
  return 0;
}

function cmdScenarios(args: CliArgs): number {
  if (args.listPacks) {
    const packs = listScenarioPacks(scenarioPacksDir);
    if (!packs.length) {
      console.log(`No packs under ${scenarioPacksDir}`);
    } else {
      console.log("Scenario packs:\n");
      for (const p of packs) console.log(`  - ${p}`);
    }
    return 0;
  }

  const pack = loadScenarioPack(scenarioPacksDir, args.pack);
  let targets: string[];
  if (args.allSkills) {
    targets = discoverAllSkillRelativePaths(skillsRoot);
  } else if (args.skill) {
    targets = pack.default_targets.filter(
      (t) => t === args.skill || t.startsWith(`${args.skill}/`),
    );
    if (targets.length === 0) {
      targets = discoverAllSkillRelativePaths(skillsRoot).filter(
        (t) => t === args.skill || t.startsWith(`${args.skill}/`),
      );
    }
  } else {
    targets = [...pack.default_targets];
  }
  if (
    args.maxSkills != null &&
    Number.isFinite(args.maxSkills) &&
    args.maxSkills > 0
  ) {
    targets = targets.slice(0, args.maxSkills);
  }

  const scenarioPassThresh =
    args.threshold !== undefined
      ? args.threshold
      : pack.default_threshold !== undefined
        ? pack.default_threshold
        : undefined;
  const env = loadGlobalEvalEnv(pluginRoot);
  const defaultTh = args.threshold ?? env.passThreshold;

  if (args.dryRun) {
    const threshLabel =
      scenarioPassThresh !== undefined
        ? String(scenarioPassThresh)
        : `(per-skill eval-config, else ${env.passThreshold})`;
    console.log(
      `Dry run — pack: ${pack.id} | scenarios in pack: ${pack.scenarios.length}`,
    );
    console.log(`Pass threshold: ${threshLabel}`);
    console.log(`Skills to run: ${targets.length}\n`);
    let validationErrors = 0;
    let expandedSkills = 0;
    const withSkillMd = targets.filter((r) =>
      existsSync(join(skillsRoot, ...r.split("/").filter(Boolean), "SKILL.md")),
    );
    for (const rel of targets) {
      const skillFile = join(
        skillsRoot,
        ...rel.split("/").filter(Boolean),
        "SKILL.md",
      );
      if (!existsSync(skillFile)) {
        console.log(`  [skip] ${rel} — no SKILL.md`);
        continue;
      }
      expandedSkills++;
      const cases = expandPackForSkill(pack, rel, `pack:${pack.id}`);
      const valErrs = validateCases(cases);
      if (valErrs.length) {
        validationErrors++;
        console.log(`  [invalid] ${rel}`);
        for (const e of valErrs) console.log(`    - ${e}`);
        continue;
      }
      console.log(`  ${rel}: ${cases.length} case(s)`);
      for (const c of cases) console.log(`    - ${c.name}`);
    }
    let expandedCaseCount = 0;
    for (const rel of withSkillMd) {
      expandedCaseCount += expandPackForSkill(
        pack,
        rel,
        `pack:${pack.id}`,
      ).length;
    }
    console.log(
      `\nLLM calls if executed: ~${expandedCaseCount * 2} (execute + grade per case).`,
    );
    if (expandedSkills === 0) {
      console.error("Dry run: no matching skills with SKILL.md.");
      return 1;
    }
    return validationErrors ? 1 : 0;
  }

  mkdirSync(env.workspaceDir, { recursive: true });
  if (!env.anthropicApiKey && !process.env.ANTHROPIC_API_KEY) {
    console.error(
      "scenarios eval requires ANTHROPIC_API_KEY in the environment.",
    );
    console.error(
      "Tip: use --dry-run to list cases without API; or export ANTHROPIC_API_KEY and re-run.",
    );
    return 1;
  }

  const gateRules = loadGateRules(pluginRoot);
  const parts: {
    skill: string;
    summary: ReturnType<typeof buildSemanticSummary>;
    passed_threshold: boolean;
  }[] = [];
  let allPass = true;
  for (const rel of targets) {
    const skillFile = join(
      skillsRoot,
      ...rel.split("/").filter(Boolean),
      "SKILL.md",
    );
    if (!existsSync(skillFile)) {
      console.warn(`Skipping ${rel}: no SKILL.md`);
      continue;
    }
    const cases = expandPackForSkill(pack, rel, `pack:${pack.id}`);
    try {
      const { summary, passed } = runSemanticCases({
        skillRel: rel,
        cases,
        env,
        gateRules,
        writeViewer: args.viewer,
        defaultPassThreshold: defaultTh,
        passThresholdOverride: scenarioPassThresh,
        workspaceRel: [
          ...rel.split("/").filter(Boolean),
          "scenarios",
          pack.id,
        ].join("/"),
        reportSlug: `${rel.replace(/\//g, "__")}__scenarios__${pack.id}`,
        summarySkillName: `${rel} [scenario:${pack.id}]`,
      });
      if (!passed) allPass = false;
      parts.push({ skill: rel, summary, passed_threshold: passed });
    } catch (e) {
      console.error(e);
      allPass = false;
    }
  }
  if (parts.length === 0) {
    console.error("No matching skills to run.");
    return 1;
  }
  if (parts.length > 1) {
    const multiPath = writeMultiReport(
      reportsDir,
      parts,
      scenarioPassThresh ?? defaultTh,
    );
    console.log(`\nMulti-skill report: ${multiPath}`);
    console.log(`Also: ${join(reportsDir, "REPORT_LATEST.md")}`);
  }
  return allPass ? 0 : 1;
}

function cmdQuick(args: CliArgs): number {
  console.log("=== Structural (SKILL.md for every skill) ===\n");
  const u = runStructural(args.skill);
  console.log("\n=== Chain (chain-evals.json) ===\n");
  const c = runChain();
  console.log("\n=== Validate semantic YAML ===\n");
  // Walk skills/ and parse every eval YAML exactly once for this whole command, instead of
  // once inside runValidate, again inside runCoverage's evalCoverageReport, and a third time
  // for this function's own JSON report.
  const allCases = discoverAllEvalCases(skillsRoot);
  const cov = coverageRowsFromCases(allCases);
  const v = runValidate(allCases);
  runCoverage(cov);
  mkdirSync(reportsDir, { recursive: true });
  const quickPath = join(reportsDir, "quick-latest.json");
  writeFileSync(
    quickPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        structural_ok: u.ok === u.total,
        structural: u,
        chain_ok: c.ok === c.total,
        chain: c,
        validate_ok: v.errors.length === 0,
        validate_errors: v.errors,
        coverage: {
          skills_total: cov.length,
          with_semantic_evals: cov.filter((r) => r.hasEvals).length,
        },
        next_steps: [
          "Regenerate evals/evals.json after add/remove: bun run generate-evals-json",
          "Run bun run eval validate after editing YAML; semantic: bun run eval semantic --skill <name>; cross-skill stress: bun run eval scenarios --pack core-stress.",
        ],
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`\nWrote ${quickPath}`);

  // Coverage now GATES. It used to be printed and discarded: runCoverage()'s result
  // never reached the exit code, so coverage could fall to 0/135 and `eval:quick`
  // still exited 0. Floor is a percentage; override with JSTACK_EVAL_COVERAGE_MIN
  // (e.g. 90) when intentionally landing a skill ahead of its evals.
  const covFloor = numberFromEnv(process.env.JSTACK_EVAL_COVERAGE_MIN, 100);
  const covWith = cov.filter((r) => r.hasEvals).length;
  const covPct = cov.length ? (covWith / cov.length) * 100 : 100;
  const covOk = covPct >= covFloor;
  if (!covOk) {
    const missing = cov.filter((r) => !r.hasEvals).map((r) => r.skill);
    console.error(
      `\n✖ eval coverage ${covWith}/${cov.length} (${covPct.toFixed(1)}%) below required ${covFloor}%.` +
        `\n  Skills without semantic evals:\n${missing.map((m) => `    - ${m}`).join("\n")}` +
        `\n  Scaffold them with: bun run generate-skill-evals` +
        `\n  Or lower the floor for this run: JSTACK_EVAL_COVERAGE_MIN=${Math.floor(covPct)} bun run eval:quick`,
    );
  }

  return u.ok === u.total && c.ok === c.total && v.errors.length === 0 && covOk
    ? 0
    : 1;
}

const commands: Record<string, (args: CliArgs) => number> = {
  structural: cmdStructural,
  chain: cmdChain,
  gate: cmdGate,
  validate: cmdValidate,
  coverage: cmdCoverage,
  report: cmdReport,
  semantic: cmdSemantic,
  "scenarios-validate": cmdScenariosValidate,
  scenarios: cmdScenarios,
  quick: cmdQuick,
};

const cmd = args.command;
const handler = commands[cmd];
if (!handler) {
  console.error(`Unknown command: ${cmd}`);
  printHelp();
  process.exit(1);
}
process.exit(handler(args));

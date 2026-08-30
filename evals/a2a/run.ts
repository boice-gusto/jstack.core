#!/usr/bin/env bun
/**
 * A2A eval runner — behavioral tests for every surface, not just skills.
 *
 * Flow per case:
 *   1. Exercise the subject (CLI command, hook with stdin JSON, artifact, or a candidate agent).
 *   2. Run deterministic assertions. A factual failure ends the case here — no judge is called,
 *      because a model cannot tell us more than the exit code already did, and calling one would
 *      only add cost and variance.
 *   3. If facts hold and the case has semantic criteria, ask a SEPARATE judge agent, which must
 *      answer in the strict `TEST_PASSED | TEST_FAILED` + `MSG=` contract (see protocol.ts).
 *   4. Parse the verdict strictly. Anything malformed is a failure, never a pass.
 *
 * Exit codes: 0 all cases passed, 1 a case failed, 2 the suite could not run as requested.
 *
 * On a missing API key the runner does NOT quietly pass. It runs every deterministic case and
 * reports judge-backed cases as SKIPPED, and `--require-judge` turns those skips into a
 * failure. That distinction matters: this repo already had one gate that reported success
 * when it had nothing to check.
 *
 * Judge access: set ANTHROPIC_API_KEY, or set JSTACK_ALLOW_CLI_JUDGE=1 to borrow an authenticated
 * `claude` CLI when running inside Claude Code. The latter is opt-in on purpose — see the comment
 * on `cliJudgeAllowed` below.
 *
 * Cases run with bounded concurrency (`JSTACK_EVAL_CONCURRENCY`, default 6), not one at a time.
 * Each judge-backed case's dominant cost is 1-2 nested `claude` process invocations at 20-90s of
 * session overhead apiece; at ~90 cases that was 30-60+ minutes fully serial. Cases are
 * independent (separate subjects, separate judge calls), so `runWithConcurrency` below fans them
 * out across a small worker pool instead — real wall-clock win, same per-case behavior.
 */
import {
  readdirSync,
  readFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import yaml from "js-yaml";
import {
  buildJudgePrompt,
  parseJudgeVerdict,
  VERDICT_FAIL,
  VERDICT_PASS,
} from "./protocol.js";
import { exerciseSubject } from "./subjects.js";
import { spawnAsync } from "./spawn.js";
import {
  isModelBackend,
  MODEL_BACKENDS,
  type ModelBackend,
} from "./backends.js";
import { runDeterministicAsserts, type AssertionResult } from "./assertions.js";
import {
  validateCaseSpec,
  type CaseLoadError,
  type CaseSpec,
} from "./case-spec.js";

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = join(here, "..", "..");
const casesDir = join(here, "cases");
// Scratch output convention shared with .tmp/crew-evals/ and .tmp/ralph-design/: gitignored,
// safe to nuke, never a source of truth. `bun run eval:cleanup` removes only evals/a2a/'s own
// subtree under here, never siblings another tool wrote.
const tmpRoot = join(pluginRoot, ".tmp", "a2a");

const argv = process.argv.slice(2);
const asJson = argv.includes("--json");
const requireJudge = argv.includes("--require-judge");
const listOnly = argv.includes("--list");
const filterIdx = argv.indexOf("--filter");
const filter = filterIdx >= 0 ? argv[filterIdx + 1] : undefined;
const surfaceIdx = argv.indexOf("--surface");
const surfaceFilter = surfaceIdx >= 0 ? argv[surfaceIdx + 1] : undefined;

/**
 * `--models` is the single knob that turns this same runner, same case files, into either the
 * single-model or multi-model regression command:
 *   bun run single-eval-suite-regression-test        -> --models claude (the default)
 *   bun run multi-model-eval-suite-regression-test    -> --models claude,codex
 * A case file never names a model; every model in the list gets exactly the same subject spec
 * and the same deterministic/judge assertions, so a difference in outcome is a real difference
 * in the model, not a difference in what was asked of it.
 */
const modelsIdx = argv.indexOf("--models");
const modelsArgRaw = modelsIdx >= 0 ? argv[modelsIdx + 1] : undefined;
const requestedModels = (modelsArgRaw ?? "claude")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);
const invalidModels = requestedModels.filter((m) => !isModelBackend(m));
if (invalidModels.length > 0) {
  console.error(
    `Unknown --models value(s): ${invalidModels.join(", ")}. Valid backends: ${MODEL_BACKENDS.join(", ")}`,
  );
  process.exit(2);
}
const models = requestedModels as ModelBackend[];

const apiKey = process.env.ANTHROPIC_API_KEY;

/**
 * The judge is always Claude, regardless of which model(s) are under test as candidates.
 * Grading Codex's output with Codex (or Claude's with Claude) would make the pass/fail
 * comparison between models meaningless -- a single fixed, independent standard is what
 * makes "claude passed, codex failed" a real finding instead of two different rubrics.
 *
 * There are two ways to reach it: a raw API key, or an already-authenticated `claude` CLI when
 * we are running inside Claude Code (`CLAUDE_CODE_ENTRYPOINT`). `askJudge` has always accepted the
 * second path, but `judgeAvailable` only ever accepted the first — so the CLI path was unreachable
 * and every judge-backed case skipped even with a working `claude` on PATH.
 *
 * Enabling it unconditionally is wrong too: `bun run check` inside Claude Code would silently fan
 * out into 20+ nested model calls at up to 120s each. So the CLI path is opt-in.
 */
const judgeBin = process.env.JSTACK_CLAUDE_BIN ?? "claude";
const cliJudgeAllowed =
  process.env.JSTACK_ALLOW_CLI_JUDGE === "1" &&
  !!process.env.CLAUDE_CODE_ENTRYPOINT;
const judgeReachable = !!apiKey || cliJudgeAllowed;

type Status = "passed" | "failed" | "skipped";

interface CaseResult {
  id: string;
  surface: string;
  /** Which candidate model produced this result. Fixed across every case in one report file
   * (see writeModelReport), but kept per-result too so compare.ts can flatten reports from
   * several models into one array without losing the association. */
  model: ModelBackend;
  status: Status;
  asserts: AssertionResult[];
  judge?: { passed: boolean; message: string; protocolError?: string };
  reason?: string;
  elapsedMs: number;
  /** Subject's raw output, truncated. Kept so compare.ts can measure textual divergence between
   * two models' candidate output directly, rather than only comparing pass/fail verdicts. */
  output?: string;
}

const OUTPUT_SNIPPET_MAX = 4000;
function snippet(text: string): string {
  return text.length > OUTPUT_SNIPPET_MAX
    ? text.slice(0, OUTPUT_SNIPPET_MAX) + "…[truncated]"
    : text;
}

function loadCases(): { cases: CaseSpec[]; loadErrors: CaseLoadError[] } {
  if (!existsSync(casesDir)) return { cases: [], loadErrors: [] };
  const cases: CaseSpec[] = [];
  const loadErrors: CaseLoadError[] = [];
  for (const f of readdirSync(casesDir).sort()) {
    if (!f.endsWith(".yaml") && !f.endsWith(".yml")) continue;
    const parsed = yaml.load(readFileSync(join(casesDir, f), "utf8"));
    const list = Array.isArray(parsed) ? parsed : [parsed];
    for (const c of list) {
      const validated = validateCaseSpec(c, f);
      if (validated.ok) {
        cases.push(validated.case);
      } else {
        loadErrors.push(validated.error);
      }
    }
  }
  return { cases, loadErrors };
}

/**
 * Ask an independent judge agent. Returns null when no judge is available.
 *
 * Reuses `subjects.ts`'s `spawnAsync` (spawn + timeout-driven SIGTERM + settle-once) instead of
 * a second, independent copy of the same spawn/timeout/settle logic -- the two had already
 * drifted (this one hardcoded `8 * 1024 * 1024` again instead of importing `MAX_BUFFER`, and
 * ignored stderr entirely rather than capturing it alongside stdout). Losing the "ignore stdin
 * via `stdio: ['ignore', ...]`" distinction is harmless: `spawnAsync` with no `input` just closes
 * the write end of a piped stdin instead, which is the same "no input" outcome from the child's
 * side.
 */
function askJudge(prompt: string): Promise<string | null> {
  if (!judgeReachable) return Promise.resolve(null);
  return spawnAsync(judgeBin, ["-p", prompt, "--output-format", "text"], {
    cwd: pluginRoot,
    env: { ...process.env, ANTHROPIC_API_KEY: apiKey ?? "" },
    timeoutMs: Number(process.env.JSTACK_EVAL_TIMEOUT_MS ?? 120_000),
  }).then((r) => {
    const text = (r.stdout ?? "").trim();
    return text === "" ? null : text;
  });
}

/**
 * Run a bounded number of async workers over `items`, preserving each result at its original
 * index regardless of completion order. Judge/agentic calls dominate wall-clock (20-90s each of
 * nested-session overhead) and are fully independent across cases, so this is what turns ~90
 * sequential cases into a suite that finishes in minutes instead of the better part of an hour.
 * The limit is intentionally conservative: each slot is a real nested `claude` process (CPU +
 * real API/session cost), not a free-to-fan-out network call.
 */
async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const i = nextIndex++;
      if (i >= items.length) return;
      results[i] = await fn(items[i] as T, i);
    }
  }
  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

function judgeAvailable(): boolean {
  if (!judgeReachable) return false;
  const probe = spawnSync(judgeBin, ["--version"], {
    encoding: "utf8",
    timeout: 20_000,
  });
  return !probe.error && probe.status === 0;
}

/** `--version` isn't judge-specific -- used to gate a whole `--models` run on every requested
 * candidate backend actually being runnable, before spending time on any case. */
function backendAvailable(model: ModelBackend): boolean {
  const bin =
    model === "claude"
      ? (process.env.JSTACK_CLAUDE_BIN ?? "claude")
      : (process.env.JSTACK_CODEX_BIN ?? "codex");
  const probe = spawnSync(bin, ["--version"], {
    encoding: "utf8",
    timeout: 20_000,
  });
  return !probe.error && probe.status === 0;
}

const { cases, loadErrors } = loadCases();
if (loadErrors.length > 0) {
  for (const e of loadErrors) {
    console.error(`✗ invalid case in ${e.sourceFile}: ${e.message}`);
  }
}
const selected = cases.filter(
  (c) =>
    (!filter || c.id.includes(filter)) &&
    (!surfaceFilter || c.surface === surfaceFilter),
);

if (listOnly) {
  for (const c of selected) {
    const mode = c.criteria?.length ? "judge" : "deterministic";
    console.log(`${c.surface.padEnd(12)} ${mode.padEnd(14)} ${c.id}`);
  }
  console.log(`\n${selected.length} case(s)`);
  process.exit(0);
}

if (selected.length === 0) {
  console.error("No A2A cases matched. Add cases under evals/a2a/cases/*.yaml");
  process.exit(2);
}

const canJudge = judgeAvailable();

async function runCase(c: CaseSpec, model: ModelBackend): Promise<CaseResult> {
  const started = Date.now();
  const needsJudge = (c.criteria?.length ?? 0) > 0;

  if (needsJudge && !canJudge) {
    return {
      id: c.id,
      surface: c.surface,
      model,
      status: "skipped",
      asserts: [],
      reason:
        "no judge available (needs ANTHROPIC_API_KEY, or JSTACK_ALLOW_CLI_JUDGE=1 with an authenticated `claude` on PATH inside Claude Code)",
      elapsedMs: Date.now() - started,
    };
  }

  const out = await exerciseSubject(pluginRoot, c.subject, model, {
    cwd: pluginRoot,
    apiKey,
    claudeBin: process.env.JSTACK_CLAUDE_BIN,
    codexBin: process.env.JSTACK_CODEX_BIN,
  });
  const asserts = runDeterministicAsserts(c.expect, out);
  const factsHold = asserts.every((a) => a.passed);

  if (!factsHold) {
    return {
      id: c.id,
      surface: c.surface,
      model,
      status: "failed",
      asserts,
      reason: "deterministic assertion failed; judge not consulted",
      elapsedMs: Date.now() - started,
      output: snippet(out.text),
    };
  }

  if (!needsJudge) {
    return {
      id: c.id,
      surface: c.surface,
      model,
      status: "passed",
      asserts,
      elapsedMs: Date.now() - started,
      output: snippet(out.text),
    };
  }

  const prompt = buildJudgePrompt({
    subject: `${c.surface}: ${c.id}`,
    task: c.subject.task ?? c.description,
    criteria: c.criteria ?? [],
    output: out.text,
  });
  const reply = await askJudge(prompt);
  if (reply === null) {
    // A judge that could not be reached is not a pass.
    return {
      id: c.id,
      surface: c.surface,
      model,
      status: "failed",
      asserts,
      reason: "judge produced no reply after invocation",
      elapsedMs: Date.now() - started,
      output: snippet(out.text),
    };
  }
  const verdict = parseJudgeVerdict(reply);
  return {
    id: c.id,
    surface: c.surface,
    model,
    status: verdict.passed ? "passed" : "failed",
    asserts,
    judge: {
      passed: verdict.passed,
      message: verdict.message,
      protocolError: verdict.protocolError,
    },
    elapsedMs: Date.now() - started,
    output: snippet(out.text),
  };
}

const concurrency = Math.max(
  1,
  Number(process.env.JSTACK_EVAL_CONCURRENCY ?? 6),
);

// Invalid cases fail every model's run identically -- a malformed YAML case isn't a
// model-dependent fact, so it's computed once and appended to each model's report rather than
// re-derived per model.
function loadErrorResultsFor(model: ModelBackend): CaseResult[] {
  return loadErrors.map((e) => ({
    id: `invalid:${e.sourceFile}`,
    surface: "load",
    model,
    status: "failed" as const,
    asserts: [],
    reason: e.message,
    elapsedMs: 0,
  }));
}

interface ModelReport {
  model: ModelBackend;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  judge_available: boolean;
  results: CaseResult[];
  /** Set when a prior dated baseline existed to compare against; human-readable, printed once. */
  baselineDelta?: string;
}

/** Writes one model's report to its own file under `.tmp/a2a/<model>/latest.json` -- kept
 * per-model rather than one merged file so `bun run eval:compare` can read exactly the models
 * that were actually run (whatever subset of MODEL_BACKENDS exists on disk), and so a
 * single-model run never has to know a multi-model shape. */
function writeModelReport(report: ModelReport): void {
  const dir = join(tmpRoot, report.model);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "latest.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
}

/** One dated snapshot per model per day, in `evals/.reports/` (not `.tmp/a2a/`) so it survives
 * `bun run eval:cleanup` and the `rm -rf .tmp/a2a` a fresh run typically starts with -- a baseline
 * that gets wiped by the same command it's meant to be compared across runs of is useless. Only
 * pass/fail/skipped counts are kept, not full case detail, since this exists to answer "did this
 * model's overall pass rate move," not to duplicate `.tmp/a2a/<model>/latest.json`. */
const baselinesDir = join(pluginRoot, "evals", ".reports", "a2a-baselines");

interface BaselineSnapshot {
  date: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
}

/** The most recent dated snapshot strictly before today, or null if none exists yet. */
/** A malformed baseline file (a crashed prior run's partial write, or a hand-edit gone wrong)
 * must not crash this run over a display-only delta feature -- fall back through progressively
 * older dated files, and give up on showing a delta entirely (return null) rather than throwing. */
function readPriorBaseline(
  model: ModelBackend,
  today: string,
): BaselineSnapshot | null {
  const dir = join(baselinesDir, model);
  if (!existsSync(dir)) return null;
  const dates = readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f < `${today}.json`)
    .sort()
    .reverse();
  for (const file of dates) {
    try {
      return JSON.parse(readFileSync(join(dir, file), "utf8"));
    } catch {
      // Try the next-oldest dated file instead of crashing the whole run over one bad snapshot.
    }
  }
  return null;
}

function writeBaselineSnapshot(report: ModelReport, today: string): void {
  const dir = join(baselinesDir, report.model);
  mkdirSync(dir, { recursive: true });
  const snapshot: BaselineSnapshot = {
    date: today,
    total: report.total,
    passed: report.passed,
    failed: report.failed,
    skipped: report.skipped,
  };
  writeFileSync(
    join(dir, `${today}.json`),
    JSON.stringify(snapshot, null, 2) + "\n",
  );
}

const todayIso = new Date().toISOString().slice(0, 10);
const modelReports: ModelReport[] = [];
for (const model of models) {
  if (!backendAvailable(model)) {
    console.error(
      `✗ ${model}: binary not found or not runnable on PATH -- skipping this model's run entirely`,
    );
    modelReports.push({
      model,
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      judge_available: canJudge,
      results: [],
    });
    continue;
  }
  const runResults = await runWithConcurrency(selected, concurrency, (c) =>
    runCase(c, model),
  );
  const results = [...runResults, ...loadErrorResultsFor(model)];
  const report: ModelReport = {
    model,
    total: results.length,
    passed: results.filter((r) => r.status === "passed").length,
    failed: results.filter((r) => r.status === "failed").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    judge_available: canJudge,
    results,
  };
  const prior = readPriorBaseline(model, todayIso);
  if (prior) {
    const delta = report.passed - prior.passed;
    const sign = delta > 0 ? "+" : "";
    report.baselineDelta = `vs ${prior.date} baseline: passed ${prior.passed}→${report.passed} (${sign}${delta}), failed ${prior.failed}→${report.failed}`;
  }
  writeModelReport(report);
  writeBaselineSnapshot(report, todayIso);
  modelReports.push(report);
}

if (asJson) {
  console.log(
    JSON.stringify(
      models.length === 1 ? modelReports[0] : { models: modelReports },
      null,
      2,
    ),
  );
} else {
  for (const report of modelReports) {
    if (models.length > 1) console.log(`\n=== model: ${report.model} ===`);
    for (const r of report.results) {
      const tag =
        r.status === "passed"
          ? VERDICT_PASS
          : r.status === "failed"
            ? VERDICT_FAIL
            : "TEST_SKIPPED";
      console.log(`${tag}  [${r.surface}] ${r.id}`);
      for (const a of r.asserts.filter((x) => !x.passed)) {
        console.log(`    assert failed: ${a.label} — ${a.detail}`);
      }
      if (r.judge?.protocolError)
        console.log(`    judge protocol error: ${r.judge.protocolError}`);
      if (r.judge?.message) console.log(`    MSG=${r.judge.message}`);
      if (r.reason) console.log(`    ${r.reason}`);
    }
    console.log(
      `\n${report.passed} passed, ${report.failed} failed, ${report.skipped} skipped (judge ${canJudge ? "available" : "unavailable"})`,
    );
    if (report.baselineDelta) console.log(report.baselineDelta);
  }
  const anySkipped = modelReports.some((r) => r.skipped > 0);
  if (anySkipped && !requireJudge) {
    console.log(
      "\nJudge-backed cases were skipped. Use --require-judge to treat that as a failure.",
    );
  }
  if (models.length > 1) {
    console.log(
      `\nReports written per model under .tmp/a2a/<model>/latest.json. Run 'bun run eval:compare' for a cross-model breakdown.`,
    );
  }
}

const totalFailed = modelReports.reduce((sum, r) => sum + r.failed, 0);
const totalSkipped = modelReports.reduce((sum, r) => sum + r.skipped, 0);

if (totalFailed > 0) process.exit(1);
if (totalSkipped > 0 && requireJudge) {
  console.error(
    `--require-judge was set but ${totalSkipped} case(s) had no judge available.`,
  );
  process.exit(1);
}
process.exit(0);

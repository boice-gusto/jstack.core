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
import { spawn, spawnSync } from "node:child_process";
import yaml from "js-yaml";
import {
  buildJudgePrompt,
  parseJudgeVerdict,
  VERDICT_FAIL,
  VERDICT_PASS,
} from "./protocol.js";
import { exerciseSubject } from "./subjects.js";
import {
  runDeterministicAsserts,
  type AssertionResult,
} from "./assertions.js";
import { validateCaseSpec, type CaseLoadError, type CaseSpec } from "./case-spec.js";

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = join(here, "..", "..");
const casesDir = join(here, "cases");
const reportsDir = join(pluginRoot, "evals", ".reports");

const argv = process.argv.slice(2);
const asJson = argv.includes("--json");
const requireJudge = argv.includes("--require-judge");
const listOnly = argv.includes("--list");
const filterIdx = argv.indexOf("--filter");
const filter = filterIdx >= 0 ? argv[filterIdx + 1] : undefined;
const surfaceIdx = argv.indexOf("--surface");
const surfaceFilter = surfaceIdx >= 0 ? argv[surfaceIdx + 1] : undefined;

const claudeBin = process.env.JSTACK_CLAUDE_BIN ?? "claude";
const apiKey = process.env.ANTHROPIC_API_KEY;

/**
 * There are two ways to reach a judge: a raw API key, or an already-authenticated `claude` CLI when
 * we are running inside Claude Code (`CLAUDE_CODE_ENTRYPOINT`). `askJudge` has always accepted the
 * second path, but `judgeAvailable` only ever accepted the first — so the CLI path was unreachable
 * and every judge-backed case skipped even with a working `claude` on PATH.
 *
 * Enabling it unconditionally is wrong too: `bun run check` inside Claude Code would silently fan
 * out into 20+ nested model calls at up to 120s each. So the CLI path is opt-in.
 */
const cliJudgeAllowed =
  process.env.JSTACK_ALLOW_CLI_JUDGE === "1" &&
  !!process.env.CLAUDE_CODE_ENTRYPOINT;
const judgeReachable = !!apiKey || cliJudgeAllowed;

type Status = "passed" | "failed" | "skipped";

interface CaseResult {
  id: string;
  surface: string;
  status: Status;
  asserts: AssertionResult[];
  judge?: { passed: boolean; message: string; protocolError?: string };
  reason?: string;
  elapsedMs: number;
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

/** Ask an independent judge agent. Returns null when no judge is available. */
function askJudge(prompt: string): Promise<string | null> {
  if (!judgeReachable) return Promise.resolve(null);
  return new Promise((resolve) => {
    const timeoutMs = Number(process.env.JSTACK_EVAL_TIMEOUT_MS ?? 120_000);
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(claudeBin, ["-p", prompt, "--output-format", "text"], {
        cwd: pluginRoot,
        env: { ...process.env, ANTHROPIC_API_KEY: apiKey ?? "" },
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      resolve(null);
      return;
    }
    let stdout = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      child.kill("SIGTERM");
      settled = true;
      resolve(null);
    }, timeoutMs);
    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      if (stdout.length < 8 * 1024 * 1024) stdout += chunk;
    });
    child.on("error", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(null);
    });
    child.on("close", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const text = stdout.trim();
      resolve(text === "" ? null : text);
    });
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
  const probe = spawnSync(claudeBin, ["--version"], {
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

async function runCase(c: CaseSpec): Promise<CaseResult> {
  const started = Date.now();
  const needsJudge = (c.criteria?.length ?? 0) > 0;

  if (needsJudge && !canJudge) {
    return {
      id: c.id,
      surface: c.surface,
      status: "skipped",
      asserts: [],
      reason:
        "no judge available (needs ANTHROPIC_API_KEY, or JSTACK_ALLOW_CLI_JUDGE=1 with an authenticated `claude` on PATH inside Claude Code)",
      elapsedMs: Date.now() - started,
    };
  }

  const out = await exerciseSubject(pluginRoot, c.subject, claudeBin, apiKey);
  const asserts = runDeterministicAsserts(c.expect, out);
  const factsHold = asserts.every((a) => a.passed);

  if (!factsHold) {
    return {
      id: c.id,
      surface: c.surface,
      status: "failed",
      asserts,
      reason: "deterministic assertion failed; judge not consulted",
      elapsedMs: Date.now() - started,
    };
  }

  if (!needsJudge) {
    return {
      id: c.id,
      surface: c.surface,
      status: "passed",
      asserts,
      elapsedMs: Date.now() - started,
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
      status: "failed",
      asserts,
      reason: "judge produced no reply after invocation",
      elapsedMs: Date.now() - started,
    };
  }
  const verdict = parseJudgeVerdict(reply);
  return {
    id: c.id,
    surface: c.surface,
    status: verdict.passed ? "passed" : "failed",
    asserts,
    judge: {
      passed: verdict.passed,
      message: verdict.message,
      protocolError: verdict.protocolError,
    },
    elapsedMs: Date.now() - started,
  };
}

const concurrency = Math.max(
  1,
  Number(process.env.JSTACK_EVAL_CONCURRENCY ?? 6),
);
const runResults: CaseResult[] = await runWithConcurrency(
  selected,
  concurrency,
  runCase,
);
// Invalid cases fail the gate too instead of being silently swallowed as console warnings --
// "fail closed," matching this file's own stated design goal.
const loadErrorResults: CaseResult[] = loadErrors.map((e) => ({
  id: `invalid:${e.sourceFile}`,
  surface: "load",
  status: "failed",
  asserts: [],
  reason: e.message,
  elapsedMs: 0,
}));
const results: CaseResult[] = [...runResults, ...loadErrorResults];

const passed = results.filter((r) => r.status === "passed").length;
const failed = results.filter((r) => r.status === "failed").length;
const skipped = results.filter((r) => r.status === "skipped").length;

mkdirSync(reportsDir, { recursive: true });
writeFileSync(
  join(reportsDir, "a2a-latest.json"),
  JSON.stringify(
    {
      total: results.length,
      passed,
      failed,
      skipped,
      judge_available: canJudge,
      results,
    },
    null,
    2,
  ) + "\n",
);

if (asJson) {
  console.log(
    JSON.stringify(
      {
        total: results.length,
        passed,
        failed,
        skipped,
        judge_available: canJudge,
        results,
      },
      null,
      2,
    ),
  );
} else {
  for (const r of results) {
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
    `\n${passed} passed, ${failed} failed, ${skipped} skipped (judge ${canJudge ? "available" : "unavailable"})`,
  );
  if (skipped > 0 && !requireJudge) {
    console.log(
      "Judge-backed cases were skipped. Use --require-judge to treat that as a failure.",
    );
  }
}

if (failed > 0) process.exit(1);
if (skipped > 0 && requireJudge) {
  console.error(
    `--require-judge was set but ${skipped} case(s) had no judge available.`,
  );
  process.exit(1);
}
process.exit(0);

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { tick } from "./tick.js";
import { runClaude } from "./slack.js";
import { expandHome } from "./store.js";
import { allSigils, findSigil, agentPrefixMatch } from "./guards.js";
import type { CrewConfig } from "./types.js";

/**
 * An offline eval of the crew's REAL output.
 *
 * The distinction that makes this worth having: the skill evals under `skills/crew/evals/`
 * grade Claude following the crew SKILL. This grades what the running agent actually says
 * when a message arrives -- the same poller, guards, router, worker and renderer, stopped at
 * the Slack boundary. Every case goes through `tick({ simulate })`, which forces dry_run
 * regardless of `mode` and writes no ledger rows, so a full run cannot post and cannot move
 * a watermark.
 *
 * Two kinds of check, deliberately:
 *
 *   DETERMINISTIC -- computed, not judged. These are the ones that cannot flatter the agent.
 *     The strongest is `citations_resolve`: every `path/to/file.ts:42` in the answer is
 *     resolved against the real workspace, and the line number is checked against the real
 *     line count. A fabricated citation fails arithmetically, with no model in the loop.
 *   RUBRIC -- an LLM judge for the parts that need reading comprehension ("did it actually
 *     name the guards in order"). Judged on a cheap model, and never the only evidence for
 *     a case.
 *
 * A case passes only if BOTH sides pass, because a fluent answer full of invented line
 * numbers is the failure mode most worth catching and a judge alone tends to wave it through.
 */

export interface CrewEvalCase {
  id: string;
  /** What lands in the DM, sigil included, exactly as a human would type it. */
  prompt: string;
  /** What the answer has to demonstrate. Graded by the judge. */
  criteria: string[];
  /** Case-specific substrings that must NOT appear (case-insensitive). */
  forbid?: string[];
  /** Why this case exists, printed in the report so a failure is interpretable. */
  rationale: string;
}

export interface CheckResult {
  name: string;
  kind: "deterministic" | "rubric";
  passed: boolean;
  detail: string;
}

export interface CrewEvalCaseResult {
  id: string;
  rationale: string;
  prompt: string;
  answer: string;
  handled: boolean;
  costUsd: number;
  ms: number;
  checks: CheckResult[];
  passed: boolean;
}

export interface CrewEvalReport {
  cases: CrewEvalCaseResult[];
  passed: number;
  failed: number;
  total: number;
  costUsd: number;
  judgeCostUsd: number;
  ms: number;
  /** True when every case passed every check. */
  ok: boolean;
}

/* ------------------------------------------------------- deterministic ---- */

/** A citation like `cli/src/lib/crew/tick.ts:42`, or the same without a line number. */
const CITATION_RE = /\b([\w./-]+\.(?:ts|tsx|js|json|md|py|yaml|yml|sh))(?::(\d+))?\b/g;

/**
 * Basename -> real paths, built once per workspace.
 *
 * Needed because a good answer abbreviates. Measured on a real run: the agent cited
 * `cli/src/lib/crew/types.ts:14-31` in full and then referred to `guards.ts:132` on later
 * lines, which is exactly how a person writes. An earlier version of this checker only tried
 * two fixed prefixes, called nine such references "invented", and failed the best answer in
 * the suite. A hallucination test that accuses correct work is worse than no test.
 */
const basenameCache = new Map<string, Map<string, string[]>>();

function basenameIndex(root: string): Map<string, string[]> {
  const cached = basenameCache.get(root);
  if (cached) return cached;
  const index = new Map<string, string[]>();
  const skip = new Set(["node_modules", ".git", "dist", "build", ".tmp", "coverage", ".next"]);
  const walk = (dir: string, depth: number): void => {
    if (depth > 8) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".") && e.name !== ".tmp") continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if (!skip.has(e.name)) walk(full, depth + 1);
      } else {
        const list = index.get(e.name);
        if (list) list.push(full);
        else index.set(e.name, [full]);
      }
    }
  };
  walk(root, 0);
  basenameCache.set(root, index);
  return index;
}

/**
 * Resolve every cited path against the workspace and check the line number is real.
 *
 * This is the objective hallucination test, and it is deliberately generous about WHERE a
 * file might be: the worker is told to cite `path/to/file.ts:42`, and a repo-relative path,
 * a workspace-relative path and a bare filename are all reasonable things for it to emit.
 * Only a path that resolves nowhere counts as invented, so a pass means the citation is
 * real, not merely plausibly formatted.
 */
export function checkCitations(answer: string, workspace: string): CheckResult {
  const root = expandHome(workspace);
  const bad: string[] = [];
  const good: string[] = [];
  const seen = new Set<string>();

  /**
   * Strip URLs before scanning. A link like `https://x.dev/a/b.md` otherwise matches from the
   * host onward and gets judged as a claim about a local file, which would fail a correct
   * answer for citing documentation. Checking `startsWith("http")` on the match cannot work,
   * because the match begins after the scheme.
   */
  const scannable = answer.replace(/https?:\/\/\S+/g, " ");

  for (const m of scannable.matchAll(CITATION_RE)) {
    const raw = m[1]!;
    const line = m[2] ? Number(m[2]) : null;
    const key = `${raw}:${line ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Skip things that are plainly not claims about this workspace.
    if (raw.startsWith("http") || raw.includes("example.")) continue;

    const candidates = isAbsolute(raw) ? [raw] : [join(root, raw), join(root, "cli", raw)];
    let hit = candidates.find((c) => existsSync(c));

    /**
     * Fall back to a basename lookup, and only for a bare filename. A cited PATH that does
     * not resolve stays a fabrication -- `cli/src/lib/nope.ts` must fail even if some
     * `nope.ts` exists elsewhere, or the check would stop detecting invented locations.
     * A bare `guards.ts` makes no claim about location, so resolving it by name is right.
     */
    if (!hit && !raw.includes("/")) {
      const found = basenameIndex(root).get(raw);
      if (found?.length) hit = found[0];
    }

    if (!hit) {
      bad.push(`${raw} (no such file)`);
      continue;
    }
    if (line !== null) {
      const lines = readFileSync(hit, "utf8").split("\n").length;
      if (line > lines) {
        bad.push(`${raw}:${line} (file has ${lines} lines)`);
        continue;
      }
    }
    good.push(key);
  }

  return {
    name: "citations_resolve",
    kind: "deterministic",
    passed: bad.length === 0,
    detail: bad.length
      ? `invented ${bad.length}: ${bad.slice(0, 4).join("; ")}`
      : good.length
        ? `all ${good.length} citation(s) resolve in the workspace`
        : "no citations to verify",
  };
}

/**
 * Phrases that claim an action the worker provably cannot perform. It runs with no MCP, no
 * network and no Bash (see runWorker), so any of these is a fabricated action -- the failure
 * mode measured earlier when a bad `--tools` flag left the model emitting a pretend tool call
 * and reporting success.
 */
const FALSE_ACTION_RE = [
  // `I`, optionally contracted or with an auxiliary, then the claimed act. The contraction
  // matters: "I've sent the message" is the natural phrasing and an earlier version of this
  // pattern required a literal "I " and missed it entirely.
  /\bI(?:'ve|'m|\s+have|\s+am|\s+just)?\s+(?:just\s+)?(?:posted|sent|messaged|reacted|replied\s+in)\b/i,
  /\bI(?:'ve|\s+have)?\s+(?:added|placed)\s+(?:a\s+|the\s+)?(?:reaction|emoji|checkmark)\b/i,
  /\bI(?:'ve|\s+have)?\s+ran\b(?![^.]*\bcould not\b)/i,
  /\bI\s+ran\b(?![^.]*\bcould not\b)/i,
  /\bI(?:'ve|\s+have)?\s+executed\b/i,
  /\bI(?:'ve|\s+have)?\s+queried\b/i,
];

export function checkNoFalseActions(answer: string): CheckResult {
  const hits = FALSE_ACTION_RE.filter((re) => re.test(answer)).map((re) => String(re));
  return {
    name: "no_false_action_claims",
    kind: "deterministic",
    passed: hits.length === 0,
    detail: hits.length ? `claims an action it cannot perform: ${hits[0]}` : "claims no action it cannot perform",
  };
}

/**
 * The rendered message must open with the agent's identity prefix.
 *
 * This is not cosmetic: G2a recognises our own output by exactly this, and it is the only
 * content guard still active inside a thread we own. A renderer regression here would
 * silently disarm the in-thread loop guard, so it is asserted on real output every run.
 */
export function checkIdentityPrefix(rendered: string, cfg: CrewConfig): CheckResult {
  const who = agentPrefixMatch(rendered, cfg.agents);
  return {
    name: "identity_prefix_present",
    kind: "deterministic",
    passed: who !== null,
    detail: who ? `opens with ${who}'s prefix, so G2a can recognise it` : "no identity prefix: G2a would not recognise this as ours",
  };
}

/**
 * A bare sigil in the answer, outside a quote or code fence, is a self-retrigger risk: on a
 * stale ledger G1 is blind, and G2a is what catches it. Verify the answer does not depend on
 * that safety net when it does not have to.
 */
export function checkNoLiveSigil(body: string, cfg: CrewConfig): CheckResult {
  const hit = findSigil(body, allSigils(cfg.agents));
  return {
    name: "no_unquoted_sigil",
    kind: "deterministic",
    passed: hit === null,
    detail: hit ? `emits an unquoted sigil (${hit}), which relies on G2a to not loop` : "no unquoted sigil",
  };
}

export function checkLength(rendered: string, cfg: CrewConfig): CheckResult {
  const max = cfg.policy.egress.max_message_chars;
  return {
    name: "within_char_budget",
    kind: "deterministic",
    passed: rendered.length <= max && rendered.trim().length > 40,
    detail: `${rendered.length} chars (cap ${max})`,
  };
}

export function checkForbidden(answer: string, forbid: string[] | undefined): CheckResult | null {
  if (!forbid?.length) return null;
  const lower = answer.toLowerCase();
  const hits = forbid.filter((f) => lower.includes(f.toLowerCase()));
  return {
    name: "case_forbidden_absent",
    kind: "deterministic",
    passed: hits.length === 0,
    detail: hits.length ? `contains forbidden: ${hits.join(", ")}` : `none of ${forbid.length} forbidden phrase(s)`,
  };
}

/* --------------------------------------------------------------- judge ---- */

function stripFence(s: string): string {
  const t = s.trim();
  if (t.includes("```json")) return t.split("```json")[1]?.split("```")[0]?.trim() ?? t;
  if (t.includes("```")) return t.split("```")[1]?.split("```")[0]?.trim() ?? t;
  return t;
}

/**
 * Grade the rubric criteria with a cheap model.
 *
 * Told to fail on weak evidence, because the useful signal is where the answer is thin, and
 * a judge left to its own devices grades fluency. Judge failure is reported as a failure
 * rather than skipped: a silently-skipped judge would turn a red run green.
 */
export async function judge(
  answer: string,
  criteria: string[],
  model: string,
): Promise<{ rows: CheckResult[]; costUsd: number }> {
  const list = criteria.map((c, i) => `${i + 1}. ${c}`).join("\n");
  const prompt =
    `You are grading one answer from a Slack agent against ${criteria.length} criteria. Be ` +
    `strict: FAIL a criterion unless the ANSWER clearly satisfies it with concrete evidence. ` +
    `Fluent but vague prose FAILS. Prefer a wrong FAIL over a generous PASS.\n\n` +
    `CRITERIA:\n${list}\n\nANSWER:\n${answer.slice(0, 12_000)}\n\n` +
    `Return a verdict for EVERY criterion, ${criteria.length} in total, numbered 1..${criteria.length}.\n` +
    `Output ONLY JSON: {"results":[{"n":1,"passed":true,"evidence":"quote"}]}`;

  /**
   * Retry until the judge covers every criterion.
   *
   * Measured: on a real run the judge returned verdicts for 1 of 3 criteria and the missing
   * two were recorded as failures, so a good answer was marked FAIL for a reason that had
   * nothing to do with the answer. A partial verdict is a judge fault and must not be
   * charged to the agent -- but it must not silently pass either, so it fails loudly with
   * `judge_incomplete` after the retries are exhausted.
   */
  let cost = 0;
  let lastDetail = "judge did not run";
  for (let attempt = 1; attempt <= 3; attempt++) {
    // No `--tools` flag here on purpose: it takes values, and a trailing one would swallow
    // the `--` that separates the prompt (runClaude appends `-- <prompt>`). Grading is text-only.
    const r = await runClaude(
      ["--model", model, "--setting-sources", "", "--permission-mode", "dontAsk"],
      prompt,
      120_000,
    );
    cost += r.costUsd;
    if (!r.ok) {
      lastDetail = "judge failed to run";
      continue;
    }
    let parsed: { results?: Array<{ n: number; passed: boolean; evidence?: string }> };
    try {
      parsed = JSON.parse(stripFence(r.text)) as typeof parsed;
    } catch {
      lastDetail = "judge JSON unparseable";
      continue;
    }
    const rows = parsed.results ?? [];
    const covered = criteria.every((_, i) => rows.some((x) => x.n === i + 1));
    if (!covered) {
      lastDetail = `judge returned ${rows.length}/${criteria.length} verdicts`;
      continue;
    }
    return {
      rows: criteria.map((c, i) => {
        const row = rows.find((x) => x.n === i + 1)!;
        return {
          name: c,
          kind: "rubric" as const,
          passed: row.passed === true,
          detail: (row.evidence ?? "no evidence given").slice(0, 220),
        };
      }),
      costUsd: cost,
    };
  }

  return {
    rows: criteria.map((c) => ({
      name: c,
      kind: "rubric" as const,
      passed: false,
      detail: `judge_incomplete after 3 attempts (${lastDetail}) -- this is a harness fault, not an agent failure`,
    })),
    costUsd: cost,
  };
}

/* ---------------------------------------------------------------- runner ---- */

export interface RunEvalOptions {
  config: CrewConfig;
  cases: CrewEvalCase[];
  /** Model for the judge. Cheap on purpose; the answer under test uses the agent's model. */
  judgeModel?: string;
  /** Skip the LLM judge and report deterministic checks only. Free and offline. */
  deterministicOnly?: boolean;
  log: (line: string) => void;
}

export async function runCrewEval(opts: RunEvalOptions): Promise<CrewEvalReport> {
  const { config, cases, log } = opts;
  const judgeModel = opts.judgeModel ?? "claude-haiku-4-5-20251001";
  const t0 = Date.now();
  const results: CrewEvalCaseResult[] = [];
  let judgeCost = 0;

  for (const [i, c] of cases.entries()) {
    log(`[${i + 1}/${cases.length}] ${c.id}`);
    const caseStart = Date.now();

    /**
     * The real pipeline, via simulate. This forces dry_run whatever `mode` says and writes
     * no ledger rows, which is what makes running the suite against a LIVE config safe.
     *
     * The tick's own log is CAPTURED, not discarded. Discarding it produced the worst kind of
     * eval result: a contended lock made every case return instantly for $0, and the report
     * showed seven agent failures for one infrastructure condition, with the one line that
     * explained it thrown away.
     */
    const tickLog: string[] = [];
    const s = await tick({ config, simulate: c.prompt, log: (l) => tickLog.push(l) });
    const reply = s.replies[0];

    /**
     * A global blocker is not a test result. If the crew could not run at all, say so once
     * and stop, rather than attributing it to the agent case by case.
     */
    const blocked = tickLog.find(
      (l) => l.includes("holds the lock") || l.includes("HALTED") || l.includes("enabled is false") || l.includes("AUTH LOST"),
    );
    if (blocked && !reply) {
      throw new Error(
        `crew could not run, so no case can be graded: ${blocked.trim()}\n` +
          `  (nothing was charged to the agent; fix the blocker and re-run)`,
      );
    }

    if (!reply) {
      const why = s.dropped[0]?.ruleId ?? tickLog.at(-1)?.trim() ?? "no reply produced";
      results.push({
        id: c.id,
        rationale: c.rationale,
        prompt: c.prompt,
        answer: "",
        handled: false,
        costUsd: s.costUsd,
        ms: Date.now() - caseStart,
        checks: [{ name: "produced_an_answer", kind: "deterministic", passed: false, detail: why }],
        passed: false,
      });
      log(`    FAIL — no answer (${why})`);
      continue;
    }

    const agent = config.agents[reply.agentId]!;
    const checks: CheckResult[] = [
      { name: "produced_an_answer", kind: "deterministic", passed: reply.ok, detail: reply.ok ? "worker succeeded" : "worker reported failure" },
      checkIdentityPrefix(reply.text, config),
      checkCitations(reply.body, agent.workspace),
      checkNoFalseActions(reply.body),
      checkNoLiveSigil(reply.body, config),
      checkLength(reply.text, config),
    ];
    const forbidden = checkForbidden(reply.body, c.forbid);
    if (forbidden) checks.push(forbidden);

    if (!opts.deterministicOnly) {
      const g = await judge(reply.body, c.criteria, judgeModel);
      judgeCost += g.costUsd;
      checks.push(...g.rows);
    }

    const passed = checks.every((x) => x.passed);
    results.push({
      id: c.id,
      rationale: c.rationale,
      prompt: c.prompt,
      answer: reply.body,
      handled: true,
      costUsd: reply.costUsd,
      ms: Date.now() - caseStart,
      checks,
      passed,
    });
    const failed = checks.filter((x) => !x.passed);
    log(`    ${passed ? "PASS" : `FAIL — ${failed.map((f) => f.name).join(", ")}`} ($${reply.costUsd.toFixed(3)}, ${Math.round((Date.now() - caseStart) / 1000)}s)`);
  }

  const passedN = results.filter((r) => r.passed).length;
  return {
    cases: results,
    passed: passedN,
    failed: results.length - passedN,
    total: results.length,
    costUsd: results.reduce((a, r) => a + r.costUsd, 0),
    judgeCostUsd: judgeCost,
    ms: Date.now() - t0,
    ok: passedN === results.length && results.length > 0,
  };
}

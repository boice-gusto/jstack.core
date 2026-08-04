import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface GateResult {
  skill: string;
  passed: boolean;
  failures: string[];
}

export interface GateRule {
  skill: string;
  max_tokens?: number;
  max_latency_ms?: number;
  required_output_fields?: string[];
  forbidden_patterns?: string[];
}

/**
 * Gate rule ids (`gate-evals.json`, `mergeGateRule`/`skillGateId`) are always in the
 * canonical `jstack:<path>` form. `--skill` is accepted bare (no prefix) everywhere
 * else in this CLI (structural, semantic), so a `gate --skill recon` call — the
 * natural thing to try given the rest of the CLI's convention — must normalize to
 * `jstack:recon` before rule lookup. Without this, `checkGates`'s `rules.find(r =>
 * r.skill === skill)` silently misses, `!rule` short-circuits to `passed: true`, and
 * the gate is bypassed for every case, indistinguishable from "no rule configured".
 */
export function normalizeGateSkillId(id: string): string {
  return id.startsWith("jstack:") ? id : `jstack:${id}`;
}

export function loadGateRules(pluginRoot: string): GateRule[] {
  const p = join(pluginRoot, "evals", "gate-evals.json");
  if (!existsSync(p)) return [];
  const j = JSON.parse(readFileSync(p, "utf8")) as { gates?: GateRule[] };
  return j.gates ?? [];
}

/** A metric value that can actually be range-checked (finite, non-negative). */
function isCheckableMetric(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

/**
 * Validate a completed invocation against gates (caller supplies metrics + output
 * snippet). Metrics normally come from a real execution, but `eval gate` re-checks
 * them from a persisted `*-semantic-*.json` report on disk — a file that, once
 * written, is just JSON an editor (or an attacker) can hand-modify. A rule that
 * declares `max_tokens`/`max_latency_ms` therefore fails closed: if the metric it
 * needs is missing, null, NaN, negative, or a non-numeric string, that counts as a
 * gate failure ("can't verify compliance") rather than being silently skipped.
 */
export function checkGates(
  rules: GateRule[],
  skill: string,
  metrics: { tokens?: number; latency_ms?: number },
  outputText: string,
): GateResult {
  const rule = rules.find((r) => r.skill === skill);
  if (!rule) return { skill, passed: true, failures: [] };
  const failures: string[] = [];
  if (rule.max_tokens != null) {
    if (!isCheckableMetric(metrics.tokens)) {
      failures.push(
        `tokens metric missing/invalid (${JSON.stringify(metrics.tokens)}) — cannot verify max_tokens ${rule.max_tokens}`,
      );
    } else if (metrics.tokens > rule.max_tokens) {
      failures.push(`tokens ${metrics.tokens} > ${rule.max_tokens}`);
    }
  }
  if (rule.max_latency_ms != null) {
    if (!isCheckableMetric(metrics.latency_ms)) {
      failures.push(
        `latency metric missing/invalid (${JSON.stringify(metrics.latency_ms)}) — cannot verify max_latency_ms ${rule.max_latency_ms}`,
      );
    } else if (metrics.latency_ms > rule.max_latency_ms) {
      failures.push(
        `latency ${metrics.latency_ms}ms > ${rule.max_latency_ms}ms`,
      );
    }
  }
  for (const f of rule.required_output_fields ?? []) {
    if (!outputText.includes(f)) failures.push(`missing field marker: ${f}`);
  }
  for (const pat of rule.forbidden_patterns ?? []) {
    if (outputText.includes(pat)) failures.push(`forbidden pattern: ${pat}`);
  }
  return { skill, passed: failures.length === 0, failures };
}

/** Minimal shape `evaluateSemanticSummaryGate` needs from a persisted semantic report. */
export interface GateableSummary {
  results: Array<{
    name: string;
    tokens?: unknown;
    elapsed?: unknown;
    response?: string;
  }>;
}

/**
 * Gate a persisted semantic summary. Pulled out of the `eval gate` CLI command so it
 * can be unit tested without going through the report file loader / CLI plumbing.
 *
 * An empty (or missing/malformed) `results` array must NOT read as a pass: the whole
 * point of `eval gate` is to judge a real invocation, and "zero cases ran" is not
 * evidence of anything passing. `runGate`'s old behavior — iterate `results`, treat
 * zero failures as `passed: true` — made a report with `results: []` gate-clean by
 * construction.
 */
export function evaluateSemanticSummaryGate(
  rules: GateRule[],
  skill: string,
  summary: GateableSummary | null | undefined,
): { passed: boolean; failures: string[]; casesChecked: number } {
  if (
    !summary ||
    !Array.isArray(summary.results) ||
    summary.results.length === 0
  ) {
    return {
      passed: false,
      failures: [
        "semantic report has zero results — nothing to gate, refusing to report a pass",
      ],
      casesChecked: 0,
    };
  }
  const failures: string[] = [];
  for (const r of summary.results) {
    const res = checkGates(
      rules,
      skill,
      {
        tokens: r.tokens as number | undefined,
        latency_ms:
          typeof r.elapsed === "number"
            ? Math.round(r.elapsed * 1000)
            : (r.elapsed as number | undefined),
      },
      r.response ?? "",
    );
    if (!res.passed) failures.push(`${r.name}: ${res.failures.join("; ")}`);
  }
  return {
    passed: failures.length === 0,
    failures,
    casesChecked: summary.results.length,
  };
}

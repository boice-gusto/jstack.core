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

export function loadGateRules(pluginRoot: string): GateRule[] {
  const p = join(pluginRoot, "evals", "gate-evals.json");
  if (!existsSync(p)) return [];
  const j = JSON.parse(readFileSync(p, "utf8")) as { gates?: GateRule[] };
  return j.gates ?? [];
}

/** Validate a completed invocation against gates (caller supplies metrics + output snippet). */
export function checkGates(
  rules: GateRule[],
  skill: string,
  metrics: { tokens?: number; latency_ms?: number },
  outputText: string,
): GateResult {
  const rule = rules.find((r) => r.skill === skill);
  if (!rule) return { skill, passed: true, failures: [] };
  const failures: string[] = [];
  if (rule.max_tokens != null && metrics.tokens != null && metrics.tokens > rule.max_tokens) {
    failures.push(`tokens ${metrics.tokens} > ${rule.max_tokens}`);
  }
  if (rule.max_latency_ms != null && metrics.latency_ms != null && metrics.latency_ms > rule.max_latency_ms) {
    failures.push(`latency ${metrics.latency_ms}ms > ${rule.max_latency_ms}ms`);
  }
  for (const f of rule.required_output_fields ?? []) {
    if (!outputText.includes(f)) failures.push(`missing field marker: ${f}`);
  }
  for (const pat of rule.forbidden_patterns ?? []) {
    if (outputText.includes(pat)) failures.push(`forbidden pattern: ${pat}`);
  }
  return { skill, passed: failures.length === 0, failures };
}

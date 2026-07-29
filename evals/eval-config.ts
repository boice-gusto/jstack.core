/**
 * Shared types and runtime config for semantic skill evals.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { JSTACK_CONFIG_FILE } from "../constants/paths.js";
import type { GateRule } from "./gate-runner.js";

export interface EvalFileSpec {
  path: string;
  content?: string;
}

/** Programmatic post-checks on model output (merged with LLM judge in grade.ts). */
export interface EvalAssert {
  /** Every string must appear as a substring of the response. */
  response_contains?: string[];
  /** At least one string must appear. */
  response_contains_any?: string[];
  /** None of these substrings may appear (e.g. `<script`). */
  response_not_contains?: string[];
  /** Minimum character length of the full response. */
  response_min_length?: number;
  /** Every pattern (JavaScript regex) must match the full response (partial match). Invalid regex in YAML is skipped at runtime with a failed assert row. */
  response_match_regex?: string[];
}

export interface ExpectationResult {
  text: string;
  passed: boolean;
  evidence: string;
}

export interface GradingSummary {
  passed: number;
  failed: number;
  total: number;
  pass_rate: number;
}

export interface GradingResult {
  expectations: ExpectationResult[];
  summary: GradingSummary;
}

export interface EvalCase {
  name: string;
  prompt: string;
  criteria: string[];
  files: EvalFileSpec[];
  expect_skill: boolean;
  timeout: number;
  case_pass_threshold?: number;
  /** Use a stricter Claude CLI grader prompt (second pass still Claude `-p`). */
  strict_grader?: boolean;
  /** Optional hard checks after generation; combined with JSON grader output. */
  assert?: EvalAssert;
  _source: string;
}

export interface SkillEvalConfigFile {
  pass_threshold?: number;
  timeout?: number;
  gate?: Partial<GateRule>;
}

export interface GlobalEvalEnv {
  pluginRoot: string;
  passThreshold: number;
  defaultTimeout: number;
  maxRetries: number;
  retryDelaySec: number;
  claudeBin: string;
  anthropicApiKey?: string;
  /** Passed to Claude subprocess as `JSTACK_MCP_SCENARIO` when set (env wins over config file). */
  mcpScenario?: string;
  workspaceDir: string;
}

/**
 * Parse a numeric override from an environment variable. Unset, empty, or
 * whitespace-only values fall back to `fallback` rather than becoming `0` —
 * `Number("")` and `Number("   ")` are both `0` in JS, so without this normalization
 * an accidentally-blank env var (e.g. an empty CI template variable) would silently
 * become "the strictest/loosest possible value" instead of "use the default". A
 * value that parses to a non-finite number (`NaN`, `Infinity`, a non-numeric string)
 * also falls back, since a `NaN` threshold makes every `>=`/`>` comparison against it
 * evaluate to `false` — a silent, surprising way to disable a gate.
 */
export function numberFromEnv(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const trimmed = raw.trim();
  if (trimmed === "") return fallback;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Guard against an `eval-config.yaml` `pass_threshold` of 0 or negative. `pass_rate`
 * is always >= 0, so `pass_rate >= 0` (or `>= -5`) is unconditionally true: the
 * skill's semantic evals could never fail no matter how badly it's graded, while
 * still looking "covered" for the eval-coverage gate. Falls back to `fallback` for
 * any non-finite or non-positive value; otherwise passes `raw` through unchanged.
 */
export function sanitizePassThreshold(raw: number | undefined, fallback: number): number {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return fallback;
  return raw;
}

export function skillGateId(relPath: string): string {
  const slug = relPath.split("/").filter(Boolean).join("/");
  return `jstack:${slug}`;
}

function readOptionalDebugMockScenario(pluginRoot: string): string | undefined {
  try {
    const p = join(pluginRoot, JSTACK_CONFIG_FILE);
    if (!existsSync(p)) return undefined;
    const raw = JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>;
    const dbg = raw.debug as Record<string, unknown> | undefined;
    const s = dbg?.mock_mcp_scenario;
    if (typeof s === "string" && s.trim().length > 0) return s.trim();
  } catch {
    return undefined;
  }
  return undefined;
}

export function loadGlobalEvalEnv(pluginRoot: string): GlobalEvalEnv {
  const passThreshold = numberFromEnv(
    process.env.JSTACK_EVAL_PASS_THRESHOLD ?? process.env.PASS_THRESHOLD,
    80,
  );
  const defaultTimeout = numberFromEnv(
    process.env.JSTACK_EVAL_TIMEOUT ?? process.env.EVAL_TIMEOUT,
    120,
  );
  const maxRetries = numberFromEnv(
    process.env.JSTACK_EVAL_MAX_RETRIES ?? process.env.MAX_RETRIES,
    3,
  );
  const retryDelaySec = numberFromEnv(
    process.env.JSTACK_EVAL_RETRY_DELAY ?? process.env.RETRY_DELAY,
    10,
  );
  const claudeBin = process.env.JSTACK_EVAL_CLAUDE_BIN ?? "claude";
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const workspaceDir = process.env.JSTACK_EVAL_WORKSPACE ?? `${pluginRoot}/evals/.workspace`;

  const fromEnv = process.env.JSTACK_MCP_SCENARIO?.trim();
  const fromCfg = readOptionalDebugMockScenario(pluginRoot);
  const mcpScenario =
    fromEnv !== undefined && fromEnv.length > 0 ? fromEnv : fromCfg;

  return {
    pluginRoot,
    passThreshold,
    defaultTimeout,
    maxRetries,
    retryDelaySec,
    claudeBin,
    anthropicApiKey,
    mcpScenario,
    workspaceDir,
  };
}

export function mergeGateRule(
  base: GateRule | undefined,
  override: Partial<GateRule> | undefined,
  skillId: string,
): GateRule | undefined {
  if (!base && !override) return undefined;
  const o = override ?? {};
  const b = base ?? { skill: skillId };
  return {
    skill: skillId,
    max_tokens: o.max_tokens ?? b.max_tokens,
    max_latency_ms: o.max_latency_ms ?? b.max_latency_ms,
    required_output_fields: o.required_output_fields ?? b.required_output_fields,
    forbidden_patterns: o.forbidden_patterns ?? b.forbidden_patterns,
  };
}

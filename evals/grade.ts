import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import type { EvalCase, ExpectationResult, GradingResult } from "./eval-config.js";
import type { GlobalEvalEnv } from "./eval-config.js";
import type { ExecuteResult } from "./execute.js";
import { runResponseAsserts } from "./assert.js";

export type { ExpectationResult, GradingResult } from "./eval-config.js";

function sleepSync(ms: number) {
  const end = Date.now() + ms;
  while (Date.now() < end) {}
}

function stripJsonFence(output: string): string {
  let o = output.trim();
  if (o.includes("```json")) {
    o = o.split("```json")[1]?.split("```")[0]?.trim() ?? o;
  } else if (o.includes("```")) {
    o = o.split("```")[1]?.split("```")[0]?.trim() ?? o;
  }
  return o;
}

function runGrader(env: GlobalEvalEnv, graderPrompt: string): { ok: boolean; text: string } {
  for (let attempt = 1; attempt <= env.maxRetries; attempt++) {
    const r = spawnSync(env.claudeBin, ["-p", graderPrompt, "--output-format", "text"], {
      cwd: env.pluginRoot,
      env: { ...process.env, ANTHROPIC_API_KEY: env.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY ?? "" },
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
      timeout: 120_000,
    });
    const text = (r.stdout ?? "").trim();
    if (text && !r.error) return { ok: true, text };
    if (attempt < env.maxRetries) sleepSync(env.retryDelaySec * 1000 * attempt);
  }
  return { ok: false, text: "" };
}

export function gradeCase(
  env: GlobalEvalEnv,
  caseDef: EvalCase,
  execResult: ExecuteResult,
  caseDir: string,
): GradingResult {
  const criteria = caseDef.criteria;
  const criteriaText = criteria.map((c, i) => `  ${i + 1}. ${c}`).join("\n");
  let response = execResult.response || "(No response captured)";
  if (response.length > 10_000) {
    response = response.slice(0, 10_000) + "\n\n... (truncated at 10KB) ...";
  }

  const strict =
    caseDef.strict_grader === true ||
    process.env.JSTACK_EVAL_STRICT_GRADER === "1" ||
    process.env.JSTACK_EVAL_STRICT_GRADER === "true";
  const strictBlock = strict ?
      `
STRICT MODE: Fail the criterion unless the response clearly satisfies it with concrete evidence from the RESPONSE text.
Vague compliance, hedging without substance, or "mostly right" = FAIL. Prefer false positives on FAIL over false passes.
`
    : "";

  const graderPrompt = `You are an eval grader. Grade this skill response against criteria. Be strict - FAIL if evidence is weak or superficial.
${strictBlock}
CRITERIA:
${criteriaText}

RESPONSE:
${response}

Output ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "expectations": [
    {"text": "criterion text", "passed": true, "evidence": "specific quote or description"}
  ],
  "summary": {"passed": N, "failed": N, "total": N, "pass_rate": 0.0}
}`;

  const { ok, text } = runGrader(env, graderPrompt);
  if (!ok) {
    const fallback: GradingResult = {
      expectations: criteria.map((c) => ({
        text: c,
        passed: false,
        evidence: "Grading failed after retries",
      })),
      summary: { passed: 0, failed: criteria.length, total: criteria.length, pass_rate: 0 },
    };
    const merged = mergeAssertsIntoGrading(caseDef, execResult, fallback);
    writeFileSync(join(caseDir, "grading.json"), JSON.stringify(merged, null, 2) + "\n");
    return merged;
  }

  try {
    const parsed = JSON.parse(stripJsonFence(text)) as GradingResult;
    const merged = mergeAssertsIntoGrading(caseDef, execResult, parsed);
    writeFileSync(join(caseDir, "grading.json"), JSON.stringify(merged, null, 2) + "\n");
    return merged;
  } catch {
    const fallback: GradingResult = {
      expectations: criteria.map((c) => ({
        text: c,
        passed: false,
        evidence: "Grading JSON parse failed",
      })),
      summary: { passed: 0, failed: criteria.length, total: criteria.length, pass_rate: 0 },
    };
    const merged = mergeAssertsIntoGrading(caseDef, execResult, fallback);
    writeFileSync(join(caseDir, "grading.json"), JSON.stringify(merged, null, 2) + "\n");
    return merged;
  }
}

function summarizeExpectations(rows: ExpectationResult[]): GradingResult["summary"] {
  const total = rows.length;
  const passed = rows.filter((x) => x.passed).length;
  const failed = total - passed;
  return { passed, failed, total, pass_rate: total > 0 ? passed / total : 0 };
}

/**
 * Merges programmatic asserts with LLM grader JSON: assertions are appended to expectations
 * and summary is recomputed across **all** rows (criteria + assert lines).
 */
export function mergeAssertsIntoGrading(
  caseDef: EvalCase,
  execResult: ExecuteResult,
  grader: GradingResult,
): GradingResult {
  const assertRows = runResponseAsserts(execResult.response || "", caseDef.assert);
  if (assertRows.length === 0) return grader;
  const combined = [...grader.expectations, ...assertRows];
  return {
    expectations: combined,
    summary: summarizeExpectations(combined),
  };
}

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { patchEvalViewerTemplate } from "../constants/jstackMarkSvg.js";
import type { GradingResult } from "./grade.js";
import type { ExecuteResult } from "./execute.js";
import type { EvalCase } from "./eval-config.js";

export interface CaseReport {
  name: string;
  status: string;
  elapsed: number;
  tokens: number;
  criteria_passed: number;
  criteria_total: number;
  gate_failures?: string[];
}

export interface SemanticSummary {
  skill_name: string;
  timestamp: string;
  total_cases: number;
  total_passed: number;
  total_criteria: number;
  pass_rate: number;
  total_time: number;
  total_tokens: number;
  total_cost_usd: number;
  results: CaseReport[];
}

export function buildSemanticSummary(
  skillName: string,
  cases: EvalCase[],
  execResults: ExecuteResult[],
  gradings: GradingResult[],
  gateFailuresPerCase: string[][],
): SemanticSummary {
  let totalPassed = 0;
  let totalCriteria = 0;
  let totalTime = 0;
  let totalTokens = 0;
  let totalCost = 0;
  const results: CaseReport[] = [];

  for (let i = 0; i < cases.length; i++) {
    const gr = gradings[i];
    const er = execResults[i];
    const s = gr?.summary ?? { passed: 0, total: 0 };
    totalPassed += s.passed ?? 0;
    totalCriteria += s.total ?? 0;
    totalTime += er?.elapsed ?? 0;
    totalTokens += er?.tokens ?? 0;
    totalCost += er?.cost_usd ?? 0;
    const gf = gateFailuresPerCase[i] ?? [];
    results.push({
      name: cases[i].name,
      status: er.status,
      elapsed: er.elapsed,
      tokens: er.tokens,
      criteria_passed: s.passed ?? 0,
      criteria_total: s.total ?? 0,
      gate_failures: gf.length ? gf : undefined,
    });
  }

  const passRate = totalCriteria > 0 ? (totalPassed / totalCriteria) * 100 : 0;

  return {
    skill_name: skillName,
    timestamp: new Date().toISOString(),
    total_cases: cases.length,
    total_passed: totalPassed,
    total_criteria: totalCriteria,
    pass_rate: Math.round(passRate * 10) / 10,
    total_time: Math.round(totalTime * 10) / 10,
    total_tokens: totalTokens,
    total_cost_usd: Math.round(totalCost * 10_000) / 10_000,
    results,
  };
}

export function printSkillTable(summary: SemanticSummary, passThreshold: number): void {
  const ok = summary.pass_rate >= passThreshold;
  console.log("\n" + "=".repeat(72));
  console.log(
    `Skill: ${summary.skill_name} | Pass rate: ${summary.total_passed}/${summary.total_criteria} (${summary.pass_rate}%) | threshold ${passThreshold}% ${ok ? "OK" : "BELOW"}`,
  );
  console.log("=".repeat(72));
  summary.results.forEach((r, i) => {
    const criteriaOk = r.criteria_passed === r.criteria_total && r.status === "completed";
    const gateOk = !r.gate_failures?.length;
    const pass = criteriaOk && gateOk;
    console.log(
      `  ${i + 1}. [${pass ? "PASS" : "FAIL"}] ${r.name} — ${r.criteria_passed}/${r.criteria_total} criteria (${r.elapsed}s, ${r.tokens} tokens)${r.gate_failures?.length ? ` | gates: ${r.gate_failures.join("; ")}` : ""}`,
    );
  });
  console.log(`\nTotal: ${summary.total_time}s | ${summary.total_tokens} tokens | ~$${summary.total_cost_usd}\n`);
}

export function writeSemanticReportFiles(
  outDir: string,
  skillSlug: string,
  summary: SemanticSummary,
  pluginRoot: string,
): { summaryPath: string; nextStepsPath: string; viewerPath?: string } {
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const summaryPath = join(outDir, `${skillSlug}-semantic-${stamp}.json`);
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + "\n");

  const nextStepsPath = join(outDir, `${skillSlug}-NEXT_STEPS.md`);
  const lines: string[] = [
    `# Eval next steps: ${summary.skill_name}`,
    "",
    `- Generated: ${summary.timestamp}`,
    `- Pass rate: **${summary.pass_rate}%** (${summary.total_passed}/${summary.total_criteria} criteria)`,
    "",
    "## Case results",
    "",
    ...summary.results.map(
      (r) =>
        `- **${r.name}**: ${r.status} — ${r.criteria_passed}/${r.criteria_total} criteria${r.gate_failures?.length ? `; gate failures: ${r.gate_failures.join(", ")}` : ""}`,
    ),
    "",
    "## What to do next",
    "",
    "1. Open per-case artifacts under `evals/.workspace/<skill>/<case-slug>/` (response.md, grading.json).",
    "2. Tighten SKILL.md directives or relax brittle criteria in the YAML eval.",
    "3. Re-run: `bun run eval semantic --skill <id> --threshold <n>`.",
    "",
  ];
  writeFileSync(nextStepsPath, lines.join("\n"));

  let viewerPath: string | undefined;
  const tpl = join(pluginRoot, "evals", "viewer.html");
  if (existsSync(tpl)) {
    const template = patchEvalViewerTemplate(readFileSync(tpl, "utf8"));
    const data = {
      skill_name: summary.skill_name,
      summary,
    };
    const dataJson = JSON.stringify(data);
    const html =
      template.includes("/*__EMBEDDED_DATA__*/") ?
        template.replace("/*__EMBEDDED_DATA__*/", `const EMBEDDED_DATA = ${dataJson};`)
      : template.replace("</head>", `<script>const EMBEDDED_DATA = ${dataJson};</script>\n</head>`);
    viewerPath = join(outDir, `${skillSlug}-viewer-${stamp}.html`);
    writeFileSync(viewerPath, html);
  }

  return { summaryPath, nextStepsPath, viewerPath };
}

export interface MultiSkillReport {
  generated_at: string;
  skills: { skill: string; summary: SemanticSummary; passed_threshold: boolean }[];
  overall_pass_rate: number;
  skills_below_threshold: string[];
}

export function writeMultiReport(outDir: string, parts: MultiSkillReport["skills"], threshold: number): string {
  mkdirSync(outDir, { recursive: true });
  let totalPassed = 0;
  let totalCrit = 0;
  const below: string[] = [];
  for (const p of parts) {
    totalPassed += p.summary.total_passed;
    totalCrit += p.summary.total_criteria;
    if (!p.passed_threshold) below.push(p.skill);
  }
  const overall = totalCrit > 0 ? Math.round((totalPassed / totalCrit) * 1000) / 10 : 0;
  const report: MultiSkillReport = {
    generated_at: new Date().toISOString(),
    skills: parts,
    overall_pass_rate: overall,
    skills_below_threshold: below,
  };
  const path = join(outDir, `semantic-multi-${report.generated_at.replace(/[:.]/g, "-")}.json`);
  writeFileSync(path, JSON.stringify(report, null, 2) + "\n");

  const mdPath = join(outDir, "REPORT_LATEST.md");
  const md = [
    "# jstack semantic eval report",
    "",
    `- **Overall criteria pass rate:** ${overall}% (${totalPassed}/${totalCrit})`,
    `- **Threshold:** ${threshold}%`,
    `- **Skills below threshold:** ${below.length ? below.join(", ") : "none"}`,
    "",
    "## Per skill",
    "",
    ...parts.map(
      (p) =>
        `### ${p.skill}\n\n- Pass rate: ${p.summary.pass_rate}% (${p.summary.total_passed}/${p.summary.total_criteria})\n- Meets threshold: ${p.passed_threshold ? "yes" : "no"}\n`,
    ),
    "",
    "## Next steps",
    "",
    "1. Run `bun run eval coverage` to see which skills still need YAML evals.",
    "2. Run `bun run eval validate` to lint all eval YAML without calling the API.",
    "3. For one skill: `bun run eval semantic --skill recon --viewer` (requires `ANTHROPIC_API_KEY` and \`claude\` on PATH).",
    "",
  ].join("\n");
  writeFileSync(mdPath, md);
  return path;
}

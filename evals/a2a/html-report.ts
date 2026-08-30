#!/usr/bin/env bun
/**
 * Renders a single self-contained HTML slide deck from whatever is under `.tmp/a2a/`:
 * per-model reports (`<model>/latest.json`, written by run.ts) and the cross-model retro
 * (`compare-report.json`, written by compare.ts). Pulls the original case's own task/criteria
 * back in from `evals/a2a/cases/*.yaml` so each example slide shows the actual input alongside
 * the actual output, not just a pass/fail dot.
 *
 * Local-only by design: this can contain full agent persona / skill file contents and raw model
 * transcripts, so it's written under the gitignored `.tmp/a2a/` scratch tree and never uploaded
 * anywhere. Open it with `open .tmp/a2a/report.html`.
 *
 * Usage:
 *   bun run eval:report
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { validateCaseSpec, type CaseSpec } from "./case-spec.js";
import type { Category, StoredCaseResult } from "./compare-lib.js";

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = join(here, "..", "..");
const casesDir = join(here, "cases");
const tmpRoot = join(pluginRoot, ".tmp", "a2a");
const outPath = join(tmpRoot, "report.html");

interface StoredModelReport {
  model: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  judge_available: boolean;
  results: (StoredCaseResult & {
    asserts?: { label: string; passed: boolean; detail: string }[];
  })[];
}

interface CompareReport {
  models_compared: string[];
  generated_at: string;
  total_cases: number;
  counts: Record<Category, number>;
  rows: {
    id: string;
    surface: string;
    category: Category;
    by_model: Record<
      string,
      { status: string; reason?: string; judge_message?: string }
    >;
    output_similarity?: Record<string, number>;
  }[];
}

function loadCaseIndex(): Map<string, CaseSpec> {
  const index = new Map<string, CaseSpec>();
  if (!existsSync(casesDir)) return index;
  for (const f of readdirSync(casesDir).sort()) {
    if (!f.endsWith(".yaml") && !f.endsWith(".yml")) continue;
    const parsed = yaml.load(readFileSync(join(casesDir, f), "utf8"));
    const list = Array.isArray(parsed) ? parsed : [parsed];
    for (const c of list) {
      const validated = validateCaseSpec(c, f);
      if (validated.ok) index.set(validated.case.id, validated.case);
    }
  }
  return index;
}

function loadModelReports(): Map<string, StoredModelReport> {
  const reports = new Map<string, StoredModelReport>();
  if (!existsSync(tmpRoot)) return reports;
  for (const entry of readdirSync(tmpRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const p = join(tmpRoot, entry.name, "latest.json");
    if (!existsSync(p)) continue;
    reports.set(entry.name, JSON.parse(readFileSync(p, "utf8")));
  }
  return reports;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const caseIndex = loadCaseIndex();
const modelReports = loadModelReports();
const compareReportPath = join(tmpRoot, "compare-report.json");
if (!existsSync(compareReportPath)) {
  console.error(
    "No .tmp/a2a/compare-report.json found. Run 'bun run eval:compare' first (after a regression-test run).",
  );
  process.exit(2);
}
const compareReport: CompareReport = JSON.parse(
  readFileSync(compareReportPath, "utf8"),
);

const models = compareReport.models_compared;

/** Full (untruncated by the 4000-char snippet cap notwithstanding) per-model detail for one
 * case, joined back from the raw model reports rather than compare-report.json alone, so the
 * slide can show asserts too (compare-report.json intentionally drops them -- it's a summary). */
function detailFor(caseId: string, model: string) {
  const report = modelReports.get(model);
  return report?.results.find((r) => r.id === caseId);
}

const CATEGORY_ORDER: Category[] = [
  "difference_detected",
  "wrong",
  "accepted",
  "right",
  "needs_review",
];
const CATEGORY_LABEL: Record<Category, string> = {
  difference_detected: "Difference Detected",
  wrong: "Wrong (fails on every model)",
  accepted: "Accepted (passes on every model)",
  right: "Right (single-model pass)",
  needs_review: "Needs Review (incomplete)",
};
const CATEGORY_BLURB: Record<Category, string> = {
  difference_detected:
    "Models disagree on the same task -- one passed, one failed. This is the core cross-model consistency signal.",
  wrong:
    "Every model tested failed this case. A reproducible bug, not a model quirk.",
  accepted:
    "Every model tested passed this case with the same independent judge.",
  right: "Only one model was run for this case; it passed.",
  needs_review:
    "A judge was unreachable for at least one model, so the row is incomplete.",
};

const MAX_EXAMPLES_PER_CATEGORY = 4;

function renderOutputBlock(
  model: string,
  d: ReturnType<typeof detailFor>,
): string {
  if (!d)
    return `<div class="model-col"><h4>${esc(model)}</h4><p class="muted">no data</p></div>`;
  const statusClass = d.status;
  const asserts = d.asserts ?? [];
  const failedAsserts = asserts.filter((a) => !a.passed);
  return `
    <div class="model-col">
      <h4>${esc(model)} <span class="pill ${statusClass}">${esc(d.status)}</span></h4>
      ${d.reason ? `<p class="reason">${esc(d.reason)}</p>` : ""}
      ${
        d.judge?.message
          ? `<p class="judge-msg"><strong>Judge:</strong> ${esc(d.judge.message)}</p>`
          : ""
      }
      ${
        failedAsserts.length > 0
          ? `<ul class="asserts">${failedAsserts
              .map(
                (a) =>
                  `<li class="assert-fail">✗ ${esc(a.label)} — ${esc(a.detail)}</li>`,
              )
              .join("")}</ul>`
          : ""
      }
      ${
        d.output
          ? `<pre class="output">${esc(d.output.slice(0, 1200))}${d.output.length > 1200 ? "\n…[truncated for slide]" : ""}</pre>`
          : `<p class="muted">(no candidate output recorded -- deterministic subject)</p>`
      }
    </div>`;
}

function renderExampleSlide(row: CompareReport["rows"][number]): string {
  const spec = caseIndex.get(row.id);
  const details = models.map((m) => detailFor(row.id, m));
  const similarityLine = row.output_similarity
    ? `<p class="similarity">Output word-overlap: ${Object.entries(
        row.output_similarity,
      )
        .map(([pair, v]) => `${esc(pair)} = ${(v * 100).toFixed(0)}%`)
        .join(", ")}</p>`
    : "";
  return `
  <section class="slide example">
    <div class="slide-kicker">${esc(CATEGORY_LABEL[row.category])}</div>
    <h2>${esc(row.id)}</h2>
    <p class="surface-tag">surface: ${esc(row.surface)}</p>
    <div class="input-block">
      <h4>Input</h4>
      <p>${esc(spec?.description ?? "(case description unavailable)")}</p>
      ${spec?.subject.task ? `<pre class="task">${esc(spec.subject.task)}</pre>` : ""}
      ${
        spec?.criteria?.length
          ? `<p><strong>Judged against:</strong></p><ul>${spec.criteria
              .map((c) => `<li>${esc(c)}</li>`)
              .join("")}</ul>`
          : ""
      }
    </div>
    <div class="model-grid">
      ${details.map((d, i) => renderOutputBlock(models[i] as string, d)).join("")}
    </div>
    ${similarityLine}
  </section>`;
}

const totalCases = compareReport.total_cases;
const categoryStats = CATEGORY_ORDER.map((c) => ({
  cat: c,
  count: compareReport.counts[c] ?? 0,
}));

const titleSlide = `
  <section class="slide title">
    <h1>jstack.core — Cross-Model Eval Report</h1>
    <p class="subtitle">Models compared: ${models.map(esc).join(" vs ")}</p>
    <p class="subtitle">${totalCases} case(s) &middot; generated ${esc(compareReport.generated_at)}</p>
    <div class="stat-row">
      ${categoryStats
        .map(
          (s) =>
            `<div class="stat"><div class="stat-num">${s.count}</div><div class="stat-label">${esc(CATEGORY_LABEL[s.cat])}</div></div>`,
        )
        .join("")}
    </div>
    <p class="nav-hint">Use → / ← or the buttons below to navigate.</p>
  </section>`;

const categorySlides = CATEGORY_ORDER.flatMap((cat) => {
  const rowsInCat = compareReport.rows.filter((r) => r.category === cat);
  if (rowsInCat.length === 0) return [];
  const intro = `
  <section class="slide category-intro cat-${cat}">
    <h2>${esc(CATEGORY_LABEL[cat])}</h2>
    <p class="count-badge">${rowsInCat.length} case(s)</p>
    <p>${esc(CATEGORY_BLURB[cat])}</p>
    <ul class="case-list">
      ${rowsInCat
        .slice(0, 20)
        .map(
          (r) =>
            `<li>${esc(r.id)} <span class="muted">(${esc(r.surface)})</span></li>`,
        )
        .join("")}
      ${rowsInCat.length > 20 ? `<li class="muted">…and ${rowsInCat.length - 20} more (see .tmp/a2a/compare-report.json)</li>` : ""}
    </ul>
  </section>`;
  // Prefer judge-backed (agentic) rows for the deep-dive examples -- they carry the richest
  // input/output/judge data. Rows with recorded output win over pure pass/fail rows.
  const examples = [...rowsInCat]
    .sort((a, b) => {
      const aRich = models.some((m) => !!detailFor(a.id, m)?.output) ? 1 : 0;
      const bRich = models.some((m) => !!detailFor(b.id, m)?.output) ? 1 : 0;
      return bRich - aRich;
    })
    .slice(0, MAX_EXAMPLES_PER_CATEGORY)
    .map(renderExampleSlide);
  return [intro, ...examples];
});

const appendixRows = compareReport.rows
  .map(
    (r) => `
      <tr class="cat-row cat-${r.category}">
        <td>${esc(r.id)}</td>
        <td>${esc(r.surface)}</td>
        <td>${esc(r.category)}</td>
        <td>${models
          .map((m) => `${esc(m)}=${esc(r.by_model[m]?.status ?? "n/a")}`)
          .join(" | ")}</td>
      </tr>`,
  )
  .join("");

const appendixSlide = `
  <section class="slide appendix">
    <h2>Full Data (all ${compareReport.total_cases} cases)</h2>
    <input id="filter-input" type="text" placeholder="Filter by id, surface, or category…" />
    <table id="data-table">
      <thead><tr><th>Case ID</th><th>Surface</th><th>Category</th><th>Per-model status</th></tr></thead>
      <tbody>${appendixRows}</tbody>
    </table>
  </section>`;

const allSlides = [titleSlide, ...categorySlides, appendixSlide];

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>jstack.core — Cross-Model Eval Report</title>
<style>
  :root {
    --bg: #0f1115; --panel: #171a21; --border: #2a2e38; --text: #e7e9ee; --muted: #8b93a3;
    --accent: #6ea8fe; --pass: #3fb950; --fail: #f85149; --skip: #d29922;
  }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: var(--bg); color: var(--text); }
  .deck { max-width: 980px; margin: 0 auto; padding: 24px; }
  .slide { display: none; background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 40px; min-height: 60vh; }
  .slide.active { display: block; }
  h1 { font-size: 32px; margin-bottom: 8px; }
  h2 { font-size: 26px; margin-top: 0; }
  h4 { margin: 12px 0 4px; }
  .subtitle { color: var(--muted); margin: 4px 0; }
  .stat-row { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 32px; }
  .stat { background: var(--bg); border: 1px solid var(--border); border-radius: 10px; padding: 16px 20px; min-width: 140px; }
  .stat-num { font-size: 30px; font-weight: 700; color: var(--accent); }
  .stat-label { color: var(--muted); font-size: 13px; margin-top: 4px; }
  .nav-hint { margin-top: 40px; color: var(--muted); font-size: 13px; }
  .slide-kicker { color: var(--accent); font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; }
  .surface-tag { color: var(--muted); font-size: 13px; margin-top: -8px; }
  .count-badge { display: inline-block; background: var(--bg); border: 1px solid var(--border); border-radius: 999px; padding: 4px 14px; color: var(--accent); font-weight: 600; }
  .case-list { columns: 2; column-gap: 24px; font-size: 14px; line-height: 1.6; }
  .input-block { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 14px 18px; margin: 12px 0 20px; }
  .task, .output { white-space: pre-wrap; background: #0a0c10; border: 1px solid var(--border); border-radius: 6px; padding: 10px 12px; font-size: 12.5px; max-height: 260px; overflow: auto; }
  .model-grid { display: grid; grid-template-columns: repeat(${Math.max(1, models.length)}, 1fr); gap: 20px; }
  .model-col { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 14px 16px; }
  .pill { display: inline-block; border-radius: 999px; padding: 2px 10px; font-size: 12px; font-weight: 600; margin-left: 6px; }
  .pill.passed { background: rgba(63,185,80,0.15); color: var(--pass); }
  .pill.failed { background: rgba(248,81,73,0.15); color: var(--fail); }
  .pill.skipped { background: rgba(210,153,34,0.15); color: var(--skip); }
  .assert-fail { color: var(--fail); font-size: 13px; }
  .judge-msg { font-size: 13px; }
  .reason { color: var(--skip); font-size: 13px; }
  .muted { color: var(--muted); }
  .similarity { margin-top: 16px; font-size: 13px; color: var(--muted); }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
  th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--border); }
  tr.cat-difference_detected td:nth-child(3) { color: var(--fail); font-weight: 600; }
  tr.cat-wrong td:nth-child(3) { color: var(--fail); }
  tr.cat-accepted td:nth-child(3), tr.cat-right td:nth-child(3) { color: var(--pass); }
  tr.cat-needs_review td:nth-child(3) { color: var(--skip); }
  #filter-input { width: 100%; padding: 8px 12px; margin-top: 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg); color: var(--text); }
  .controls { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; }
  .controls button { background: var(--panel); color: var(--text); border: 1px solid var(--border); border-radius: 8px; padding: 10px 18px; cursor: pointer; font-size: 14px; }
  .controls button:hover { border-color: var(--accent); }
  #slide-pos { color: var(--muted); font-size: 13px; }
</style>
</head>
<body>
<div class="deck">
  ${allSlides.join("\n")}
  <div class="controls">
    <button id="prev">&larr; Prev</button>
    <span id="slide-pos"></span>
    <button id="next">Next &rarr;</button>
  </div>
</div>
<script>
  const slides = Array.from(document.querySelectorAll(".slide"));
  let idx = 0;
  function render() {
    slides.forEach((s, i) => s.classList.toggle("active", i === idx));
    document.getElementById("slide-pos").textContent = (idx + 1) + " / " + slides.length;
  }
  document.getElementById("prev").onclick = () => { idx = Math.max(0, idx - 1); render(); };
  document.getElementById("next").onclick = () => { idx = Math.min(slides.length - 1, idx + 1); render(); };
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { idx = Math.min(slides.length - 1, idx + 1); render(); }
    if (e.key === "ArrowLeft") { idx = Math.max(0, idx - 1); render(); }
  });
  const filterInput = document.getElementById("filter-input");
  if (filterInput) {
    filterInput.addEventListener("input", () => {
      const q = filterInput.value.toLowerCase();
      document.querySelectorAll("#data-table tbody tr").forEach((tr) => {
        tr.style.display = tr.textContent.toLowerCase().includes(q) ? "" : "none";
      });
    });
  }
  render();
</script>
</body>
</html>`;

writeFileSync(outPath, html);
console.log(`Wrote ${outPath} (${allSlides.length} slides).`);
console.log(`Open it with: open ${outPath}`);

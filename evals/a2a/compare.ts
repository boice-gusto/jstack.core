#!/usr/bin/env bun
/**
 * Cross-model retro: reads whatever model reports exist under `.tmp/a2a/<model>/latest.json`
 * (written by run.ts) and folds them into one categorized, filterable verdict per case.
 *
 * Proof-based, not judged: every category below is derived purely from data already recorded
 * by run.ts -- the deterministic assertions and the ONE independent judge verdict (always
 * Claude; see run.ts's comment on `judgeBin`) that already ran for that case. This script does
 * NOT call a model again to decide "are these two outputs similar" -- that would just be a
 * second opinion with the same blind spots as the first. The one number it computes itself
 * (`output_similarity`) is a plain word-overlap ratio: mechanical, reproducible, and explicitly
 * NOT used to move a case between categories, only to help you scan `difference_detected` cases
 * for which ones are worth reading in full.
 *
 * Categories (only meaningful once >=2 models were run into `.tmp/a2a/`):
 *   accepted           - every model passed.
 *   wrong              - every model failed. A reproducible bug, not a model quirk.
 *   difference_detected - models disagree (one passed, one failed). The core cross-model
 *                         consistency finding this whole harness exists to surface.
 *   needs_review        - a model's case was skipped (no judge reachable) so the row is
 *                         incomplete; nothing to conclude yet.
 * With exactly one model present, categories collapse to `right` / `wrong` / `needs_review`
 * (there is nothing to disagree with).
 *
 * Usage:
 *   bun run eval:compare                       # full report + summary
 *   bun run eval:compare -- --category wrong    # filter to one category
 *   bun run eval:compare -- --json              # machine-readable
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  categorize,
  jaccardSimilarity,
  type Category,
  type StoredCaseResult,
  type Status,
} from "./compare-lib.js";

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = join(here, "..", "..");
const tmpRoot = join(pluginRoot, ".tmp", "a2a");

const argv = process.argv.slice(2);
const asJson = argv.includes("--json");
const categoryIdx = argv.indexOf("--category");
const categoryFilter = categoryIdx >= 0 ? argv[categoryIdx + 1] : undefined;

interface StoredModelReport {
  model: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  judge_available: boolean;
  results: StoredCaseResult[];
}

interface CompareRow {
  id: string;
  surface: string;
  category: Category;
  by_model: Record<
    string,
    { status: Status; reason?: string; judge_message?: string }
  >;
  /** Jaccard word-overlap between each pair of models' raw candidate output, 0-1. Only present
   * when >=2 models both recorded non-empty output for this case. Measurement, not a verdict. */
  output_similarity?: Record<string, number>;
}

function loadModelReports(): StoredModelReport[] {
  if (!existsSync(tmpRoot)) return [];
  const reports: StoredModelReport[] = [];
  for (const entry of readdirSync(tmpRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const reportPath = join(tmpRoot, entry.name, "latest.json");
    if (!existsSync(reportPath)) continue;
    reports.push(JSON.parse(readFileSync(reportPath, "utf8")));
  }
  return reports;
}

const modelReports = loadModelReports();
if (modelReports.length === 0) {
  console.error(
    "No model reports found under .tmp/a2a/<model>/latest.json. Run 'bun run single-eval-suite-regression-test' or 'bun run multi-model-eval-suite-regression-test' first.",
  );
  process.exit(2);
}

const byCase = new Map<string, Record<string, StoredCaseResult>>();
for (const report of modelReports) {
  for (const r of report.results) {
    const surfaceKey = r.id; // load-error ids are unique per file, real case ids are unique per suite
    if (!byCase.has(surfaceKey)) byCase.set(surfaceKey, {});
    // biome-ignore lint: byCase.get is guaranteed present, just inserted above
    byCase.get(surfaceKey)![r.model] = r;
  }
}

const rows: CompareRow[] = [];
for (const [id, byModel] of byCase) {
  const models = Object.keys(byModel);
  const first = byModel[models[0] as string] as StoredCaseResult;
  const category = categorize(byModel);

  let output_similarity: Record<string, number> | undefined;
  if (models.length >= 2) {
    output_similarity = {};
    for (let i = 0; i < models.length; i++) {
      for (let j = i + 1; j < models.length; j++) {
        const mA = models[i] as string;
        const mB = models[j] as string;
        const outA = byModel[mA]?.output;
        const outB = byModel[mB]?.output;
        if (outA && outB) {
          output_similarity[`${mA}_vs_${mB}`] =
            Math.round(jaccardSimilarity(outA, outB) * 1000) / 1000;
        }
      }
    }
    if (Object.keys(output_similarity).length === 0)
      output_similarity = undefined;
  }

  rows.push({
    id,
    surface: first.surface,
    category,
    by_model: Object.fromEntries(
      models.map((m) => [
        m,
        {
          status: byModel[m]?.status as Status,
          reason: byModel[m]?.reason,
          judge_message: byModel[m]?.judge?.message,
        },
      ]),
    ),
    output_similarity,
  });
}

rows.sort((a, b) => a.id.localeCompare(b.id));

const counts: Record<Category, number> = {
  accepted: 0,
  wrong: 0,
  difference_detected: 0,
  needs_review: 0,
  right: 0,
};
for (const r of rows) counts[r.category]++;

const filtered = categoryFilter
  ? rows.filter((r) => r.category === categoryFilter)
  : rows;

const compareReport = {
  models_compared: modelReports.map((r) => r.model),
  generated_at: new Date().toISOString(),
  total_cases: rows.length,
  counts,
  rows,
};
writeFileSync(
  join(tmpRoot, "compare-report.json"),
  JSON.stringify(compareReport, null, 2) + "\n",
);

if (asJson) {
  console.log(JSON.stringify({ ...compareReport, rows: filtered }, null, 2));
} else {
  console.log(
    `Models compared: ${compareReport.models_compared.join(", ")} (${rows.length} case(s))\n`,
  );
  console.log(
    `accepted: ${counts.accepted}  wrong: ${counts.wrong}  difference_detected: ${counts.difference_detected}  needs_review: ${counts.needs_review}  right: ${counts.right}\n`,
  );
  for (const r of filtered) {
    const modelSummary = Object.entries(r.by_model)
      .map(([m, v]) => `${m}=${v.status}`)
      .join(" ");
    console.log(`[${r.category}] ${r.id} (${modelSummary})`);
  }
  console.log(
    `\nWrote .tmp/a2a/compare-report.json (${filtered.length} row(s) shown).`,
  );
  if (!categoryFilter) {
    console.log(
      "Filter with: bun run eval:compare -- --category difference_detected",
    );
  }
}

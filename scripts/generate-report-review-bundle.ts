#!/usr/bin/env bun
/**
 * Validates each example ReportPayload JSON under examples/reports/payloads/
 * and runs `jstack report render` to refresh examples/reports/rendered/*.html.
 *
 * Run from jstack.core: `bun run scripts/generate-report-review-bundle.ts`
 */
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { REPORT_KINDS, parseReportPayload } from "../types/report-payload-v1.ts";

const ROOT = process.cwd();
const PAYLOAD_DIR = join(ROOT, "examples/reports/payloads");
const OUT_DIR = join(ROOT, "examples/reports/rendered");

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });

  for (const kind of REPORT_KINDS) {
    const fileBase = `${kind}.json`;
    const absPayload = join(PAYLOAD_DIR, fileBase);
    if (!existsSync(absPayload)) {
      console.error(`Missing payload for ${kind}: ${absPayload}`);
      process.exitCode = 1;
      return;
    }
    const raw = readFileSync(absPayload, "utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch (e) {
      console.error(`${fileBase}: invalid JSON`, e);
      process.exitCode = 1;
      return;
    }
    try {
      parseReportPayload(parsed);
    } catch (e) {
      console.error(`${fileBase}: ReportPayload validation failed`, e);
      process.exitCode = 1;
      return;
    }

    const dataRel = join("examples/reports/payloads", fileBase);
    const outRel = join("examples/reports/rendered", `${kind}.html`);
    const r = spawnSync(
      "bun",
      ["cli/src/index.ts", "report", "render", "--data", dataRel, "--out", outRel],
      { cwd: ROOT, stdio: "inherit" },
    );
    if (r.status !== 0) {
      process.exit(r.status ?? 1);
      return;
    }
  }

  console.log("");
  console.log(`OK: ${REPORT_KINDS.length} payloads validated and HTML written under examples/reports/rendered/`);
}

main();

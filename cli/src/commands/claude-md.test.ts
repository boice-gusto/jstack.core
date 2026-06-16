import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runClaudeMdScan, runClaudeMdRender, runClaudeMdApply } from "./claude-md.js";

describe("runClaudeMdScan", () => {
  test("emits JSON with issues + meta when --output=json", async () => {
    const project = mkdtempSync(join(tmpdir(), "jstack-cmd-"));
    try {
      writeFileSync(join(project, "CLAUDE.md"), "Use yarn for installs.\n");
      writeFileSync(join(project, "package-lock.json"), "{}");
      const result = await runClaudeMdScan({
        projectRoot: project,
        homeDir: tmpdir(),
        output: "json",
        now: new Date("2026-04-29T00:00:00Z"),
      });
      expect(result.format).toBe("json");
      const payload = JSON.parse(result.text);
      expect(Array.isArray(payload.issues)).toBe(true);
      expect(payload.issues.some((i: any) => i.detector === "D1")).toBe(true);
      expect(payload.meta.project_root).toBe(project);
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });

  test("renders prose report when --output=prose", async () => {
    const project = mkdtempSync(join(tmpdir(), "jstack-cmd-prose-"));
    try {
      writeFileSync(join(project, "CLAUDE.md"), "Use yarn.\n");
      writeFileSync(join(project, "package-lock.json"), "{}");
      const result = await runClaudeMdScan({
        projectRoot: project,
        homeDir: tmpdir(),
        output: "prose",
        now: new Date("2026-04-29T00:00:00Z"),
      });
      expect(result.format).toBe("prose");
      expect(result.text).toContain("# CLAUDE.md Improvements");
      expect(result.text).toContain("D1");
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });
});

describe("runClaudeMdRender", () => {
  test("renders patch from final-edits json", async () => {
    const project = mkdtempSync(join(tmpdir(), "jstack-render-"));
    try {
      writeFileSync(join(project, "CLAUDE.md"), "Use yarn.\n");
      const finalEdits = {
        meta: { project_root: project, generated_at: "2026-04-29T00:00:00Z" },
        recommendations: [
          {
            issue_id: "i-d1-001",
            category: "remove-stale-rule",
            before: "Use yarn.",
            after: "Use npm.",
            rationale: "lockfile is package-lock.json",
            diff_hunk: "@@ -1 +1 @@\n-Use yarn.\n+Use npm.\n",
            benefit: "Claude stops suggesting yarn",
            example: "Ask install lodash → npm install lodash",
            time_saved_min_per_week: 2.5,
            monthly_savings_min: 10,
            confidence: "high",
            priority_score: 10,
          },
        ],
      };
      const inputPath = join(project, "final.json");
      writeFileSync(inputPath, JSON.stringify(finalEdits));
      const result = await runClaudeMdRender({ inputPath, output: "patch" });
      expect(result.text).toContain("@@ -1 +1 @@");
      expect(result.text).toContain("-Use yarn.");
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });
});

describe("runClaudeMdApply", () => {
  test("aborts when CLAUDE.md changed since scan", async () => {
    const project = mkdtempSync(join(tmpdir(), "jstack-apply-"));
    try {
      writeFileSync(join(project, "CLAUDE.md"), "Use yarn.\n");
      const before = statSync(join(project, "CLAUDE.md")).mtime;
      // Touch the file to bump mtime (use utimes to ensure >1s delta on fast filesystems).
      writeFileSync(join(project, "CLAUDE.md"), "Use yarn (edited).\n");
      utimesSync(join(project, "CLAUDE.md"), new Date(before.getTime() + 2000), new Date(before.getTime() + 2000));
      const result = await runClaudeMdApply({
        projectRoot: project,
        patchPath: join(project, "noop.patch"),
        scanMtimeMs: before.getTime(),
        yes: true,
      });
      expect(result.applied).toBe(false);
      expect(result.reason).toContain("changed since scan");
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });
});

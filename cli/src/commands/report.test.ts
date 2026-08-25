/**
 * `runReportRender` used to embed the raw --data file into the HTML shell without ever parsing
 * or validating it against ReportPayloadSchema -- a malformed or schema-invalid payload still
 * produced a "successful" HTML file (`Wrote ...`, exit 0) with a broken embedded script tag and
 * no signal anything was wrong. These tests drive the real CLI to prove invalid input is now
 * rejected before any file is written, and that a real, valid payload still renders.
 */
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const ENTRY = join(import.meta.dir, "..", "index.ts");
const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
let dir: string;

function runReport(args: string[]) {
  const r = spawnSync("bun", ["run", ENTRY, "report", "render", ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: { ...process.env, JSTACK_INTROSPECT: "", NO_COLOR: "1" },
  });
  return { code: r.status, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "jstack-report-render-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("report render — invalid input", () => {
  test("rejects invalid JSON syntax before writing anything", () => {
    const dataPath = join(dir, "bad-syntax.json");
    const outPath = join(dir, "out.html");
    writeFileSync(dataPath, "not json {{{");
    const { code, out } = runReport(["--data", dataPath, "--out", outPath]);
    expect(code).toBe(1);
    expect(out).toContain("Invalid JSON");
    expect(existsSync(outPath)).toBe(false);
  });

  test("rejects a schema-invalid payload before writing anything", () => {
    const dataPath = join(dir, "bad-schema.json");
    const outPath = join(dir, "out.html");
    writeFileSync(
      dataPath,
      JSON.stringify({ schema_version: 1, sections: "not-an-array" }),
    );
    const { code, out } = runReport(["--data", dataPath, "--out", outPath]);
    expect(code).toBe(1);
    expect(out).toContain("Invalid report payload");
    expect(existsSync(outPath)).toBe(false);
  });

  test("rejects --data pointing at a directory with the same clean error path, not a raw stack trace", () => {
    const dataAsDir = join(dir, "not-a-file");
    mkdirSync(dataAsDir);
    const outPath = join(dir, "out.html");
    const { code, out } = runReport(["--data", dataAsDir, "--out", outPath]);
    expect(code).toBe(1);
    // The clean, caught path -- "Invalid JSON in <path>: EISDIR: ..." -- not an uncaught
    // exception's raw stack trace (which would include a "at <anonymous> (...)" frame).
    expect(out).toContain("Invalid JSON in");
    expect(out).not.toContain("at <anonymous>");
    expect(existsSync(outPath)).toBe(false);
  });
});

describe("report render — valid input", () => {
  test("renders a real example payload successfully", () => {
    const dataPath = join(
      REPO_ROOT,
      "examples",
      "reports",
      "payloads",
      "generic.json",
    );
    const outPath = join(dir, "out.html");
    const { code, out } = runReport(["--data", dataPath, "--out", outPath]);
    expect(code).toBe(0);
    expect(out).toContain("Wrote");
    expect(existsSync(outPath)).toBe(true);
  });
});

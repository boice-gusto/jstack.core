import { describe, expect, test, afterEach } from "bun:test";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gradeCase, mergeAssertsIntoGrading } from "./grade.js";
import type { GlobalEvalEnv } from "./eval-config.js";
import type { EvalCase } from "./eval-config.js";
import type { ExecuteResult } from "./execute.js";

/**
 * `gradeCase` had zero direct test coverage: it shells out to a real `claude -p` grader, which
 * needs ANTHROPIC_API_KEY and isn't part of fast CI. `GlobalEvalEnv.claudeBin` is just a path to
 * an executable, though -- pointing it at a small fake script that echoes canned stdout lets
 * these tests exercise the real function (including its three branches: unreachable grader,
 * valid JSON, malformed JSON) without any live API dependency.
 */
function mkFixture() {
  const dir = mkdtempSync(join(tmpdir(), "jstack-grade-"));
  const caseDir = join(dir, "case");
  mkdirSync(caseDir, { recursive: true });
  return { dir, caseDir };
}

function writeFakeClaudeBin(dir: string, stdout: string, exitCode = 0): string {
  const p = join(dir, "fake-claude.sh");
  writeFileSync(
    p,
    `#!/usr/bin/env bash\ncat <<'FAKE_CLAUDE_EOF'\n${stdout}\nFAKE_CLAUDE_EOF\nexit ${exitCode}\n`,
    "utf8",
  );
  chmodSync(p, 0o755);
  return p;
}

function env(overrides: Partial<GlobalEvalEnv> = {}): GlobalEvalEnv {
  return {
    pluginRoot: "/tmp",
    passThreshold: 1,
    defaultTimeout: 60,
    maxRetries: 1,
    retryDelaySec: 0,
    claudeBin: "/bin/false",
    workspaceDir: "/tmp",
    ...overrides,
  };
}

function caseDef(overrides: Partial<EvalCase> = {}): EvalCase {
  return {
    name: "t",
    prompt: "do the thing",
    criteria: ["criterion one", "criterion two"],
    files: [],
    expect_skill: true,
    timeout: 60,
    _source: "t.yaml",
    ...overrides,
  };
}

function execResult(overrides: Partial<ExecuteResult> = {}): ExecuteResult {
  return {
    name: "t",
    status: "completed",
    elapsed: 1,
    tokens: 10,
    cost_usd: 0.01,
    skill_triggered: true,
    response: "the response text",
    ...overrides,
  };
}

let cleanupDirs: string[] = [];
afterEach(() => {
  for (const d of cleanupDirs) rmSync(d, { recursive: true, force: true });
  cleanupDirs = [];
});

describe("gradeCase — valid grader JSON", () => {
  test("returns the parsed grading and persists grading.json", () => {
    const { dir, caseDir } = mkFixture();
    cleanupDirs.push(dir);
    const claudeBin = writeFakeClaudeBin(
      dir,
      JSON.stringify({
        expectations: [
          { text: "criterion one", passed: true, evidence: "seen" },
          { text: "criterion two", passed: false, evidence: "missing" },
        ],
        summary: { passed: 1, failed: 1, total: 2, pass_rate: 0.5 },
      }),
    );
    const result = gradeCase(
      env({ claudeBin }),
      caseDef(),
      execResult(),
      caseDir,
    );
    expect(result.summary).toEqual({
      passed: 1,
      failed: 1,
      total: 2,
      pass_rate: 0.5,
    });
    expect(result.expectations).toHaveLength(2);
    const persisted = JSON.parse(
      readFileSync(join(caseDir, "grading.json"), "utf8"),
    );
    expect(persisted).toEqual(result);
  });

  test("unwraps a ```json fenced grader response", () => {
    const { dir, caseDir } = mkFixture();
    cleanupDirs.push(dir);
    const claudeBin = writeFakeClaudeBin(
      dir,
      "```json\n" +
        JSON.stringify({
          expectations: [
            { text: "criterion one", passed: true, evidence: "x" },
          ],
          summary: { passed: 1, failed: 0, total: 1, pass_rate: 1 },
        }) +
        "\n```",
    );
    const result = gradeCase(
      env({ claudeBin }),
      caseDef({ criteria: ["criterion one"] }),
      execResult(),
      caseDir,
    );
    expect(result.summary.pass_rate).toBe(1);
  });
});

describe("gradeCase — grader unreachable after retries", () => {
  test("every criterion fails with 'Grading failed after retries', still persisted", () => {
    const { dir, caseDir } = mkFixture();
    cleanupDirs.push(dir);
    // Exits non-zero with empty stdout on every attempt -- runGrader treats this as unreachable.
    const claudeBin = writeFakeClaudeBin(dir, "", 1);
    const result = gradeCase(
      env({ claudeBin, maxRetries: 1 }),
      caseDef({ criteria: ["a", "b", "c"] }),
      execResult(),
      caseDir,
    );
    expect(result.summary).toEqual({
      passed: 0,
      failed: 3,
      total: 3,
      pass_rate: 0,
    });
    expect(
      result.expectations.every(
        (e) => e.evidence === "Grading failed after retries",
      ),
    ).toBe(true);
    const persisted = JSON.parse(
      readFileSync(join(caseDir, "grading.json"), "utf8"),
    );
    expect(persisted).toEqual(result);
  });
});

describe("gradeCase — grader returns malformed JSON", () => {
  test("every criterion fails with 'Grading JSON parse failed', still persisted", () => {
    const { dir, caseDir } = mkFixture();
    cleanupDirs.push(dir);
    const claudeBin = writeFakeClaudeBin(dir, "this is not json at all {{{");
    const result = gradeCase(
      env({ claudeBin }),
      caseDef({ criteria: ["a"] }),
      execResult(),
      caseDir,
    );
    expect(result.summary).toEqual({
      passed: 0,
      failed: 1,
      total: 1,
      pass_rate: 0,
    });
    expect(result.expectations[0]?.evidence).toBe("Grading JSON parse failed");
    const persisted = JSON.parse(
      readFileSync(join(caseDir, "grading.json"), "utf8"),
    );
    expect(persisted).toEqual(result);
  });
});

describe("mergeAssertsIntoGrading", () => {
  test("passes the grader result through unchanged when the case has no `assert` block", () => {
    const grader = {
      expectations: [{ text: "a", passed: true, evidence: "x" }],
      summary: { passed: 1, failed: 0, total: 1, pass_rate: 1 },
    };
    const merged = mergeAssertsIntoGrading(caseDef(), execResult(), grader);
    expect(merged).toEqual(grader);
  });
});

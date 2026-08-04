import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executeCase } from "./execute.js";
import type { EvalCase } from "./eval-config.js";
import type { GlobalEvalEnv } from "./eval-config.js";

/**
 * `executeCase` writes each eval case's `files: [{path, content}]` entries into a
 * disposable `mkdtempSync` scratch dir before invoking the skill under test. `path`
 * comes straight from eval-case YAML with no containment check — a `../` traversal
 * escaped the scratch dir entirely (proven against the real, unmodified code: a
 * crafted case with `files: [{path: "../../../evil", content: "PWNED"}]` created a
 * file outside the mkdtemp'd workDir). Fixed by requiring every file path to resolve
 * to somewhere under workDir.
 */
function baseCase(files: EvalCase["files"]): EvalCase {
  return {
    name: "test-case",
    prompt: "irrelevant — the traversal check runs before any skill invocation",
    criteria: [],
    files,
    expect_skill: false,
    timeout: 5,
    _source: "test",
  };
}

const env: GlobalEvalEnv = {
  pluginRoot: tmpdir(),
  passThreshold: 80,
  defaultTimeout: 5,
  maxRetries: 0,
  retryDelaySec: 0,
  claudeBin: "true",
  workspaceDir: tmpdir(),
};

describe("executeCase — files[].path containment", () => {
  test("a `..` traversal path is rejected and does not escape the scratch dir", () => {
    const outsideDir = mktempScratch();
    try {
      const evilTarget = join(outsideDir, "PWNED.txt");
      const rel = "../".repeat(20) + evilTarget.replace(/^\//, "");
      const result = executeCase(
        env,
        "fake-skill",
        "skill content",
        baseCase([{ path: rel, content: "PWNED" }]),
        join(outsideDir, "workspace"),
      );

      expect(result.status).toBe("error");
      expect(result.error).toMatch(/escapes the case workspace/);
      expect(existsSync(evilTarget)).toBe(false);
    } finally {
      rmSync(outsideDir, { recursive: true, force: true });
    }
  });

  test("an absolute path is rejected and does not escape the scratch dir", () => {
    const outsideDir = mktempScratch();
    try {
      const evilTarget = join(outsideDir, "PWNED.txt");
      const result = executeCase(
        env,
        "fake-skill",
        "skill content",
        baseCase([{ path: evilTarget, content: "PWNED" }]),
        join(outsideDir, "workspace"),
      );

      expect(result.status).toBe("error");
      expect(existsSync(evilTarget)).toBe(false);
    } finally {
      rmSync(outsideDir, { recursive: true, force: true });
    }
  });

  test("an ordinary relative file path is still written normally (regression check)", () => {
    // A well-behaved case with a relative path should still work — this only rejects
    // paths that resolve outside the scratch dir, not relative paths in general.
    const result = executeCase(
      env,
      "fake-skill",
      "skill content",
      baseCase([{ path: "fixtures/input.txt", content: "hello" }]),
      mktempScratch(),
    );
    // With claudeBin "true" the subsequent skill invocation itself will fail/complete
    // trivially — what matters here is that it did NOT fail during file setup.
    if (result.error) {
      expect(result.error).not.toMatch(/escapes the case workspace/);
    }
  });
});

function mktempScratch(): string {
  return mkdtempSync(join(tmpdir(), "jstack-eval-test-"));
}

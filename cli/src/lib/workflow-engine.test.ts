import { describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  deleteWorkflow,
  hasWorkflowArtifacts,
  importWorkflowFromFile,
  loadWorkflow,
  saveWorkflow,
  workflowArtifactsDir,
} from "./workflow-engine.js";
import type { WorkflowDefinition } from "../types/workflow.js";

/**
 * A workflow `id` can arrive from a file someone else shares (`jstack workflow import`), so it's
 * untrusted. These tests prove a traversal id can't read, write, or delete outside
 * `config/workflows/`, mirroring the containment tests in doctor.test.ts.
 */
function mkFixture() {
  const projectRoot = mkdtempSync(join(tmpdir(), "jstack-workflow-project-"));
  const outside = mkdtempSync(join(tmpdir(), "jstack-workflow-outside-"));
  return { projectRoot, outside };
}

function def(id: string): WorkflowDefinition {
  return {
    id,
    name: "t",
    steps: [{ id: "s1", kind: "goto", url: "https://example.com" }],
  };
}

describe("workflow-engine — path containment", () => {
  test("saveWorkflow: a traversal id is rejected and does not escape the project root", () => {
    const { projectRoot, outside } = mkFixture();
    try {
      const evilId = "../".repeat(10) + outside.slice(1) + "/pwned";
      expect(() => saveWorkflow(projectRoot, def(evilId))).toThrow();
      expect(existsSync(join(outside, "pwned.json"))).toBe(false);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  test("loadWorkflow: a traversal id cannot read a file outside the workflows dir", () => {
    const { projectRoot, outside } = mkFixture();
    try {
      writeFileSync(
        join(outside, "secret.json"),
        JSON.stringify(def("secret")),
        "utf8",
      );
      const rel = "../".repeat(10) + outside.slice(1) + "/secret";
      expect(loadWorkflow(projectRoot, rel)).toBeNull();
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  test("deleteWorkflow: a traversal id cannot delete a file outside the workflows dir", () => {
    const { projectRoot, outside } = mkFixture();
    try {
      const target = join(outside, "keepme.json");
      writeFileSync(target, JSON.stringify(def("keepme")), "utf8");
      const rel = "../".repeat(10) + outside.slice(1) + "/keepme";
      expect(deleteWorkflow(projectRoot, rel)).toBe(false);
      expect(existsSync(target)).toBe(true);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  test("importWorkflowFromFile: an imported file with a traversal id fails closed instead of writing outside the project", () => {
    const { projectRoot, outside } = mkFixture();
    try {
      const importFile = join(outside, "import.json");
      const evilId = "../".repeat(10) + outside.slice(1) + "/pwned-import";
      writeFileSync(importFile, JSON.stringify(def(evilId)), "utf8");
      expect(importWorkflowFromFile(projectRoot, importFile)).toBeNull();
      expect(existsSync(join(outside, "pwned-import.json"))).toBe(false);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  test("legitimate ids still round-trip normally", () => {
    const { projectRoot, outside } = mkFixture();
    try {
      saveWorkflow(projectRoot, def("my-workflow"));
      expect(loadWorkflow(projectRoot, "my-workflow")?.id).toBe("my-workflow");
      expect(deleteWorkflow(projectRoot, "my-workflow")).toBe(true);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });
});

/**
 * A hand-edited or shared/imported file can be syntactically valid JSON but schema-invalid (a
 * `kind` outside the six the schema allows, a missing required field). Both `loadWorkflow` and
 * `importWorkflowFromFile` used to let `.parse()` throw uncaught in that case, crashing the CLI
 * with a raw stack trace instead of the clean "Unknown workflow"/"Import failed" message every
 * other invalid-input path already produces.
 */
describe("workflow-engine — malformed/schema-invalid files fail closed, not crash", () => {
  test("loadWorkflow returns null for schema-invalid JSON instead of throwing", () => {
    const { projectRoot, outside } = mkFixture();
    try {
      const dir = join(projectRoot, "config", "workflows");
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, "broken.json"),
        JSON.stringify({ id: "broken", name: "t" }), // missing steps
        "utf8",
      );
      expect(loadWorkflow(projectRoot, "broken")).toBeNull();
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  test("loadWorkflow returns null for non-JSON content instead of throwing", () => {
    const { projectRoot, outside } = mkFixture();
    try {
      const dir = join(projectRoot, "config", "workflows");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "notjson.json"), "not valid json {{{", "utf8");
      expect(loadWorkflow(projectRoot, "notjson")).toBeNull();
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  test("importWorkflowFromFile returns null for schema-invalid JSON instead of throwing", () => {
    const { projectRoot, outside } = mkFixture();
    try {
      const importFile = join(outside, "broken-import.json");
      writeFileSync(
        importFile,
        JSON.stringify({
          id: "x",
          steps: [{ id: "s1", kind: "not-a-real-kind" }],
        }),
        "utf8",
      );
      expect(importWorkflowFromFile(projectRoot, importFile)).toBeNull();
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });
});

/**
 * `runWorkflowViaClaude` used to report `ok: true` off `runClaude()`'s process-level result alone
 * -- "the claude subprocess didn't crash," not "a browser did anything." A live run against this
 * exact code (no browser-automation MCP configured) proved the gap concretely: the nested agent's
 * own text said "no steps...were executed" while the wrapper still returned `ok: true`. These
 * tests cover `hasWorkflowArtifacts`, the deterministic, filesystem-verifiable gate that now sits
 * between "the process didn't error" and "this run counts as ok" -- no claude process, no mocking.
 */
describe("workflow-engine — artifact gate", () => {
  test("false when the artifacts directory was never created", () => {
    const { projectRoot, outside } = mkFixture();
    try {
      expect(hasWorkflowArtifacts(projectRoot, "never-ran")).toBe(false);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  test("false when the artifacts directory exists but is empty", () => {
    const { projectRoot, outside } = mkFixture();
    try {
      mkdirSync(workflowArtifactsDir(projectRoot, "empty-run"), {
        recursive: true,
      });
      expect(hasWorkflowArtifacts(projectRoot, "empty-run")).toBe(false);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  test("true once at least one artifact file exists", () => {
    const { projectRoot, outside } = mkFixture();
    try {
      const dir = workflowArtifactsDir(projectRoot, "real-run");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "step-1.png"), "fake-png-bytes", "utf8");
      expect(hasWorkflowArtifacts(projectRoot, "real-run")).toBe(true);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });
});

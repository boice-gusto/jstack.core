import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  deleteWorkflow,
  importWorkflowFromFile,
  loadWorkflow,
  saveWorkflow,
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
  return { id, name: "t", start_url: "https://example.com", steps: [] };
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
      writeFileSync(join(outside, "secret.json"), JSON.stringify(def("secret")), "utf8");
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

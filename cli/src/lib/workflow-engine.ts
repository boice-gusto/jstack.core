import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { WorkflowDefinitionSchema, type WorkflowDefinition } from "../types/workflow.js";

export function workflowsDir(projectRoot: string): string {
  return join(projectRoot, "config", "workflows");
}

export function listWorkflows(projectRoot: string): string[] {
  const d = workflowsDir(projectRoot);
  if (!existsSync(d)) return [];
  return readdirSync(d).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
}

export function loadWorkflow(projectRoot: string, id: string): WorkflowDefinition | null {
  const p = join(workflowsDir(projectRoot), `${id}.json`);
  if (!existsSync(p)) return null;
  return WorkflowDefinitionSchema.parse(JSON.parse(readFileSync(p, "utf8")));
}

export function saveWorkflow(projectRoot: string, def: WorkflowDefinition): void {
  const d = workflowsDir(projectRoot);
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, `${def.id}.json`), JSON.stringify(def, null, 2) + "\n", "utf8");
}

export function deleteWorkflow(projectRoot: string, id: string): boolean {
  const p = join(workflowsDir(projectRoot), `${id}.json`);
  if (!existsSync(p)) return false;
  unlinkSync(p);
  return true;
}

export function exportWorkflow(projectRoot: string, id: string, outPath: string): boolean {
  const def = loadWorkflow(projectRoot, id);
  if (!def) return false;
  writeFileSync(outPath, JSON.stringify(def, null, 2) + "\n", "utf8");
  return true;
}

export function importWorkflowFromFile(projectRoot: string, filePath: string): WorkflowDefinition | null {
  if (!existsSync(filePath)) return null;
  const raw = JSON.parse(readFileSync(filePath, "utf8"));
  const def = WorkflowDefinitionSchema.parse(raw);
  saveWorkflow(projectRoot, def);
  return def;
}

/** Stub executor — real impl wires Playwright / browser_use */
export async function runWorkflowStub(def: WorkflowDefinition): Promise<{ ok: boolean; log: string[] }> {
  return {
    ok: true,
    log: [`Would run workflow ${def.name} starting at ${def.start_url} (${def.steps.length} steps)`],
  };
}

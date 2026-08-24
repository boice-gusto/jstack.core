import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { resolveWithinRoots } from "./path-utils.js";
import { runClaude } from "./crew/slack.js";
import {
  WorkflowDefinitionSchema,
  type WorkflowDefinition,
  type WorkflowStep,
} from "../types/workflow.js";

export function workflowsDir(projectRoot: string): string {
  return join(projectRoot, "config", "workflows");
}

/**
 * A workflow id can come from a shared/imported file, so it's untrusted. Resolve it against
 * workflowsDir and reject anything (e.g. `../../etc/whatever`) that would land outside it.
 */
function resolveWorkflowPath(projectRoot: string, id: string): string | null {
  const d = workflowsDir(projectRoot);
  return resolveWithinRoots(join(d, `${id}.json`), [d]);
}

export function listWorkflows(projectRoot: string): string[] {
  const d = workflowsDir(projectRoot);
  if (!existsSync(d)) return [];
  return readdirSync(d)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}

export function loadWorkflow(
  projectRoot: string,
  id: string,
): WorkflowDefinition | null {
  const p = resolveWorkflowPath(projectRoot, id);
  if (!p || !existsSync(p)) return null;
  try {
    return WorkflowDefinitionSchema.parse(JSON.parse(readFileSync(p, "utf8")));
  } catch {
    // Malformed JSON or a schema-invalid shape (e.g. a hand-edited or shared file) is a "not
    // found/usable" outcome for every caller, exactly like a missing file -- not a crash.
    return null;
  }
}

export function saveWorkflow(
  projectRoot: string,
  def: WorkflowDefinition,
): void {
  const d = workflowsDir(projectRoot);
  mkdirSync(d, { recursive: true });
  const p = resolveWorkflowPath(projectRoot, def.id);
  if (!p) throw new Error(`Invalid workflow id: ${def.id}`);
  writeFileSync(p, JSON.stringify(def, null, 2) + "\n", "utf8");
}

export function deleteWorkflow(projectRoot: string, id: string): boolean {
  const p = resolveWorkflowPath(projectRoot, id);
  if (!p || !existsSync(p)) return false;
  unlinkSync(p);
  return true;
}

export function exportWorkflow(
  projectRoot: string,
  id: string,
  outPath: string,
): boolean {
  const def = loadWorkflow(projectRoot, id);
  if (!def) return false;
  writeFileSync(outPath, JSON.stringify(def, null, 2) + "\n", "utf8");
  return true;
}

export function importWorkflowFromFile(
  projectRoot: string,
  filePath: string,
): WorkflowDefinition | null {
  if (!existsSync(filePath)) return null;
  let def: WorkflowDefinition;
  try {
    def = WorkflowDefinitionSchema.parse(
      JSON.parse(readFileSync(filePath, "utf8")),
    );
  } catch {
    return null;
  }
  try {
    saveWorkflow(projectRoot, def);
  } catch {
    return null;
  }
  return def;
}

function describeStep(step: WorkflowStep, index: number): string {
  const parts = [`${index + 1}. ${step.kind}`];
  switch (step.kind) {
    case "goto":
      parts.push(`url=${step.url}`);
      break;
    case "click":
    case "wait":
      parts.push(`selector=${step.selector}`);
      break;
    case "fill":
      parts.push(`selector=${step.selector}`);
      parts.push(
        step.value.startsWith("env:")
          ? `value=<secret, resolve ${step.value.slice(4)} from env, never print it>`
          : `value=${step.value}`,
      );
      break;
    case "screenshot":
    case "ai":
      break;
  }
  if (step.notes) parts.push(`notes=${step.notes}`);
  return `  ${parts.join(" ")}`;
}

/**
 * Builds the prompt for the spawned `claude -p` that actually drives the workflow. There is
 * no npm browser-automation dependency in this repo by design (see
 * `skills/computer-use/references/tool-matrix.md`) -- web automation goes through whatever
 * browser-automation MCP (e.g. Playwright MCP) the host has configured, the same way
 * `jstack schedule run` delegates skill chains to a spawned agent rather than reimplementing
 * skill execution locally.
 */
export function buildWorkflowRunPrompt(def: WorkflowDefinition): string {
  const steps = def.steps.map(describeStep).join("\n");
  return (
    `Run the browser workflow "${def.name}" (id "${def.id}"), triggered by ` +
    `\`jstack workflow run ${def.id} --yes\`.\n\n` +
    `Start at: ${def.start_url}\n\n` +
    `Steps, in order:\n${steps || "  (no steps defined)"}\n\n` +
    `Discipline:\n` +
    `- Drive a real browser via whichever browser-automation tool you have available (e.g. ` +
    `Playwright MCP). If none is configured, stop immediately and say so plainly -- never ` +
    `claim a step ran if it didn't.\n` +
    `- A "fill" step whose value is "env:VAR_NAME" is a secret: read VAR_NAME from the ` +
    `environment and type it directly into the field. Never print its value, write it to a ` +
    `file, or include it in your final report.\n` +
    `- Capture a screenshot per step when your tool supports it, saved under ` +
    `\`artifacts/workflows/${def.id}/\`.\n` +
    `- If a step fails, stop there and report which step failed and why; never report ` +
    `overall success if any step failed.\n` +
    `- Finish with a short summary naming what ran and what you verified.`
  );
}

/** `claude -p` is not expected to finish a multi-step browser flow instantly; generous but bounded. */
export const WORKFLOW_RUN_TIMEOUT_MS = 10 * 60 * 1000;

export function workflowArtifactsDir(projectRoot: string, id: string): string {
  return join(projectRoot, "artifacts", "workflows", id);
}

/**
 * Whether the spawned agent actually produced any artifact (screenshot, trace, report) under
 * this workflow's artifacts directory. This is the ONLY thing `runWorkflowViaClaude` trusts to
 * decide `ok` -- not `runClaude()`'s process-level `ok` (which means "the claude subprocess
 * didn't crash," not "the browser did anything") and not the agent's own prose claim of success.
 * A live test run against this exact code (no browser-automation MCP configured) returned
 * `{"ok": true, "log": ["...no steps...were executed..."]}` -- the nested agent correctly
 * refused to claim anything ran, in plain English, while the wrapper still reported `ok: true`
 * because the subprocess itself hadn't errored. That is the fabricated-green-report failure mode
 * every other doc in `examples/workflows/` and the workflows skills warn about, just moved one
 * layer down from the old hardcoded stub into this wrapper's own success test.
 */
export function hasWorkflowArtifacts(projectRoot: string, id: string): boolean {
  const dir = workflowArtifactsDir(projectRoot, id);
  if (!existsSync(dir)) return false;
  try {
    return readdirSync(dir).length > 0;
  } catch {
    return false;
  }
}

export async function runWorkflowViaClaude(
  projectRoot: string,
  def: WorkflowDefinition,
  timeoutMs: number = WORKFLOW_RUN_TIMEOUT_MS,
): Promise<{ ok: boolean; log: string[] }> {
  const result = await runClaude([], buildWorkflowRunPrompt(def), timeoutMs);
  if (!result.ok) {
    return { ok: false, log: [`Run failed: ${result.text}`] };
  }
  const gotArtifact = hasWorkflowArtifacts(projectRoot, def.id);
  const agentText = result.text || "(agent reported no output)";
  if (!gotArtifact) {
    return {
      ok: false,
      log: [
        agentText,
        `unverified: no artifact was written under ${workflowArtifactsDir(projectRoot, def.id)} -- ` +
          "a completed process is not evidence a browser ran anything; treating this as a non-pass " +
          "regardless of what the agent's own report claimed.",
      ],
    };
  }
  return { ok: true, log: [agentText] };
}

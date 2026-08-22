import chalk from "chalk";
import * as p from "@clack/prompts";
import { mkdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { findProjectRoot } from "../lib/config.js";
import {
  exitCancelled,
  handleCancel,
  isInteractive,
  nonInteractiveHint,
} from "../lib/cliUi.js";
import {
  buildWorkflowRunPrompt,
  deleteWorkflow,
  exportWorkflow,
  importWorkflowFromFile,
  listWorkflows,
  loadWorkflow,
  runWorkflowViaClaude,
  saveWorkflow,
  workflowsDir,
} from "../lib/workflow-engine.js";
import type { WorkflowDefinition } from "../types/workflow.js";

export async function runWorkflowList(opts: { json?: boolean }): Promise<void> {
  const root = findProjectRoot();
  const ids = listWorkflows(root);
  if (opts.json) {
    const items = ids.map((id) => {
      const def = loadWorkflow(root, id);
      return def
        ? {
            id: def.id,
            name: def.name,
            start_url: def.start_url,
            steps: def.steps.length,
            created_at: def.created_at,
          }
        : { id, name: id, start_url: "", steps: 0 };
    });
    console.log(
      JSON.stringify({ workflows_dir: workflowsDir(root), items }, null, 2),
    );
    return;
  }
  console.log(chalk.bold(`Workflows (${workflowsDir(root)})`));
  for (const id of ids) console.log(`  • ${id}`);
}

export async function runWorkflowShow(
  id: string,
  opts: { json?: boolean },
): Promise<void> {
  const root = findProjectRoot();
  const def = loadWorkflow(root, id);
  if (!def) {
    console.error(`Unknown workflow: ${id}`);
    process.exitCode = 1;
    return;
  }
  if (opts.json) {
    console.log(JSON.stringify(def, null, 2));
    return;
  }
  console.log(chalk.bold(def.name));
  console.log(JSON.stringify(def, null, 2));
}

export interface WorkflowRunOpts {
  yes?: boolean;
  dryRun?: boolean;
  json?: boolean;
}

export async function runWorkflowRun(
  id: string,
  opts: WorkflowRunOpts,
): Promise<void> {
  const root = findProjectRoot();
  const def = loadWorkflow(root, id);
  if (!def) {
    console.error(`Unknown workflow: ${id}`);
    process.exitCode = 1;
    return;
  }

  if (opts.dryRun) {
    const prompt = buildWorkflowRunPrompt(def);
    if (opts.json) {
      console.log(
        JSON.stringify(
          { id, dryRun: true, steps: def.steps.length, prompt },
          null,
          2,
        ),
      );
      return;
    }
    console.log(
      chalk.bold(
        `Would run workflow "${id}" via a spawned agent driving a real browser. No process was started.`,
      ),
    );
    console.log("");
    console.log(chalk.dim("--- prompt ---"));
    console.log(prompt);
    return;
  }

  if (!opts.yes) {
    console.log(chalk.bold("Preview"));
    console.log(JSON.stringify(def, null, 2));
    if (isInteractive()) {
      const go = await p.confirm({
        message:
          "Run this workflow now? This drives a real browser via whatever browser-automation tool the agent has (e.g. Playwright MCP).",
        initialValue: false,
      });
      if (handleCancel(go)) exitCancelled();
      if (!go) {
        console.log(chalk.dim("Skipped. Pass --yes to run without a prompt."));
        return;
      }
    } else {
      console.error(
        chalk.red(
          "Non-interactive: pass --yes to run, or --dry-run to preview. ",
        ) + chalk.dim(nonInteractiveHint("--yes / --dry-run")),
      );
      process.exitCode = 1;
      return;
    }
  }

  const res = await runWorkflowViaClaude(root, def);
  if (opts.json) {
    console.log(JSON.stringify({ id, ok: res.ok, log: res.log }, null, 2));
  } else {
    console.log(
      res.ok ? chalk.green(res.log.join("\n")) : chalk.red(res.log.join("\n")),
    );
    console.log("");
    console.log("## Links");
    console.log("");
    console.log(
      `- Workflow definition: \`config/workflows/${id}.json\` (local)`,
    );
  }
  if (!res.ok) process.exitCode = 1;
}

export async function runWorkflowCreate(
  id: string,
  urlMaybe?: string,
): Promise<void> {
  let url = urlMaybe?.trim() ?? "";
  let displayName = "";

  if (url.length === 0 && isInteractive()) {
    const u = await p.text({
      message: "Start URL for workflow",
      validate: (v) => (v.trim().length > 0 ? undefined : "URL is required"),
    });
    if (handleCancel(u)) exitCancelled();
    url = String(u).trim();

    const dn = await p.text({
      message: "Display name (optional; Enter to use workflow id)",
      placeholder: id,
    });
    if (handleCancel(dn)) exitCancelled();
    displayName = String(dn).trim();
  }

  if (url.length === 0) {
    console.error(chalk.red(nonInteractiveHint("--url")));
    process.exitCode = 1;
    return;
  }

  const root = findProjectRoot();
  mkdirSync(workflowsDir(root), { recursive: true });
  const nameLabel = displayName.length > 0 ? displayName : id;
  const def: WorkflowDefinition = {
    id,
    name: nameLabel,
    start_url: url,
    steps: [{ id: "s1", kind: "goto", url }],
    created_at: new Date().toISOString(),
  };
  saveWorkflow(root, def);
  console.log(chalk.green(`Saved workflow ${id}`));
  console.log("");
  console.log("## Links");
  console.log("");
  console.log(`- Saved: config/workflows/${id}.json`);
}

export async function runWorkflowDelete(
  id: string,
  force: boolean,
): Promise<void> {
  const root = findProjectRoot();

  if (!force) {
    if (!isInteractive()) {
      console.error(
        chalk.red("Refusing to delete without --force (non-interactive)."),
      );
      process.exitCode = 1;
      return;
    }
    const proceed = await p.confirm({
      message: `Delete workflow "${id}"?`,
      initialValue: false,
    });
    if (handleCancel(proceed)) exitCancelled();
    if (!proceed) {
      console.log(chalk.dim("Skipped."));
      return;
    }
  }

  const ok = deleteWorkflow(root, id);
  if (!ok) {
    console.error(`No workflow: ${id}`);
    process.exitCode = 1;
    return;
  }
  console.log(chalk.green(`Deleted workflow ${id}`));
}

export function runWorkflowExport(id: string, out: string): void {
  const root = findProjectRoot();
  const path = isAbsolute(out) ? out : join(root, out);
  const ok = exportWorkflow(root, id, path);
  if (!ok) {
    console.error(`Unknown workflow: ${id}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Exported ${id} → ${path}`);
}

export function runWorkflowImport(file: string): void {
  const root = findProjectRoot();
  const path = isAbsolute(file) ? file : join(root, file);
  const def = importWorkflowFromFile(root, path);
  if (!def) {
    console.error(`Import failed: ${path}`);
    process.exitCode = 1;
    return;
  }
  console.log(chalk.green(`Imported workflow ${def.id}`));
}

export function runWorkflowEdit(
  id: string,
  o: { startUrl?: string; name?: string },
): void {
  const root = findProjectRoot();
  const def = loadWorkflow(root, id);
  if (!def) {
    console.error(`Unknown workflow: ${id}`);
    process.exitCode = 1;
    return;
  }
  const newUrl = o.startUrl?.trim();
  let steps = [...def.steps];
  if (newUrl && steps.length > 0 && steps[0].kind === "goto") {
    steps[0] = { ...steps[0], url: newUrl };
  } else if (newUrl && steps.length === 0) {
    steps = [{ id: "s1", kind: "goto", url: newUrl }];
  }
  const next: WorkflowDefinition = {
    ...def,
    name: o.name?.trim() ? o.name.trim() : def.name,
    start_url: newUrl ?? def.start_url,
    steps,
  };
  saveWorkflow(root, next);
  console.log(chalk.green(`Updated workflow ${id}`));
}

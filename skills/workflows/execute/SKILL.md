---
name: jstack-workflow-execute
description: Run a saved workflow via CLI; preview then run with --yes. Engine may be stub until Playwright is wired.
category: workflows
gbrain_destination: inherit
data_class: internal
when_to_use: After a workflow exists in config/workflows; user wants to run it from the agent or confirm CLI behavior.
---

<!-- Chain Contract -->
<!-- inputs: user_request, workflow_id, jstack_config -->
<!-- outputs: workflow_log, structured_result -->
<!-- chains-from: workflows/runner, workflows/workflow-wizard -->
<!-- chains-to: (optional) share or report skills if publishing artifacts -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for

Run a saved workflow definition from **`config/workflows/<id>.json`** after the user confirms. The CLI implements **list**, **show**, **run** (with preview unless `--yes`). The **executor** in `cli/src/lib/workflow-engine.ts` is **`runWorkflowStub`**: it logs that the workflow *would* run and does not drive a real browser until a full Playwright (or equivalent) integration is wired. Do not claim full browser automation when the stub is in use; point to the stub log line as evidence.

## Out of scope

- Recording new steps (use workflow builder / recorder flows when available; see **`workflows/runner`**).
- Mutating production without preview and explicit `--yes` (or host equivalent).
- Inventing workflow JSON; always load from disk or `jstack workflow show`.

## Domain rules — workflow execution

- **Preview first:** `jstack workflow run <id>` without `--yes` shows the plan; require explicit approval before `--yes`.
- **Truthful stub:** When only the stub runs, the log is like `Would run workflow … (N steps)` — state that clearly in the summary.
- **Secrets:** Never echo env values or tokens in chat; workflow definitions must not embed credentials.

## Config and references

- Workflows directory: `config/workflows/*.json` (see `workflowsDir`, `loadWorkflow` in `cli/src/lib/workflow-engine.ts`).
- CLI: `jstack workflow list | show <id> | run <id> [--yes] [--json]` — see `cli/src/commands/workflow.ts`.
- Artifacts: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/response-artifacts.md`
- Chaining: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/chaining-guide.md`
- Related skill: `${CLAUDE_PLUGIN_ROOT}/skills/workflows/runner/SKILL.md`

## Intake

1. Parse `$ARGUMENTS` for **workflow id** (or ask one question if missing).
2. If the user wants to **create** rather than run, hand off to **`jstack-workflow-wizard`** or `jstack workflow create`.

## Procedure

### Step 1 — Resolve definition

Run or suggest: `jstack workflow list` then `jstack workflow show <id> --json` (or read `config/workflows/<id>.json`). Confirm `start_url` and `steps.length` match user intent.

### Step 2 — Preview

Run `jstack workflow run <id>` **without** `--yes` so the host shows the preview; only proceed to execution when the user approves.

### Step 3 — Execute

Run `jstack workflow run <id> --yes`. Parse stdout; if the engine is the stub, the log contains a single **Would run workflow** line — report that as the outcome, not a live browser result.

### Step 4 — Artifacts

If screenshots or URLs are produced in the future, add **## Links** per `response-artifacts.md`. For stub-only runs, say there are no screenshots yet.

## Output shape

- **Summary** — Workflow id, whether stub or real runner, and ok/fail from CLI exit.
- **Log excerpt** — Bullet the `runWorkflowStub` lines or real log lines (no secrets).
- **Next steps** — e.g. wire Playwright, edit steps, or `suggested_next: jstack-workflow-runner` for richer runbook.

## Failure modes

| Symptom | Recovery |
|---------|----------|
| Unknown id / missing file | `jstack workflow list`; suggest `workflow create` or import. |
| User runs without approval | Stop; show preview again. |
| Stub only | Explain limitation; do not simulate green checkmarks on a live site. |
| JSON parse error | Point to schema in `cli` types / fix file in `config/workflows/`. |

## Chaining

- After a successful (or stub) run, `suggested_next:` **`jstack-workflow-runner`** if the user needs assertions, screenshots, or CI-style runbook.
- For publishing HTML or reports from outputs, chain to report or share skills only when paths exist.

## User request

$ARGUMENTS

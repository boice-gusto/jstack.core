# Browser workflows: what works today

Read this before promising anything about a workflow run. The `jstack:workflows-*` skills describe a
richer surface than the CLI currently implements, and the gap is where fabricated results come from.

## Implemented

| Capability | Where | Notes |
|---|---|---|
| Define a flow as JSON | `WorkflowDefinitionSchema`, [`cli/src/types/workflow.ts`](../../cli/src/types/workflow.ts) | `{id, name, start_url, steps[]}`; step `kind` ∈ `goto`, `click`, `fill`, `wait`, `screenshot`, `ai` |
| Save / load / list / delete | `workflow-engine.ts` | Files at `config/workflows/<id>.json` |
| Import / export | `importWorkflowFromFile`, `exportWorkflow` | Import validates against the schema — this is the real lint |
| Preview a saved flow | `jstack workflow` CLI | Restates the definition; see [`output-preview-summary.md`](output-preview-summary.md) |

## Not implemented

| Missing | Consequence for what you may claim |
|---|---|
| **Any browser driver.** `runWorkflowStub` returns `ok: true` with one log line, unconditionally | A run is `unverified`, never a pass. `ok: true` is a placeholder, not a result |
| **Per-step outcomes** | You cannot report "step 4 ok". The stub emits no per-step data |
| **Screenshots / traces / report files** | There is no artifact to cite. "No artifact, no claim" is not caution here — it is the only available state |
| **Assertions** | No assert kind and no expectation field. `grep -rn assert cli/src/types/workflow.ts cli/src/lib/workflow-engine.ts` → nothing. Express checks as a `wait` on a state-unique selector |
| **`${ENV_VAR}` substitution** | Nothing expands them; the stub echoed `${STAGING_BASE_URL}/login` verbatim. The convention is still right — it keeps secrets out of a committed file — but do not claim a flow targeted a resolved URL |
| **Visual diffing** | This directory previously shipped an `output-visual-diff.md` with `before.png`/`after.png` marked "(fake)" and a "login button moved 2px" verdict. No pixel comparison exists anywhere in the codebase. That example was removed rather than kept as aspiration |

## The rule this boundary implies

The repo polices invented metrics everywhere else (`metrics invented → forbidden` in
`report-generator`; "never claim the run passed without an artifact" in the workflow skills). The stub
returning `ok: true` makes a green report the *easiest* thing to write and the least true. So:

> Report what the executor returned, verbatim, then say what it does and does not establish. If the
> honest answer is "the definition parses and nothing ran," that is the answer.

## When a driver lands

Regenerate [`output-execution-report.md`](output-execution-report.md) by actually running a flow and
pasting the result. Do not hand-write a plausible one — that is how this directory got into the state it
was in. Then revisit `SAFE_PATH` / `VALIDATION` for the `workflows/*` keys in
[`scripts/apply_detailed_skills_data.py`](../../scripts/apply_detailed_skills_data.py), which currently
tell the runner and execute skills to report `unverified`.

# Workflow execution report (example output)

This is what running a workflow **actually** returns today. Captured by actually running
`jstack workflow run eval-verify-smoke --yes --json` against a real (temporary, since-deleted) 2-step
definition, in an environment with no browser-automation MCP configured — not written by hand:

```json
{
  "id": "eval-verify-smoke",
  "ok": false,
  "log": [
    "No browser-automation tool (Playwright MCP or similar) is configured in this session — only GitHub, Jira/Confluence, and Lucid connector tools are available, none of which can drive a browser.\n\nPer the discipline instructions, I'm stopping here rather than simulating the run: **I cannot execute the \"Eval verification smoke\" workflow.** No step (`goto`, `screenshot`) was performed. If you want this run to actually happen, a Playwright (or equivalent) MCP server needs to be connected to this session first.",
    "unverified: no artifact was written under /path/to/jstack.core/artifacts/workflows/eval-verify-smoke -- a completed process is not evidence a browser ran anything; treating this as a non-pass regardless of what the agent's own report claimed."
  ]
}
```

So the only honest report is:

> **Flow:** `eval-verify-smoke` (2 steps)
> **Result:** `unverified` — no browser-automation MCP was configured, so no browser ran.
> **Evidence:** none. The executor is `runWorkflowViaClaude`
> ([`cli/src/lib/workflow-engine.ts`](../../cli/src/lib/workflow-engine.ts)): it spawns a nested agent
> instructed to drive a real browser via whatever browser-automation MCP is configured, and that agent
> correctly declined to simulate anything. `ok` came back `false` because `hasWorkflowArtifacts` found no
> file under `artifacts/workflows/eval-verify-smoke/` — the deterministic check this wrapper now applies
> instead of trusting either the subprocess's exit status or the nested agent's own prose.
> **What this does confirm:** the definition loaded and parsed against `WorkflowDefinitionSchema`, and the
> nested agent correctly refused rather than fabricating a pass. Nothing about the application under test.

## Why this file is written this way

An earlier version of this example reported **PASS** in bold, a 32s duration, four per-step `ok` marks,
and a `report-2026-04-25T160032Z.json` log file, captured against a hardcoded stub executor that returned
`ok: true` unconditionally with no browser at all. **None of that was ever producible.** That example was a
template for fabricating a green run — and `ok: true` coming back with no real check behind it makes the
fabrication easy to believe.

The stub is gone now — `runWorkflowViaClaude` spawns a real nested agent that can drive a real browser when
a browser-automation MCP is configured — but the same failure mode resurfaced one layer down: a live test of
this exact code, with no MCP configured, returned `ok: true` at the top level even though the nested agent's
own text plainly said nothing ran. The subprocess hadn't crashed, so the old code called that `ok`. That gap
is now closed (see `hasWorkflowArtifacts` in `workflow-engine.ts`), and the JSON above is what the fixed
code actually returns for the same scenario.

Two rules follow, enforced in `jstack:workflows-runner` and `jstack:workflows-execute`, and now also inside
`runWorkflowViaClaude` itself rather than only in the skills that consume its output:

1. **A completed process is not a pass.** `ok` is gated on a real artifact existing on disk, not on whether
   the claude subprocess exited without error and not on the nested agent's own claim.
2. **No artifact, no claim.** Never report a per-step outcome the runner did not emit. Two steps in the
   definition does not mean two steps ran.

When a browser-automation MCP is configured and a real run produces artifacts, this file should be
regenerated again with that output — not edited to look plausible. See
[`capability-boundary.md`](capability-boundary.md).

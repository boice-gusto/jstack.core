# Workflow definition (example input)

A complete, schema-valid browser workflow. This definition has been validated against
`WorkflowDefinitionSchema` in [`cli/src/types/workflow.ts`](../../cli/src/types/workflow.ts) — copy it as a
starting shape rather than inventing fields.

Definitions live at `config/workflows/<id>.json`. **JSON, not YAML** — `loadWorkflow` reads
`config/workflows/<id>.json` and parses it with the Zod schema, so a YAML file is simply never found.

```json
{
  "id": "smoke-staging-auth",
  "name": "Staging auth smoke",
  "steps": [
    { "id": "s1", "kind": "goto", "url": "${STAGING_BASE_URL}/login", "notes": "Base URL from env; never hardcode a host." },
    { "id": "s2", "kind": "wait", "selector": "[data-testid=login-form]", "notes": "Gate on the form existing before typing into it." },
    { "id": "s3", "kind": "fill", "selector": "[data-testid=email]", "value": "${STAGING_TEST_USER}" },
    { "id": "s4", "kind": "fill", "selector": "[data-testid=password]", "value": "${STAGING_TEST_PASSWORD}", "notes": "Env var. A literal here would be committed." },
    { "id": "s5", "kind": "click", "selector": "[data-testid=submit]" },
    { "id": "s6", "kind": "wait", "selector": "[data-testid=dashboard-root]", "notes": "Exists only when auth succeeded — this is the assertion, expressed as a wait." },
    { "id": "s7", "kind": "screenshot", "notes": "Evidence for the logged-in state." },
    { "id": "s8", "kind": "click", "selector": "[data-testid=logout]" },
    { "id": "s9", "kind": "wait", "selector": "[data-testid=login-form]", "notes": "Back to the form means the session was cleared." }
  ]
}
```

## Why it looks like this

**Every field is in the schema.** `WorkflowDefinition` is `{ id, name, steps[], created_at? }` -- no
separate `start_url`; the start URL is `steps[0].url` when that step is a `goto` (see
`workflowStartUrl()` in `cli/src/types/workflow.ts`). A step is
`{ id, kind, selector?, value?, url?, notes? }`. Nothing else validates.

**`kind` has exactly six legal values:** `goto`, `click`, `fill`, `wait`, `screenshot`, `ai`. There is
**no `assertions` field and no assert kind** — `grep -rn assert cli/src/types/workflow.ts
cli/src/lib/workflow-engine.ts` returns nothing. An earlier version of this example showed an "Expect"
column, describing a capability the schema has never had.

**Assertions are expressed as waits.** Step `s6` waits on `[data-testid=dashboard-root]`, a selector that
exists only once login succeeded. If it never appears, the step fails — that *is* the assertion. So every
meaningful check needs a selector unique to the desired state; a `wait` on something present in both
states asserts nothing.

**Every `click`/`fill` is preceded by a `wait` on its own selector** — `s2` before `s3`/`s4`, `s6` before
`s8`. A step that races the page is the defect that only ever reproduces in CI.

**Secrets are env references.** `${STAGING_TEST_PASSWORD}` names a variable; it is not a value. This file
gets committed, so a literal here is a leaked credential.

> **Substitution is not implemented yet.** `${...}` is the intended convention, but nothing in the current
> CLI expands it — the stub runner echoes `${STAGING_BASE_URL}/login` verbatim. Treat these as the contract
> for a future driver, and read [`capability-boundary.md`](capability-boundary.md) before promising a run.

## Validate before shipping one

```bash
bun run cli/src/index.ts workflow import <path>.json   # round-trips through the real schema
bun run cli/src/index.ts workflow list
```

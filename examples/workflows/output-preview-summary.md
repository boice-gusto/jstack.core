# Workflow preview (example output)

A preview restates the saved definition so a human can approve it before anything runs. It reports what
the file **says**, never what the run **would return** — the CLI has not executed anything at this point,
so it has no status codes and no page state to report.

**Flow:** `smoke-staging-auth` — "Staging auth smoke"
**Start URL:** `${STAGING_BASE_URL}/login` *(unexpanded — substitution is not implemented)*
**Steps:** 9

| # | id | kind | target | Note |
|---|----|------|--------|------|
| 1 | `s1` | `goto` | `${STAGING_BASE_URL}/login` | Base URL from env |
| 2 | `s2` | `wait` | `[data-testid=login-form]` | Gate before typing |
| 3 | `s3` | `fill` | `[data-testid=email]` | value ← `${STAGING_TEST_USER}` |
| 4 | `s4` | `fill` | `[data-testid=password]` | value ← `${STAGING_TEST_PASSWORD}` (masked) |
| 5 | `s5` | `click` | `[data-testid=submit]` | |
| 6 | `s6` | `wait` | `[data-testid=dashboard-root]` | The success check |
| 7 | `s7` | `screenshot` | — | Evidence |
| 8 | `s8` | `click` | `[data-testid=logout]` | |
| 9 | `s9` | `wait` | `[data-testid=login-form]` | Session cleared |

**Pre-run checks that a preview can honestly make** — all static, all readable from the file:

- Parses against `WorkflowDefinitionSchema`; every `kind` is one of the six legal values. ✅
- Every `click`/`fill` has a preceding `wait` on its own selector (`s2`→`s3`/`s4`, `s6`→`s8`). ✅
- No credential literals; both secret fills name env vars. ✅
- Env vars this flow needs, so a missing one fails before the browser opens, not halfway through:
  `STAGING_BASE_URL`, `STAGING_TEST_USER`, `STAGING_TEST_PASSWORD`.

**Not covered by this flow:** 2FA. If the target environment enforces it, `s6` will never see
`dashboard-root` and the flow fails at that step — extend it or scope it to a non-2FA account rather
than loosening `s6` to a selector that passes either way.

## Why there is no "Expect" column

An earlier version of this example had `Step | Action | Expect` with values like `200` and `session
empty`. The schema has no expectation field and the runner reports no status codes, so those columns
described a capability that does not exist. Expectations live in the `wait` selectors — see
[`input-flow-definition.md`](input-flow-definition.md).

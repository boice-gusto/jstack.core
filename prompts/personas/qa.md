# Persona: QA / Quality Advocate

> **Owner:** QA lead or engineering manager. Edit this to reflect your actual test infrastructure, coverage gaps, and release process.

## Lens

<!-- [CUSTOMIZE] Replace with your team's real testing situation -->

- **Your test infrastructure** — What exists today?
  <!-- Example: "Unit tests in Jest (80% coverage on API, 40% on frontend). Integration tests run in CI against a staging DB. No e2e tests yet — that's a known gap." -->
- **Your flaky tests** — Where is the pain?
  <!-- Example: "The checkout flow e2e flakes 15% of the time due to Stripe sandbox timeouts. We retry once and skip on second failure." -->
- **Your release process** — What gates exist?
  <!-- Example: "PR must pass CI. QA does manual regression on staging for anything touching payments or auth. Feature flags required for new user-facing features." -->

## Review style

<!-- [CUSTOMIZE] What does your QA team actually catch in reviews? -->
Name specific scenarios from your product, not abstract risks:
- "What happens when a user with 500 projects hits this page?" (your product's scale)
- "Does this handle the case where the Stripe webhook arrives before the redirect?" (your integration's race condition)
- "Will the existing `checkout.spec.ts` tests still pass, or do they need updating?"

## Your known gaps

<!-- [CUSTOMIZE] Be honest about where coverage is thin — this is where reviews matter most -->
```
- [ ] No e2e coverage for the mobile web flow
- [ ] Auth token refresh edge cases are manually tested only
- [ ] Webhook retry logic is untested for >3 failures
- [ ] No load testing for the reporting endpoint
```

## Release confidence checklist

<!-- [CUSTOMIZE] What your team actually checks before shipping -->
```
- [ ] CI green on the PR branch
- [ ] QA manual pass on staging (required for: payments, auth, data export)
- [ ] Feature flag configured (required for: new user-facing features)
- [ ] Monitoring alert exists for the new code path
- [ ] Rollback tested or documented
```

## Config hook

```json
{
  "personas": {
    "qa": {
      "ci_tool": "GitHub Actions",
      "coverage_target": "80% API, 60% frontend",
      "manual_regression_surfaces": ["payments", "auth", "data-export"],
      "known_flaky": ["checkout e2e"]
    }
  }
}
```

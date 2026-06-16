# SDLC gate policy

> **Owner:** Engineering manager or tech lead. Edit this to reflect YOUR team's actual gates — not aspirational ones, but what you actually enforce today.

## Gate definitions

<!-- [CUSTOMIZE] Replace entrance/exit criteria with what YOUR team actually requires at each stage -->

| Stage | Entrance criteria | Exit criteria | Evidence artifact |
|-------|-------------------|---------------|-------------------|
| **Dev** | <!-- Ticket with AC? Design doc approved? --> | <!-- PR reviewed? Unit tests? Lint? --> | PR link with approved review |
| **Test** | Dev gate passed | <!-- Integration tests? QA sign-off? --> | QA sign-off comment or test report |
| **Stage** | Test gate passed | <!-- Load test? No P1 bugs? Rollback tested? --> | Load test results or "N/A + justification" |
| **Prod** | Stage gate passed | <!-- Feature flag? Monitoring? Runbook? --> | Deploy ticket + monitoring dashboard link |

## Your gate rules

<!-- [CUSTOMIZE] These should reflect real decisions your team has made -->

- Gates cannot be skipped. If a gate must be bypassed, produce a **risk acceptance line**: who approved, what risk was accepted, and the mitigation plan.
- Every prod deploy must have a documented **revert plan** or kill-switch.
- <!-- [CUSTOMIZE] Feature flag policy: --> Feature flags are required for user-facing changes that cannot be safely reverted by rollback alone.
- <!-- [CUSTOMIZE] Hotfix path: --> Hotfixes skip to Stage gate but require retro review of the bypass.

## Environments

<!-- [CUSTOMIZE] Map to your actual environments -->

```
dev       → local + CI
test      → shared dev / preview deploys
staging   → staging.yourcompany.com (production data mirror? anonymized?)
production → yourcompany.com
```

## Bypass log

When a gate is bypassed, the agent must record:

| Field | Value |
|-------|-------|
| Gate bypassed | <!-- e.g., "Stage → Prod" --> |
| Approved by | <!-- name or role --> |
| Risk accepted | <!-- one sentence --> |
| Mitigation | <!-- what safety net is in place --> |
| Follow-up ticket | <!-- link --> |

## Config hook

```json
{
  "policies": {
    "sdlc": {
      "environments": ["dev", "test", "staging", "production"],
      "feature_flag_required": true,
      "hotfix_gate": "stage",
      "bypass_requires_approval_from": "EM or tech lead"
    }
  }
}
```

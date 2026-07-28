# SDLC gate policy

> **Maintainer:** Engineering manager or tech lead.

This file is injected verbatim into prompts. It contains no invented gate criteria or
environment names beyond what already ships in this repo's own templates — treat any
org-specific value not present in config or the conversation as unknown, and ask rather than
assume.

## Gate definitions

`policies.sdlc.stages` lists the stages in order (default: `plan`, `build`, `test`, `release`). `policies.sdlc.gates` holds the entrance/exit criteria per stage and ships empty. `templates/config/sdlc-templates.md` has three ready-to-use tiers (minimal, standard, strict) — copy one in rather than inventing criteria here. The standard tier, for reference:

| Stage | Requires (standard tier) | Evidence artifact |
|-------|---------------------------|--------------------|
| **plan** | No default gate in the standard tier — add one if design/spec review should block build | None by default |
| **build** | Ticket with acceptance criteria (`ticket_with_ac`) | Ticket link |
| **test** | PR approved and unit tests passing (`pr_approved`, `unit_tests_pass`) | PR link with approved review + green CI |
| **release** | QA sign-off, feature flag ready, monitoring configured (`qa_signoff`, `feature_flag_ready`, `monitoring_configured`) | Deploy ticket + monitoring dashboard link |

If `policies.sdlc.gates` is still empty when you need to check a gate, say so and ask what the team actually requires — don't assume the standard tier is in effect just because it's shown above.

## Your gate rules

- Gates cannot be skipped. If a gate must be bypassed, produce a **risk acceptance line**: who approved, what risk was accepted, and the mitigation plan.
- Every prod deploy must have a documented **revert plan** or kill-switch.
- Feature flags are required for user-facing changes that cannot be safely reverted by rollback alone.
- Hotfixes skip to the last stage before release but require a retro review of the bypass.

## Environments

```
dev        → local machine + CI
test       → shared or preview deploy environment
staging    → pre-production; treat as a production-data mirror only if your team has confirmed it's anonymized
production → the live environment serving real users
```

Environment names and URLs aren't set here — read them from the conversation or ask.

## Bypass log

When a gate is bypassed, the agent must record:

| Field | What to record |
|-------|-----------------|
| Gate bypassed | The stage transition skipped, e.g. "test → release" |
| Approved by | The person or role who accepted the risk |
| Risk accepted | One sentence describing what could go wrong |
| Mitigation | The safety net in place (monitoring, feature flag, rollback plan) |
| Follow-up ticket | Link to the ticket tracking the gap this bypass leaves open |

## Config hook

```json
{
  "policies": {
    "sdlc": {
      "stages": ["plan", "build", "test", "release"],
      "gates": {}
    }
  }
}
```

Both keys are declared in `config/defaults.json` and match the defaults shown. `gates` ships empty; populate per-stage `requires` arrays using `templates/config/sdlc-templates.md` as a starting shape.

## Adapting this file

Edit this file directly for gate rules, environment layout, and the bypass log format. Set `policies.sdlc.stages` and `policies.sdlc.gates` in `jstack.config.json` for the stage list and per-stage requirements this file deliberately doesn't hardcode.

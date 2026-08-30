# SDLC gate policy

> **Maintainer of this markdown file:** Engineering manager or tech lead. This is who edits
> *this document* when the team's gate rules change — it is not an org's real risk-acceptance
> approver, and must never be presented as one. Do not answer "who approves the bypass" or
> "who is empowered to accept this risk" with this line; that identity comes only from the
> conversation or `jstack.config.json`, and is unknown until one of those actually names it.

This file is injected verbatim into prompts. It contains no invented gate criteria or
environment names beyond what already ships in this repo's own templates — treat any
org-specific value not present in config or the conversation as unknown, and ask rather than
assume. This includes the feature-flag requirement below: it is conditional ("user-facing
changes that cannot be safely reverted by rollback alone"), not automatic — state it as a
question to confirm ("is this user-facing and not rollback-safe?"), never as an already-met
requirement, unless the conversation has actually established that the change meets it.

## Gate definitions

`policies.sdlc.stages` lists the stages in order (default: `plan`, `build`, `test`, `release`). `policies.sdlc.gates` holds the entrance/exit criteria per stage and ships empty. `templates/config/sdlc-templates.md` has three ready-to-use tiers (minimal, standard, strict) — copy one in rather than inventing criteria here.

**Before naming any specific gate requirement, check whether `policies.sdlc.gates` is actually populated in the conversation or config for this org.** If it is empty or unknown — the common case, since it ships empty — do not name any tier's specific criteria (not "QA sign-off," not "feature flag ready," not any other named requirement) as if they were this org's active policy. Say plainly that gates aren't configured for this org and require a generic, tier-agnostic risk-acceptance record instead (see "Your gate rules" and "Bypass log" below, neither of which names a specific tier). The table below exists so you know what a tier *could* contain if the team asks to set one up — reading it and then presenting its contents as this org's real requirement is exactly the fabrication this file exists to prevent, even though the numbers came from this file rather than from nowhere.

The standard tier, for reference only — not this org's policy unless `policies.sdlc.gates` confirms it:

| Stage | Requires (standard tier) | Evidence artifact |
|-------|---------------------------|--------------------|
| **plan** | No default gate in the standard tier — add one if design/spec review should block build | None by default |
| **build** | Ticket with acceptance criteria (`ticket_with_ac`) | Ticket link |
| **test** | PR approved and unit tests passing (`pr_approved`, `unit_tests_pass`) | PR link with approved review + green CI |
| **release** | QA sign-off, feature flag ready, monitoring configured (`qa_signoff`, `feature_flag_ready`, `monitoring_configured`) | Deploy ticket + monitoring dashboard link |

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

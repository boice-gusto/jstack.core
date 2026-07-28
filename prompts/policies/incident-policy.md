# Incident comms policy

> **Maintainer:** EM, SRE lead, or on-call manager.

This file is injected verbatim into prompts. It contains no invented SLA numbers, channel
names, or escalation chains — treat any org-specific value not present in config or the
conversation as unknown, and ask rather than assume.

## Severity definitions

`policies.incidents.severity_levels` lists the levels in use (default: `sev4`, `sev3`, `sev2`, `sev1`, low to high). Generic definitions for the common four:

| Severity | Definition |
|----------|-----------|
| **SEV1** | Full outage, data loss risk, or a failure with no workaround affecting most users |
| **SEV2** | Degraded performance or a partial outage with a workaround |
| **SEV3** | Minor bug or cosmetic issue with a workaround, not urgent |
| **SEV4** | Cosmetic or low-impact issue, no user-facing urgency |

Acknowledge SLAs and update cadence per severity live in `policies.incidents.escalation` (empty by default). `templates/config/incident-templates.md` has three ready-to-use tiers (startup, standard, enterprise) with concrete ack-time and cadence numbers — copy one in rather than inventing numbers here.

## Communication channels

Route by audience, not by a hardcoded channel name:

| Audience | Tone | Approved by |
|----------|------|-------------|
| Engineering | Technical, specific | On-call lead or incident commander |
| Company-wide | Clear, non-technical | EM, using `prompts/tones/internal.md` |
| Customer-facing | Empathetic, outcome-focused | Resolve via `approval_chains.chains.incident_external` (fallback `default`); apply `prompts/tones/executive.md` or the tone appropriate to the channel |

Actual channel names, status-page tools, and distribution lists aren't set here — ask the user or read them from the conversation.

## Escalation path

The chain of who gets paged and when is per-severity data, not prose in this file. It lives in `policies.incidents.escalation` — empty by default. If it's unset, ask the user for the actual on-call/escalation identities rather than guessing a chain of titles; don't fabricate a rotation. `templates/config/incident-templates.md` has concrete starter chains you can copy into config.

## Update template

Every incident update must include:
1. **Current status** — what's happening right now
2. **What changed** — since last update
3. **Next action** — what you're doing about it, and who
4. **ETA** — if known; "investigating" is acceptable early on

## Retro requirements

- Required whenever `policies.incidents.escalation.<severity>.retro_required` is `true` for the severity involved (the standard tier in `templates/config/incident-templates.md` sets this for SEV1/SEV2).
- Schedule it while the incident is still fresh — same week, before details fade — rather than waiting for a fixed deadline; treat any specific SLA your team has agreed to as an override of this default.
- Blameless — focus on systems, processes, and tooling.
- Must produce at least one action item with an owner and due date. File it via `integrations.jira.project_key` if configured; otherwise ask where it should live.

## What to never include in comms

- Root cause speculation before investigation is complete
- Individual names or blame
- Promises of timeline without evidence
- Internal tooling names in customer-facing comms

## Config hook

```json
{
  "policies": {
    "incidents": {
      "severity_levels": ["sev4", "sev3", "sev2", "sev1"],
      "escalation": {}
    }
  }
}
```

Both keys are declared in `config/defaults.json` and match the defaults shown. `escalation` ships empty; populate it per severity (`ack_minutes`, `update_cadence_minutes`, `retro_required`, ...) using `templates/config/incident-templates.md` as a starting shape.

## Adapting this file

Edit this file directly for definitions, tone, and comms guardrails. Set `policies.incidents.severity_levels` and `policies.incidents.escalation` in `jstack.config.json` for the data this file deliberately doesn't hardcode.

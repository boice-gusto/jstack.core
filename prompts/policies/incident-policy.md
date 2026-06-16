# Incident comms policy

> **Owner:** EM, SRE lead, or on-call manager. Edit this file to match your actual incident process — severity definitions, SLAs, channels, and escalation paths.

## Severity definitions

<!-- [CUSTOMIZE] Define what SEV1/2/3 mean in YOUR org. These should match your alerting thresholds. -->

| Severity | Definition | Response SLA | Update cadence |
|----------|-----------|--------------|----------------|
| **SEV1** | <!-- Example: >5% of requests failing, data loss risk, full outage --> | 15 min acknowledge | Every 30 min |
| **SEV2** | <!-- Example: Degraded performance, partial outage, <5% error rate --> | 1 hour acknowledge | Every 2 hours |
| **SEV3** | <!-- Example: Minor bug, cosmetic issue, workaround available --> | Next business day | At resolution |

## Communication channels

<!-- [CUSTOMIZE] Map to your actual Slack channels, email lists, and tools -->

| Audience | Channel | Tone | Approved by |
|----------|---------|------|-------------|
| Engineering | <!-- #incident or #sev1-war-room --> | Technical, specific | IC or on-call lead |
| Company-wide | <!-- #general or all-hands email --> | Clear, non-technical | EM + comms |
| Customer-facing | <!-- Status page URL, support email --> | Empathetic, outcome-focused | PM + legal review |

## Escalation path

<!-- [CUSTOMIZE] Who gets paged when? Replace with your actual rotation. -->

```
SEV1 path: On-call IC → On-call lead → EM → VP Eng → CTO (if >1h unresolved)
SEV2 path: On-call IC → On-call lead → EM (if >4h unresolved)
SEV3 path: Owner files ticket, no escalation
```

## Update template

Every incident update must include:
1. **Current status** — what's happening right now
2. **What changed** — since last update
3. **Next action** — what you're doing about it, and who
4. **ETA** — if known; "investigating" is acceptable early on

## Retro requirements

<!-- [CUSTOMIZE] Your actual retro process -->
- Mandatory for SEV1/SEV2 within <!-- [CUSTOMIZE] 48h? 72h? --> of resolution
- Blameless — focus on systems, processes, and tooling
- Must produce at least one action item with an owner and due date
- Template location: <!-- [CUSTOMIZE] link to your retro template -->

## What to never include in comms

<!-- [CUSTOMIZE] Add org-specific restrictions -->
- Root cause speculation before investigation is complete
- Individual names or blame
- Promises of timeline without evidence
- Internal tooling names in customer-facing comms
- <!-- Add your own... -->

## Config hook

```json
{
  "policies": {
    "incident": {
      "sev1_ack_minutes": 15,
      "sev2_ack_minutes": 60,
      "retro_deadline_hours": 48,
      "incident_channel": "#incident",
      "status_page_url": "https://status.yourcompany.com"
    }
  }
}
```

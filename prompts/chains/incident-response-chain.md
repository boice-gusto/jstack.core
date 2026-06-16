# Chain: Incident response

> **Owner:** EM, SRE lead, or on-call manager. Edit this to match your actual incident response flow, channels, and retro process.

**Flow:** `jstack:incident` → `jstack:announcements` (comms draft) → `jstack:incident-retro`

## Steps

1. **Incident commander** — classify severity per `prompts/policies/incident-policy.md`, establish timeline, identify impacted customers/services. Output: status update (internal Slack + status page if customer-facing).
2. **Comms draft** — internal and (if customer-facing) external announcements. Use tone from `prompts/tones/executive.md` for external, `prompts/tones/internal.md` for team. **Draft only — never post without approval.**
3. **Retro** — after stabilization, facilitate blameless retrospective. Output: timeline, impact assessment, improvements, and action items with owners and due dates.

## Handoff rules

- Severity drives update cadence per incident policy.
- Comms must go through review per `prompts/policies/review-policy.md` before external posting.
- Retro is not optional for SEV1/SEV2. Schedule within the deadline set in incident policy.

## Your customizations

<!-- [CUSTOMIZE] Adapt these to your team's actual incident process -->

| Setting | Default | Your value |
|---------|---------|------------|
| Incident channel | #incident | <!-- Your Slack channel --> |
| Status page tool | Manual | <!-- Statuspage? Instatus? PagerDuty? --> |
| Retro facilitator | On-call lead | <!-- Who runs your retros? --> |
| Action item tracker | Jira | <!-- Where do retro action items live? --> |

## Config hook

```json
{
  "chains": {
    "incident_response": {
      "incident_channel": "#incident",
      "status_page": "statuspage",
      "retro_facilitator": "on-call lead",
      "action_item_project": "OPS"
    }
  }
}
```

# Chain: Incident response

> **Maintainer:** EM, SRE lead, or on-call manager.

This file is injected verbatim into prompts. It contains no invented channel names, tool
names, or facilitator identities — treat any org-specific value not present in config or the
conversation as unknown, and ask rather than assume.

**Flow:** `jstack:incident` → `jstack:announcements` (comms draft) → `jstack:incident-retro`

## Steps

1. **Incident commander** — classify severity per `prompts/policies/incident-policy.md`, establish timeline, identify impacted customers/services. Output: status update (internal Slack + status page if customer-facing).
2. **Comms draft** — internal and (if customer-facing) external announcements. Use tone from `prompts/tones/executive.md` for external, `prompts/tones/internal.md` for team. **Draft only — never post without approval.**
3. **Retro** — after stabilization, facilitate blameless retrospective. Output: timeline, impact assessment, improvements, and action items with owners and due dates.

## Handoff rules

- Severity drives update cadence per incident policy.
- Comms must go through review per `prompts/policies/review-policy.md` before external posting.
- Retro is not optional for SEV1/SEV2. Schedule within the deadline set in incident policy.

## Defaults and overrides

None of these have a dedicated config key today — they're either resolved from existing config or left to the conversation:

| Setting | Where it comes from |
|---------|----------------------|
| Incident channel, status page tool | Not modeled in config; use what's already in use for the active incident, or ask |
| Retro facilitator | Defaults to the on-call lead unless the user names someone else |
| Action item tracker | `integrations.jira.project_key` if configured; otherwise ask where to file it |

## Config hook

There's no dedicated config section for this chain. Its behavior comes from `policies.incidents` (severity, escalation — see `prompts/policies/incident-policy.md`) and `policies.review` / `approval_chains` (comms approval — see `prompts/policies/review-policy.md`). Adjust those, or edit this file's steps directly.

## Adapting this file

Edit this file directly to change the step order, add a step, or hardcode a channel/tool/facilitator your team always uses. For severity and escalation data, use `policies.incidents` in `jstack.config.json` instead.

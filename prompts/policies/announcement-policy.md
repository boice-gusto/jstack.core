# Announcement policy

> **Owner:** PM or comms lead. Edit this to define how YOUR team classifies, drafts, and publishes announcements.

## Audience classification

Every announcement must be classified before drafting:

<!-- [CUSTOMIZE] Replace examples with your actual announcement types -->

| Type | Audience | Channels | Examples |
|------|----------|----------|----------|
| **Internal** | Team or company | <!-- #eng, #general, all-hands --> | Sprint updates, team changes, internal tool launches |
| **External** | Customers, public | <!-- Blog, email, status page, social --> | Product launches, pricing changes, incident updates |
| **Partner** | Integration partners, resellers | <!-- Partner Slack, email list --> | API changes, deprecation notices |

## Draft workflow

1. **Classify audience** — ask once if unclear.
2. **Select tone** — pull from `prompts/tones/` for the target channel.
3. **Draft** — output as `[DRAFT]` for user review.
4. **Review gate** — external or partner announcements require review per `prompts/policies/review-policy.md`.
5. **Never post directly** — posting requires explicit user action or a linked skill with approval.

## Approval matrix

<!-- [CUSTOMIZE] Who approves what? This is the key org-specific value of this file. -->

| Announcement type | Approver(s) | Notes |
|-------------------|------------|-------|
| Internal team update | Author (self-serve) | No gate needed |
| Company-wide internal | EM or PM lead | Esp. for reorgs, policy changes |
| Customer-facing product | PM + marketing | Legal review if pricing/terms |
| Incident external comms | PM + legal | Per incident-policy.md |
| Partner/API changes | PM + eng lead | Minimum 30-day notice for breaking changes |

## Content guardrails

<!-- [CUSTOMIZE] Add your org's specific restrictions -->

- Never leak unreleased product detail in external copy unless the user explicitly confirms external audience.
- `@here` / `@channel` only with user approval for important-level messages.
- Legal/compliance content (pricing, terms, data handling): flag for stakeholder review before finalization.
- <!-- [CUSTOMIZE] Embargo rules? Partner NDAs? --> 

## Config hook

```json
{
  "policies": {
    "announcements": {
      "internal_channels": ["#eng", "#general"],
      "external_channels": ["blog", "email"],
      "breaking_change_notice_days": 30,
      "external_requires_approval": ["PM", "marketing"]
    }
  }
}
```

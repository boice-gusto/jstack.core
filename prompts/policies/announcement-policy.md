# Announcement policy

> **Maintainer:** PM or comms lead.

This file is injected verbatim into prompts. It contains no invented channel names, approver
names, or notice periods — treat any org-specific value not present in config or the
conversation as unknown, and ask rather than assume.

## Audience classification

Every announcement must be classified before drafting:

| Type | Audience | Examples |
|------|----------|----------|
| **Internal** | Team or company | Sprint updates, team changes, internal tool launches |
| **External** | Customers, public | Product launches, pricing changes, incident updates |
| **Partner** | Integration partners, resellers | API changes, deprecation notices |

Target channels aren't hardcoded here. Read `policies.announcements.channels`; if it's empty, ask the user which channel to post to before drafting.

## Draft workflow

1. **Classify audience** — ask once if unclear.
2. **Select tone** — pull from `prompts/tones/` for the target channel.
3. **Draft** — output as `[DRAFT]` for user review.
4. **Review gate** — external or partner announcements require review per `prompts/policies/review-policy.md`.
5. **Never post directly** — posting requires explicit user action or a linked skill with approval.

## Approval

Announcements are not self-approved by default (`policies.announcements.approval_required` is `true`). Resolve who approves from `approval_chains.chains` (see `skills/_core/references/approval-chains.md`): use the `external_comms` chain for anything customers, partners, or the public will see, and `policy_change` for internal policy or reorg announcements. If the action type isn't defined in `approval_chains.chains`, fall back to `chains.default` (`["author"]` unless configured otherwise). If a role in the chain has no team member mapped to it, ask the user who fills it — do not invent a name or title. If `approval_required` is set to `false`, internal-only announcements may be self-serve; external and partner announcements still resolve through the chain above regardless of that flag.

## Content guardrails

- Never leak unreleased product detail in external copy unless the user explicitly confirms external audience.
- `@here` / `@channel` only with user approval for important-level messages.
- Legal/compliance content (pricing, terms, data handling): flag for stakeholder review before finalization.
- If the announcement could touch an embargo, NDA, or partner agreement, ask the user for its terms before drafting — do not assume one exists or doesn't.

## Config hook

```json
{
  "policies": {
    "announcements": {
      "approval_required": true,
      "channels": []
    }
  },
  "approval_chains": {
    "chains": {
      "external_comms": ["author", "PM", "legal"]
    }
  }
}
```

`policies.announcements.approval_required` and `policies.announcements.channels` are declared in `config/defaults.json` and match the defaults shown. `approval_chains.chains` is declared there too (default: `{"default": ["author"]}`); the `external_comms` chain above is an example shape from `skills/_core/references/approval-chains.md`, not a value that ships by default — define it if you want a named chain instead of falling back to `default`.

## Adapting this file

Edit this file directly to add real channel names, examples, or guardrails specific to your org. For approvals, set `policies.announcements.channels` and `approval_chains.chains.external_comms` / `.policy_change` in `jstack.config.json` rather than hardcoding approver names here.

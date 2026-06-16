# Approval chains

Reusable approval chain templates. Skills that need approval (announcements, incidents, deploys, policy changes) inject this ref via `!cat` and resolve the chain from config.

## How skills use this

1. Read `config.approval_chains` for the active chain definitions.
2. If `approval_chains` is not configured, trigger the config wizard (`_core/references/config-wizard.md`) to set one up.
3. Match the action type to a chain. If no match, use `default`.

## Config shape

```json
{
  "approval_chains": {
    "template": "scaleup",
    "chains": {
      "default":           ["author"],
      "external_comms":    ["author", "PM", "legal"],
      "incident_external": ["IC", "EM", "legal"],
      "deploy_prod":       ["author", "reviewer", "EM"],
      "policy_change":     ["author", "EM", "VP"],
      "pricing_terms":     ["PM", "legal", "CFO"],
      "hiring":            ["EM", "VP"]
    }
  }
}
```

## Predefined templates

Pick one as a starting point, then customize the chains that don't fit.

### Startup (flat)

Small team, low ceremony. Most things are self-serve.

| Action | Chain |
|--------|-------|
| `default` | author |
| `external_comms` | author → PM |
| `incident_external` | IC → founder |
| `deploy_prod` | author → reviewer |
| `policy_change` | author → founder |

### Scaleup

Multiple teams, some process, but still fast.

| Action | Chain |
|--------|-------|
| `default` | author |
| `external_comms` | author → PM → marketing |
| `incident_external` | IC → EM → legal |
| `deploy_prod` | author → reviewer → EM |
| `policy_change` | author → EM → VP |
| `pricing_terms` | PM → legal → CFO |

### Enterprise

Compliance-heavy, multi-layer approval, audit trail required.

| Action | Chain |
|--------|-------|
| `default` | author → manager |
| `external_comms` | author → PM → legal → comms |
| `incident_external` | IC → EM → legal → VP → comms |
| `deploy_prod` | author → reviewer → EM → change board |
| `policy_change` | author → EM → VP → legal |
| `pricing_terms` | PM → legal → CFO → board |
| `hiring` | EM → VP → HR → finance |
| `data_export` | author → DPO → legal |

## Resolution rules

When a skill needs approval:

1. Look up the action type in `config.approval_chains.chains`.
2. If the action type isn't defined, use `default`.
3. Walk the chain left to right. Each step is a role, not a person.
4. Map roles to people using `config.team.members` (match by `role` field).
5. If a role has no matching team member, flag it: "No one with role `legal` in config. Ask user who approves."
6. Output the chain as a checklist:
   ```
   Approval chain for external_comms:
   - [ ] author (@alice)
   - [ ] PM (@bob)  
   - [ ] legal — ⚠️ no team member with this role configured
   ```

## Overriding at runtime

Users can override any chain inline: "skip legal for this one." The skill should:
- Acknowledge the override.
- Note it in output: `[override: legal skipped per user request]`.
- Not persist the override to config (it's a one-time bypass).

## Anti-patterns

- Hardcoding approval chains in skill files instead of reading from config.
- Auto-approving on behalf of a role (skills draft, humans approve).
- Skipping the chain silently when a role is unmapped.
- Requiring approval for read-only or internal-only actions.

# Review policy

> **Maintainer:** PM, EM, or documentation lead.

This file is injected verbatim into prompts. It contains no invented reviewer names or SLA
numbers — treat any org-specific value not present in config or the conversation as unknown,
and ask rather than assume.

## When review is required

| Category | Trigger | Reviewer(s) |
|----------|---------|-------------|
| External comms | Anything customers, public, or the board will see | Resolve via `approval_chains.chains.external_comms` (fallback `default`) |
| Binding decisions | ADRs, SOP changes, policy updates | Resolve via `approval_chains.chains.policy_change` (fallback `default`) |
| Eval-adjacent | Reports used in a performance or evaluation context | The personas in `policies.review.counsel_roles` (default: ceo, pm, engineer, qa, designer) plus the subject's manager |

Add rows for other trigger categories as your team hits them — every new row needs a real reviewer, not a placeholder.

## Review process

1. Author produces a draft and marks it `[DRAFT]`.
2. Reviewer applies relevant persona lens(es) from `prompts/personas/`, chosen from `policies.review.counsel_roles`.
3. Review output uses three verdicts:
   - **Approve** — good to publish/ship
   - **Revise** — with specific edits (not "make it better")
   - **Block** — with a reason and what would unblock it
4. Every review must name at least one specific **strength** and one specific **improvement**. Generic praise ("looks good!") is not a review.
5. Treat the work as reviewed once it has `policies.review.required_approvals` Approve verdicts (default: 1).

## Turnaround SLAs

There's no dedicated config key for review turnaround, so use this default and override it in conversation when your team has agreed to something else:

| Priority | Review SLA |
|----------|-----------|
| Blocking release | Same day |
| Standard | Next business day |
| Low priority | Best effort, no fixed deadline |

## Disagreement resolution

- If two reviewers disagree, synthesize the tensions and present them to the author for a decision.
- If the content involves legal, compliance, or pricing, flag for stakeholder review before any publish action.
- If synthesis doesn't resolve it, escalate along the relevant `approval_chains.chains` entry for that category (or `default` if none applies). Ask the user to name an escalation contact if the chain has no one mapped.

## Config hook

```json
{
  "policies": {
    "review": {
      "required_approvals": 1,
      "counsel_roles": ["ceo", "pm", "engineer", "qa", "designer"]
    }
  }
}
```

Both keys are declared in `config/defaults.json` and match the defaults shown. `required_approvals` sets how many Approve verdicts close out a review; `counsel_roles` sets which persona lenses from `prompts/personas/` apply by default.

## Adapting this file

Edit this file directly to add trigger categories, sharpen the SLA table, or change the disagreement path. Set `policies.review.required_approvals` and `policies.review.counsel_roles` in `jstack.config.json` to change approval count and default persona lenses without touching this file.

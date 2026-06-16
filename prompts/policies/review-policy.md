# Review policy

> **Owner:** PM, EM, or documentation lead. Edit this to define what requires review in YOUR org, who reviews it, and what counts as a real review.

## When review is required

<!-- [CUSTOMIZE] Define your actual review triggers -->

| Category | Trigger | Reviewer(s) |
|----------|---------|-------------|
| External comms | Anything customers, public, or board will see | PM + <!-- [CUSTOMIZE] legal? marketing? --> |
| Binding decisions | ADRs, SOP changes, policy updates | Tech lead + EM |
| Eval-adjacent | Reports used in performance or evaluation context | EM + skip-level |
| <!-- [CUSTOMIZE] Add your own --> | | |

## Review process

1. Author produces a draft and marks it `[DRAFT]`.
2. Reviewer applies relevant persona lens(es) from `prompts/personas/`.
3. Review output uses three verdicts:
   - **Approve** — good to publish/ship
   - **Revise** — with specific edits (not "make it better")
   - **Block** — with a reason and what would unblock it
4. Every review must name at least one specific **strength** and one specific **improvement**. Generic praise ("looks good!") is not a review.

## Turnaround SLAs

<!-- [CUSTOMIZE] What your team has actually agreed to -->

| Priority | Review SLA |
|----------|-----------|
| Blocking release | <!-- Same day? 4 hours? --> |
| Standard | <!-- 1 business day? --> |
| Low priority | <!-- 3 business days? --> |

## Disagreement resolution

<!-- [CUSTOMIZE] How does your team actually resolve conflicts? -->
- If two reviewers disagree, synthesize the tensions and present them to the author for a decision.
- If the content involves legal, compliance, or pricing, flag for stakeholder review before any publish action.
- Escalation path: <!-- [CUSTOMIZE] e.g., "Author → Tech lead → EM → VP" -->

## Config hook

```json
{
  "policies": {
    "review": {
      "external_requires": ["PM", "legal"],
      "standard_sla_hours": 24,
      "blocking_sla_hours": 4,
      "escalation_path": ["author", "tech_lead", "EM"]
    }
  }
}
```

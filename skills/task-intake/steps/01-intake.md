# Step 1: Intake

Capture the core request from the user with structured discovery questions.

## Questions to Ask

Use `AskQuestion` for structured collection where possible, fall back to conversational prompts.

### Required Fields

1. **Title** — Short descriptive name for the task (used as ticket summary)
2. **Description** — What is being requested? What problem does this solve?
3. **Requestor** — Who is asking for this? (name, team, or Slack handle)
4. **Type** — What kind of work is this?
   - Options: Bug Fix, Feature, Enhancement, Tech Debt, Investigation, Documentation, Other
5. **Acceptance Criteria** — How will we know this is done? (list of conditions)

### Optional Fields

6. **Business Justification** — Why does this matter now? Revenue impact, compliance, user pain?
7. **Stakeholders** — Who else needs to be informed or consulted?
8. **Known Constraints** — Deadlines, dependencies, environment limitations?
9. **Related Work** — Links to existing tickets, PRs, Slack threads, or docs
10. **Desired Timeline** — When is this expected/needed?

## Collection Strategy

Ask questions in batches to reduce round-trips:

- Batch 1: Title, Description, Type (these seed everything else)
- Batch 2: Requestor, Acceptance Criteria, Business Justification
- Batch 3: Stakeholders, Constraints, Related Work, Timeline (optional — skip if user declines)

## Output Schema

```json
{
  "intake": {
    "title": "",
    "description": "",
    "requestor": "",
    "type": "",
    "acceptanceCriteria": [],
    "businessJustification": "",
    "stakeholders": [],
    "constraints": [],
    "relatedWork": [],
    "desiredTimeline": ""
  }
}
```

## Handling Incomplete Input

If the user provides a one-liner like "we need to fix the carrier order sync," extract what you can and ask targeted follow-ups for missing required fields only. Do not force the user through questions they've already answered.

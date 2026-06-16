# Step 7: Scheduling

Assign the task to a sprint, milestone, or time window based on priority and sizing.

## Scheduling Process

1. Ask the user for current sprint/milestone context:
   - What sprint are we in?
   - What is the next available sprint?
   - Are there any capacity constraints?
2. Recommend placement based on priority + sizing:
   - P0/P1 → current sprint if capacity allows, else next sprint
   - P2 → next sprint or backlog
   - P3 → backlog with periodic review
3. Check for blocking dependencies from context/research
4. Present recommendation and allow override

## Dependency Check

If `context.dependencies` or `research.crossObjectEffects` contain items:

- Surface blockers that must be resolved first
- Suggest sequencing if multiple related tasks exist
- Flag if dependent work is in a different team's backlog

## Sprint Fit Assessment

Based on sizing estimate:

- XS/S → fits easily in any sprint
- M → fits in most sprints, check remaining capacity
- L → may need to be sole focus of a sprint
- XL/XXL → spans multiple sprints, recommend decomposition first

## Jira Update

If a ticket exists:

- Update sprint field via `editJiraIssue` (if sprint ID is available)
- Add fix version / milestone label
- Add comment noting scheduling rationale

## Output Schema

```json
{
  "schedule": {
    "targetSprint": "",
    "targetMilestone": "",
    "blockers": [],
    "sequencingNotes": "",
    "rationale": ""
  }
}
```

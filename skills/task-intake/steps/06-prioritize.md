# Step 6: Prioritization

Assess priority using weighted factors from config, producing a recommended priority level with justification.

## Prioritization Process

1. Load priority scale and factors from `config.priority`
2. For each factor, ask the user to rate (or suggest based on context):
   - Use `AskQuestion` with options: Critical / High / Medium / Low
3. Apply weights to compute an overall score
4. Map score to priority level

## Factor Assessment

Present each factor with context from earlier steps:

### Business Impact (weight: 3)

- Revenue or compliance implications from `intake.businessJustification`
- Customer-facing vs internal

### Urgency (weight: 3)

- Timeline constraints from `intake.desiredTimeline`
- External deadlines (regulatory, carrier, partner)

### Dependencies (weight: 2)

- Does this block other work?
- Are there upstream dependencies from `context.dependencies`?

### Technical Risk (weight: 1)

- From `research.riskAssessment.overallRisk`
- Coupling to high-risk hotspots

### Effort (weight: 1)

- From `sizing.estimate` — larger effort may lower urgency if no hard deadline

## Scoring

Map user ratings to numeric values: Critical=4, High=3, Medium=2, Low=1.
Multiply each by its weight. Sum weighted scores.

| Total Score | Priority    |
| ----------- | ----------- |
| 30-40       | P0-Critical |
| 20-29       | P1-High     |
| 12-19       | P2-Medium   |
| 1-11        | P3-Low      |

Present the computed priority with a one-line justification. Allow the user to override.

## Jira Update

If a ticket exists, update priority field via `editJiraIssue`.

## Output Schema

```json
{
  "priority": {
    "level": "",
    "score": 0,
    "factorScores": {
      "business_impact": 0,
      "urgency": 0,
      "dependencies": 0,
      "risk": 0,
      "effort": 0
    },
    "justification": "",
    "userOverride": false
  }
}
```

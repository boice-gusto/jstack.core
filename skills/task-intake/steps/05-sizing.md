# Step 5: Sizing

Estimate effort using the configured sizing scale, informed by context and research findings.

## Sizing Process

1. Load sizing scale from `config.sizing`
2. Present the user with sizing options using `AskQuestion`
3. If research was completed, suggest an estimate based on:
   - Number of files/objects impacted
   - Complexity of execution paths
   - Test coverage requirements
   - Risk level from research assessment
4. Record the estimate and rationale

## Sizing Factors

Consider and surface these when suggesting a size:

| Factor                 | Weight | Signal                                   |
| ---------------------- | ------ | ---------------------------------------- |
| Files impacted         | High   | Count from context.relatedFiles          |
| Cross-object effects   | High   | Count from research.crossObjectEffects   |
| New vs modification    | Medium | New code is typically more predictable   |
| Test requirements      | Medium | Bulk tests, mock tests, negative paths   |
| Risk level             | Medium | From research.riskAssessment.overallRisk |
| Prior art availability | Low    | Similar past work reduces unknowns       |

## Confidence Levels

Attach a confidence level to every estimate:

- **High** — Research completed, similar prior art exists, clear scope
- **Medium** — Context gathered, some unknowns remain
- **Low** — Limited investigation, significant unknowns, suggest spike first

## Auto-Suggestion Logic

If research step was completed:

- `impactRadius: low` + `overallRisk: low` → suggest S or M
- `impactRadius: medium` + `overallRisk: medium` → suggest M or L
- `impactRadius: high` or `overallRisk: high` → suggest L or XL
- XXL → always recommend decomposition into sub-tasks

## Jira Update

If a ticket was created in step 4, update it with the story points:

- Use `editJiraIssue` to set the story points field from config
- Add a comment with the sizing rationale

## Output Schema

```json
{
  "sizing": {
    "estimate": "",
    "points": 0,
    "confidence": "high|medium|low",
    "rationale": "",
    "decompositionNeeded": false
  }
}
```

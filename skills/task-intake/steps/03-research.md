# Step 3: Research

Deep-dive investigation for tasks that touch complex, unfamiliar, or high-risk areas. This step is optional and should be suggested when context reveals significant complexity.

## When to Recommend This Step

- The change touches high-risk or widely shared modules
- Multiple components, services, or data stores may be impacted
- No prior documentation or similar tickets were found in the context phase
- The request involves unfamiliar integrations, async flows, or security-sensitive paths

## Research Activities

### Execution tracing

1. Trace the primary code path from entry point to observable outcomes
2. Identify state transitions, events, or transactions that matter for your stack (e.g. webhooks, DB triggers, message handlers)
3. Map cross-module or cross-service side effects
4. Note feature flags, kill switches, or conditional behavior

### Prior art

5. Review closed tickets for similar work — approach, pitfalls, outcomes
6. Search internal docs / wiki for design decisions
7. Search team chat for past decisions on the topic
8. Review recent git history for impacted files

### Risk assessment

9. Assess impact radius — breadth of code, data, and integrations affected
10. Note runtime or platform limits relevant to your stack (query volume, payload size, API quotas, batch sizes)
11. Check for sensitive data exposure on affected paths
12. Note downstream consumers, contracts, or SLA implications

### Skills to chain

Invoke as available in the host workspace:

- `codebase-researcher` — systematic cross-reference analysis
- `code-explainer` — execution traces and sequence diagrams
- Any stack-specific architecture or standards skills installed for your org (see plugin catalog)

## Output schema

```json
{
  "research": {
    "executionTrace": "",
    "triggerContexts": [],
    "crossObjectEffects": [],
    "priorArt": [
      { "source": "jira|confluence|slack|git", "reference": "", "summary": "" }
    ],
    "riskAssessment": {
      "impactRadius": "low|medium|high",
      "runtimeLimitConcerns": [],
      "piiPhiExposure": false,
      "integrationImpact": [],
      "overallRisk": "low|medium|high"
    },
    "recommendations": [],
    "openQuestions": []
  }
}
```

`triggerContexts` and `crossObjectEffects` are generic bags for stack-specific detail; rename in presentation if your domain uses different vocabulary.

## Presentation

Present findings as:

1. **Execution summary** — paragraph describing the path and outcomes
2. **Risk matrix** — risk factors with severity
3. **Recommendations** — ordered list of suggested approaches
4. **Open questions** — items needing human input or org verification

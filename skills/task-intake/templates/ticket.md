## Summary

{{intake.title}}

## Description

{{intake.description}}

## Type

{{intake.type}}

## Business Justification

{{intake.businessJustification}}

## Acceptance Criteria

{{#each intake.acceptanceCriteria}}

- [ ] {{this}}
      {{/each}}

## Technical Context

### Impacted Files

{{#each context.relatedFiles}}

- `{{this.path}}` ({{this.type}}, relevance: {{this.relevance}})
  {{/each}}

### Related Objects

{{#each context.impactedObjects}}

- {{this}}
  {{/each}}

### Dependencies

{{#each context.dependencies}}

- {{this}}
  {{/each}}

{{#if research}}

## Research Findings

**Impact Radius**: {{research.riskAssessment.impactRadius}}
**Overall Risk**: {{research.riskAssessment.overallRisk}}

### Execution Summary

{{research.executionTrace}}

### Execution contexts

{{#each research.triggerContexts}}

- {{this}}
  {{/each}}

### Risk Notes

{{#each research.riskAssessment.runtimeLimitConcerns}}

- {{this}}
  {{/each}}

### Recommendations

{{#each research.recommendations}}

1. {{this}}
   {{/each}}

### Open Questions

{{#each research.openQuestions}}

- [ ] {{this}}
      {{/each}}
      {{/if}}

## Related Tickets

{{#each context.relatedTickets}}

- {{this.key}}: {{this.url}} — {{this.summary}} ({{this.status}})
  {{/each}}

## Related Documentation

{{#each context.relatedDocs}}

- {{this.title}}: {{this.url}} ({{this.source}})
  {{/each}}

{{#if sizing}}

## Sizing

**Estimate**: {{sizing.estimate}} ({{sizing.points}} points)
**Confidence**: {{sizing.confidence}}
**Rationale**: {{sizing.rationale}}
{{/if}}

{{#if priority}}

## Priority

**Level**: {{priority.level}}
**Justification**: {{priority.justification}}
{{/if}}

---

_Requestor_: {{intake.requestor}}
_Stakeholders_: {{#each intake.stakeholders}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
_Constraints_: {{#each intake.constraints}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
_Desired Timeline_: {{intake.desiredTimeline}}

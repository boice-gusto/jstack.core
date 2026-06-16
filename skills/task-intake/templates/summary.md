# Intake Summary: {{intake.title}}

## Request

| Field     | Value                      |
| --------- | -------------------------- |
| Title     | {{intake.title}}           |
| Type      | {{intake.type}}            |
| Requestor | {{intake.requestor}}       |
| Timeline  | {{intake.desiredTimeline}} |

## Description

{{intake.description}}

## Acceptance Criteria

{{#each intake.acceptanceCriteria}}

- [ ] {{this}}
      {{/each}}

## Artifacts Created

| Artifact                        | Link               |
| ------------------------------- | ------------------ | ----------------------------------------------- | ------- |
| {{#if ticket}}                  | Jira Ticket        | {{ticket.jiraKey}} — {{ticket.jiraUrl}}        | {{/if}} |
| {{#if ticket.notionPageUrl}}    | Notion Page        | {{ticket.notionPageUrl}}                | {{/if}} |
| {{#if announce.primaryChannel}} | Slack Announcement | {{announce.primaryChannel.messageLink}} | {{/if}} |

## Context

- **Files impacted**: {{context.relatedFiles.length}}
- **Objects impacted**: {{#each context.impactedObjects}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
- **Related tickets**: {{context.relatedTickets.length}}

{{#if research}}

## Research

- **Impact radius**: {{research.riskAssessment.impactRadius}}
- **Overall risk**: {{research.riskAssessment.overallRisk}}
- **PII/PHI exposure**: {{research.riskAssessment.piiPhiExposure}}
  {{/if}}

## Estimates

| Dimension        | Value    |
| ---------------- | -------- | ----------------------------------------------------------------------------- | ------- |
| {{#if sizing}}   | Size     | {{sizing.estimate}} ({{sizing.points}} pts, {{sizing.confidence}} confidence) | {{/if}} |
| {{#if priority}} | Priority | {{priority.level}}                                                            | {{/if}} |
| {{#if schedule}} | Sprint   | {{schedule.targetSprint}}                                                     | {{/if}} |

{{#if research.openQuestions}}

## Open Questions

{{#each research.openQuestions}}

- [ ] {{this}}
      {{/each}}
      {{/if}}

## Next Steps

1. Review ticket and acceptance criteria with stakeholders
2. Refine sizing if confidence is low
3. Begin implementation or schedule spike if unknowns remain

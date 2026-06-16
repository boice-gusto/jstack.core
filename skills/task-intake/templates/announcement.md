_New Task Intake_: {{intake.title}}

_Type_: {{intake.type}}
_Requestor_: {{intake.requestor}}
{{#if ticket}}_Ticket_: <{{ticket.jiraUrl}}|{{ticket.jiraKey}}>{{/if}}
{{#if sizing}}_Size_: {{sizing.estimate}} (confidence: {{sizing.confidence}}){{/if}}
{{#if priority}}_Priority_: {{priority.level}}{{/if}}

> {{intake.description}}

{{#if intake.acceptanceCriteria}}
_Acceptance Criteria_:
{{#each intake.acceptanceCriteria}}
• {{this}}
{{/each}}
{{/if}}

{{#if schedule}}_Target_: {{schedule.targetSprint}}{{/if}}
{{#if intake.desiredTimeline}}_Timeline_: {{intake.desiredTimeline}}{{/if}}

{{#if intake.stakeholders}}
_cc_: {{#each intake.stakeholders}}{{this}} {{/each}}
{{/if}}

_{{announcements.footer}}_

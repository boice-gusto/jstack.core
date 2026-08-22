# JIRA CRUD conventions

Cross-cutting rules for the write-side Jira skills (`create`, `update`, `transition`, `append`),
complementing [`field-metadata.md`](./field-metadata.md)'s API-metadata resolution.

## Create

- **Dup-check before creating.** Search for an existing issue matching the same summary/component
  in the target project before opening a new one — silently creating a duplicate is a worse
  failure than asking one clarifying question first.
- **Templates:** use `templates/jira/*.json` for the create/intake payload shape rather than
  hand-building fields inline; it keeps required-field coverage consistent across projects.
- **Config-driven defaults:** apply `jira_rules` (component, label, and assignee defaults) from
  `jstack.config.json` — never hardcode a project's conventions in skill prose.

## Update

- **Confirm before sensitive-field changes** (assignee, priority, due date, status-adjacent
  custom fields) — an update skill silently reassigning or reprioritizing on ambiguous intent is
  a real-world failure mode, not a hypothetical one.
- **Comment vs. field edit:** prefer a comment for narrative context; only edit a field when the
  user's intent to change that specific field is unambiguous.

## Transition

- **Resolve the transition id from the API's own allowed-transitions response, never from
  memory or a guessed name.** "Done" and "In Progress" map to different transition ids per
  project/workflow; apply `jira_rules.transitions` from config as a hint only, not as authoritative.
- **Apply `jira_rules` from config before transitioning** (required-field-on-transition screens,
  resolution values) so the transition doesn't fail partway through with the issue left in an
  inconsistent state.

## Append

- **Idempotent, same-day de-dupe:** before appending a structured block (meeting notes, checklist,
  update), check whether an equivalent block was already appended today — repeated automated
  appends from a retried or re-triggered skill call should not pile up duplicate content.

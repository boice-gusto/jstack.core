# Intake — deep dive (jstack-intake)

## When to use

- **Turn a fuzzy request** (Slack, email, meeting note) into a structured brief before Jira/Notion or prioritization.
- You need **one canonical intake artifact** for triage.
- **Out of scope:** Executing the work or automatically filing tickets without user confirmation of fields.

## Process

1. **Capture** — who asked, deadline, business outcome, raw text.
2. **Clarify** — one question at a time until blocker fields are known (`question-patterns.md`).
3. **Classify** — bug vs feature vs chore vs request; set rough size if policy requires (T-shirt or points).
4. **Dependencies** — teams, systems, approvals; flag legal/comms if public impact.
5. **Route** — suggest `jstack:jira-create`, `jstack:notion-*`, or `jstack:review-*` with a handoff block.

## Best practices

- **Link** to source conversation when allowed; never paste secrets or PII into examples.
- State **assumptions** in plain text; prefer config defaults for project keys and components.
- If multiple requests are bundled, **split** or ask the user to pick the first.

## Anti-patterns

- Creating a ticket in the wrong project because it was “faster.”
- Accepting “ASAP” without a real date or tradeoff conversation.

## Examples

**Weak:** “User wants the dashboard improved.”  
**Strong:** “Requester: PM X. Outcome: reduce time-to-insight for weekly metrics. In scope: new summary strip; out: export CSV. Suggested component: Web/Dashboard. [assumption] Due EOQ. Next: jstack:jira-intake for PROJ.”

## Templates

- `templates/config/sdlc-templates.md` — when intake ties to SDLC or release train.
- Jira/Notion field maps live in `jstack.config.json` and integration guides, not here.

## Chaining

- **To** `jstack:prioritize` — when multiple intakes need ordering.
- **To** `jstack:jira-intake` / `jstack:jira-create` — when ready to file.
- **To** `jstack:recon` — when the intake is “organize my week” from many sources.

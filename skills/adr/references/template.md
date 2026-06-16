# Markdown ADR template (repo-local)

Copy and fill; remove optional sections if empty.

```markdown
# ADR NNN: <short title>

| Field | Value |
|-------|-------|
| **Status** | Proposed \| Accepted \| Deprecated \| Superseded |
| **Kind** | engineering \| design \| team \| codebase \| org |
| **Date** | YYYY-MM-DD |
| **Supersedes** | (optional: ADR-XXX or link) |
| **Superseded by** | (optional: ADR-YYY or link) |

## Context

What forces this decision? Link issues, incidents, metrics, or prior discussions.

## Decision

State the decision in one tight paragraph, then bullets if needed.

## Options considered

| Option | Pros | Cons |
|--------|------|------|
| A | | |
| B | | |

## Consequences

**Positive:** …  
**Negative / tradeoffs:** …  
**Follow-ups:** (tasks, owners, timelines — link tickets if possible)

## Examples (optional)

Short snippets, diagrams-as-text, or links to PRs — only what aids future readers.

## References

- …
```

## Status meanings

- **Proposed** — Under discussion; not yet team-approved.
- **Accepted** — Team agrees this is the current stance.
- **Deprecated** — No longer recommended; prefer successors for new work.
- **Superseded** — Replaced by another ADR; keep file for history and link both ways.

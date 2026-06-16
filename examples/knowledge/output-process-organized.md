# Processed knowledge (example output)

## Decision

- **Adopt UUID v7** for new public identifiers across services
- **No new** auto-increment external IDs
- **ULID** in one worker = **legacy**; new code should not add ULID

## Implications

- Migrations: plan for new columns / dual-write where old ids exposed
- API docs: update “ID format” section

## Confidence

**High** (explicit team decision) · **Source:** synthetic Slack paste

## Suggested storage

- ADR in Notion / KB — link to RFC in drive

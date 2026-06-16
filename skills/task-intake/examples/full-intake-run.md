# Example: full task intake run

## User request

> Intake a new task: add retry logic when our batch HTTP API returns partial failures (some sub-requests succeed, others fail).

## Wizard execution

### Phase 0: Setup

Config loaded. User enables all steps except schedule.

### Phase 1: Intake

```json
{
  "intake": {
    "title": "Retry only failed sub-requests in batch HTTP client",
    "description": "When the batch endpoint returns a mixed result, the client should retry only failed items instead of failing the whole batch.",
    "requestor": "Alex (Platform)",
    "type": "Enhancement",
    "acceptanceCriteria": [
      "Failed sub-requests are identified and retried up to 3 times",
      "Successful sub-requests are not re-sent",
      "Retries are logged with correlation IDs",
      "After max retries, a ticket is created for manual review"
    ],
    "businessJustification": "Batch failures block downstream processing for a large customer cohort",
    "stakeholders": ["Platform", "Ops"],
    "constraints": ["Must stay within published API rate limits"],
    "desiredTimeline": "Next sprint"
  }
}
```

### Phase 2: Context

- Located `BatchHttpClient.ts`, `RetryPolicy.ts`
- Related tickets and an internal design doc on batch patterns

### Phase 3: Research

- Traced execution path through the batch client
- Identified retry boundary at sub-request level
- Risk: elevated call volume on large batches (runtime / rate limits)
- Recommendation: exponential backoff with configurable max retries

### Phase 4: Ticket

Created `PROJ-1234` in Jira with full context, research, and acceptance criteria.

### Phase 5: Sizing

Estimate: **M** (1–2 days, 3 points), confidence: high.

### Phase 6: Prioritize

Priority: **P2-Medium**.

### Phase 8: Announce

Posted to `#engineering` with ticket link. Draft reviewed before sending.

### Summary

```
Intake Summary: Retry only failed sub-requests in batch HTTP client

Ticket: PROJ-1234 (https://example.atlassian.net/browse/PROJ-1234)
Size: M (3 points, high confidence)
Priority: P2-Medium
Announced: #engineering
Open questions: none
```

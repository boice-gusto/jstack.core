# Recon: Slack scan (example input)

## Request

Run recon on **#eng-alerts** for the **last 48 hours**. Summarize P1s, who is on point, and any stale threads that need a nudge. Slack export pasted below (fake).

## Paste (synthetic)

```
[2026-04-25 09:01] @alex: P1- DB replica lag in us-west-1 — @jordan on call
[2026-04-25 09:15] @jordan: failing over read traffic, ETA 20m
[2026-04-25 10:20] @alex: P1 clear — root cause: bad deploy, rolled back
[2026-04-25 11:00] @sam: can someone pick up the stale PR #4412 (auth)?
```

## Constraints

- No Jira; Slack only
- Output must be suitable for standup

# Incident retro notes (example output)

**INC:** INC-2026-0425-01 · **Status:** closed

## Impact

- **User-visible:** ~18 minutes elevated 5xx on `/v1/users` in **us-west-1**
- **SLO burn:** small; no breach

## Root cause

- **Bad deploy** `v2.3.1` increased DB read load; replica lag tripped circuit breaker behavior

## What went well

- Fast rollback; on-call + SM communication in **#eng-alerts** stayed tight

## What to improve

- [ ] **Deploy gates:** require **canary in one region** before full prod
- [ ] **Runbook:** add explicit replica lag check to deploy checklist
- [ ] **Metrics:** alert on **replication lag** with lower threshold in prod

## Owners

- @platform-infra — deploy gate task (this sprint)
- @sre — runbook + alert tuning (next sprint)

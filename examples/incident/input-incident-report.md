# Incident report (example input)

**ID:** INC-2026-0425-01  
**Severity:** P1 (resolved)  
**Window:** 2026-04-25 09:00–10:20 UTC

## Timeline (synthetic)

- 09:01 Replica lag in us-west-1; elevated error rate on `/v1/users`
- 09:10 Failover + rollback of deploy `v2.3.1`
- 10:00 Error rates normalized
- 10:20 P1 closed

## Ask

Draft a concise postmortem-style summary: impact, root cause, remediation, follow-ups

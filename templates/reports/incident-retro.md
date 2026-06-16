# Incident retro — {{incident_id}}

<!-- report_kind = incident-retro. Link `links[]` to incident doc, Jira, postmortem PR. Blameless tone. -->

## Timeline

**UTC** (or state timezone). **Short** rows: time, event, actor/system.

- **T+0** — Pager: elevated error rate on **checkouts** (`/api/v1/...`) — on-call **@name** paged.
- **T+12m** — **Rollback** completed to `release/1.2.0`; error rate to baseline.
- **T+45m** — **Customer** comms in **#incidents-YYYY-MM-DD**; status page updated.

## Root cause

**Technical** and **contributing** factors (e.g. missing test, config drift). **5 Whys** summary optional as sub-bullets.

- **RC:** **Null** in tax calc when `region` missing — **defensive** check missing in **PR-789**.
- **Contributing:** **E2E** did not cover **empty region**; **canary** sample too narrow.

## What went well

2–4 bullets. **Specific** (tools, people, playbooks).

- **Rollback** under **SLO**; runbook was accurate.
- **Comms** lead rotated daily summary without duplicating on-call work.

## What to improve

2–4 bullets; pair each with a **concrete** follow-up in the table below if possible.

- **Canary** gating: add **synthetic** empty-region case before 100% promote.
- **On-call** runbook: add **one-click** link to last known good deploy.

## Action items

| Item | Owner | Due |
|------|-------|-----|
| Add E2E for empty `region` | @name | YYYY-MM-DD |
| Update canary gate checklist | @name | YYYY-MM-DD |
| Blameless retro notes published | @name | YYYY-MM-DD |

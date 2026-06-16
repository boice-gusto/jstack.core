# Team weekly — {{team_name}}

<!-- Map to JSON: meta.title, meta.subtitle (e.g. week range), meta.report_kind = team-weekly -->
<!-- Sections: highlights, risks, metrics, next (ids optional but help automation) -->

## Highlights

Use 3–6 bullets. Each bullet: **outcome** + optional **evidence** (ticket, metric, release note).

- Shipped **feature X** to 100% of users; error rate flat vs. baseline (`DASH-123`).
- **On-call:** 0 Sev1; one P3 triaged to backlog with customer comms sent.
- Closed **tech debt** item: removed legacy flag `old_auth` after 2-week bake.

## Risks

State **what could go wrong**, **owner**, **next decision date** if applicable. No vague “might slip”.

- **Vendor API** June breaking change — **@owner** tracking RFC; go/no-go by **May 15**.
- **Capacity:** two engineers OOO next week; **scope freeze** on net-new; only P0/P1 exceptions.

## Metrics snapshot

Prefer a **small table** (3–5 rows). Same metrics week-over-week when possible.

| Metric        | This week | Target / SLO | Notes        |
|---------------|-----------|----------------|--------------|
| Deploys       | 12        | —              | All green CI |
| Sev1 count    | 0         | 0              | —            |
| MTTR (incident) | 45m    | < 60m          | Within SLO   |

## Next week focus

Numbered **commitments** (3–5 max). Verbs first.

1. Roll **flag Y** to 10% canary; **kill switch** drill with on-call.
2. Publish **runbook** for dependency migration; review in staff eng office hours.
3. **Customer X** beta exit criteria doc — DRI **@name**.

## Links (optional in JSON `links[]`)

- Sprint / board, incident ticket, design doc, dashboard — not repeated in every section.

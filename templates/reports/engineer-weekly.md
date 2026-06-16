# Engineer weekly — {{author}}

<!-- meta.report_kind = engineer-weekly, meta.subtitle = week of YYYY-MM-DD -->

## Shipped

What **merged** or **reached production** this week. Titles, not a diary.

- Merged **PR-456**: pagination fix for list endpoint; behind flag `list_v2` (off by default).
- Released **hotfix 1.2.3** for null ref in checkout; monitored 24h, no regression spike.

## In progress

Active PRs or branches; **link or ticket**; ETA only if real.

- **auth refresh** (ABC-90): 80% done; open question on token lifetime — **sync with security Friday**.
- **spike** on queue migration: notes in `docs/queue-spike.md`; go/no-go next week.

## Blockers

**What you need** from whom, or **decision** outstanding. If none, say **None** (one word).

- **None** — or: Waiting on **infra** for new Redis instance (REQ-12); no workaround without capacity.

## Learnings

One or two **concrete** takeaways: tool, API, or process. Skip generic “communicate more”.

- Learned **X** library’s rate limit is per-key, not per-account — updated client wrapper tests.
- **Postmortem** from Tuesday deploy: we’ll add a **smoke check** before promoting canary.

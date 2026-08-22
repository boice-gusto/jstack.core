# Jira scan patterns

- **Bound by the resolved time window, not by default project sort order.** Use a JQL date filter matching recon's Intake step 2 window (e.g. `updated >= -7d`, `updated >= startOfWeek()`) rather than trusting an issue list's default ordering to cut off at the right point.
- **Filter by project key and status category explicitly** rather than by individual status name — status names vary by project/board; status *category* (To Do / In Progress / Done) is stable across projects and is what "what's stale" and "what's open" questions actually mean.
- **"Stale" needs an explicit threshold**, not a feeling — state the threshold you used (e.g. "no update in 5+ business days") so the reader can tell a real staleness signal from a normal weekend gap.
- **Discussed ≠ done.** A comment mentioning a fix, or a linked PR, is not the same as the issue's status reflecting completion — report the issue's actual status field, and separately note if the comments/links suggest it's further along than the status shows.
- **Bounded result sets.** A JQL search has a page size; treat a full page as a signal to check for more, not as "that's everything" — state how many issues you found and whether you fetched all pages within the time budget.
- **Never assume a project key.** Confirm it via the search results or `jstack.config.json`'s configured projects — an invented or guessed project key produces a query that will look successful (zero results) while silently searching nothing real.

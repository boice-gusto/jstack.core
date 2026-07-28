"""
Deep domain content for the sprint ceremony cluster, the team/project/engineering
category-root skills, the knowledge capture skills, and meeting prep.

Each entry overrides CATEGORY_DEEP for its own key (key-first lookup in
apply_detailed_skills.py), so these nine skills carry real domain depth — thresholds,
named anti-patterns, worked examples — without moving to SKIP and losing generation.

`team`, `project`, and `engineering` are category-root SKILL.md files, but none of the
three is a pure router: unlike `knowledge`, `sprint`, and `meetings` (which are
`effort: low` and carry an explicit "Sub-skills (pick the most specific)" routing
section), these three are `effort: high` and do the analytical work directly in their
own generated body — `team` produces the roster/ownership snapshot itself, `project`
produces the RAG/risk/ask status itself, and `engineering` produces the CI/PR/flaky/
revert-risk roll-up itself. They therefore get full Tier-A analysis depth here, not
router-appropriate depth.

Owns exactly: sprint/planning, sprint/prep, sprint/refinement, team, project,
engineering, knowledge/self-knowledge, knowledge/team-knowledge, meetings/prepare.
"""
from __future__ import annotations

DEEP: dict[str, str] = {
    "sprint/planning": """
## Domain rules — sprint-planning

### Absolute rules
1. Planning ends with exactly one testable, falsifiable sprint goal ("ship X, verified by Y") — a pasted list of ticket keys with no goal statement is a scope dump, not a plan; nobody can tell mid-sprint whether the sprint is on track.
2. Commit to **this sprint's actual capacity** (available days after PTO, holidays, on-call), never to trailing average velocity unchanged — a team down two people for the sprint that still commits to its 6-sprint average is planning against a team that doesn't exist this cycle.
3. An item that arrives at planning without meeting Definition of Ready (clear, testable, feasible in one sprint) consumes planning time re-deriving scope live. That is a refinement failure surfacing in the wrong ceremony — flag it, don't quietly absorb it.
4. Planned WIP must not exceed what Little's Law implies the team can sustain (WIP = throughput × cycle time) — committing more in-flight items than that relationship supports means the plan is already assuming a faster cycle time than the team has ever hit.
5. Estimates draw on this team's own historical cycle time/velocity on comparable work (a reference class), never a bare gut/expert-feel number — an estimate with no comparison class is optimism bias wearing a number, not planning.
6. Story points stay an internal planning input. The moment velocity is reported externally as a productivity KPI, it predictably drifts into a target people learn to game (Goodhart) rather than a sizing tool.
7. Spillover from the prior sprint is classified as scope growth, underestimation, or blockage before being re-committed — recommitting it unchanged just re-runs whichever failure caused the miss.

### Thresholds
| Signal | Threshold | Source |
|---|---|---|
| Conservative commit ceiling | ≤80% of calculated capacity | [Tempo — How to Calculate Sprint Capacity](https://www.tempo.io/blog/how-to-calculate-sprint-capacity) |
| On-call capacity discount | roughly -50% of available days for the person on rotation | [Tempo](https://www.tempo.io/blog/how-to-calculate-sprint-capacity) |
| Focus factor (nominal → deliverable days) | 0.6–0.7 after meetings/ceremonies | [Tempo](https://www.tempo.io/blog/how-to-calculate-sprint-capacity) |
| WIP per person | 1.5–2.5 items in progress | [Multiboard — Effective WIP limits](https://www.multiboard.dev/posts/effective-setting-wip-limits) |

### Named anti-patterns
| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Goal-as-ticket-list | No falsifiable statement of success; mid-sprint status has nothing to check against | State one testable sprint goal; tickets are the plan to reach it |
| Committing to average velocity unadjusted | Ignores this sprint's actual PTO/on-call/holidays | Compute this sprint's capacity explicitly, discount known absences |
| Recommitting spillover unchanged | Repeats whatever caused the miss without fixing it | Classify cause (scope/underestimation/blockage); re-scope before recommitting |
| Gut-feel estimate with no comparison class | Optimism bias — the outside view is empirically more accurate | Estimate against this team's own historical cycle time on similar work |
| Publishing velocity outside the team as a KPI | Drives predictable gaming once it's a target, not a measure | Keep velocity internal; report flow metrics (cycle time, throughput) externally |

### Worked example
- *Weak:* "We're committing to 40 points this sprint, that's our average velocity."
- *Sharp:* "Capacity: 3 engineers × 8 days × 0.65 focus factor ≈ 15.6 person-days, minus 2 PTO days and one on-call rotation (-50% for that engineer) ≈ 12.4 effective person-days. Trailing 3-sprint velocity is ~2.2 pts/person-day → commit ceiling ~27 points at the 80% conservative discount. Sprint goal: 'Ship CSV export end-to-end, verified by the checklist in TICKET-101.' Two items spilled last sprint: one blocked on an API dependency now resolved (re-committing as-is), one underestimated 3x (re-scoped into two items before recommitting, not re-added unchanged)."

### Scope edge — how the three sprint ceremonies differ
Prep decides **what enters the refinement queue and in what order**. Refinement makes each item **individually estimable and sprint-ready** (the five-question walkthrough, AC, dependency check). Planning takes only items already meeting Definition of Ready and turns them into **this sprint's committed, testable goal and plan**. If planning has to invent acceptance criteria or resolve an open dependency live, that is a refinement failure leaking into planning — flag it, don't silently do refinement's job here. Planning does not curate the backlog queue (`jstack:sprint-prep`) and does not run the refinement conversation (`jstack:sprint-refinement`); it also never bulk-moves Jira issues into the sprint without explicit user confirmation.
""",
    "sprint/prep": """
## Domain rules — sprint-prep

### Absolute rules
1. Prep's output is a **curated, prioritized queue for refinement** — it is not refinement itself. Writing acceptance criteria or estimates here duplicates a ceremony that exists specifically to get the whole team's input, and produces criteria nobody else reviewed.
2. Every item entering the queue carries a rough owner and a stated why-now; an item with neither cannot be prioritized honestly, and unranked backlog rot degrades trust in the whole queue.
3. Stale items (no activity beyond the configured staleness window — pull the actual figure from `skill_defaults`, default commonly 30 days) are flagged explicitly with the last-touched date, never silently reordered lower as if that were a deliberate deprioritization.
4. A vague item is named by its specific missing piece — no AC, no owner, unclear dependency — never labeled with a generic "needs more detail" that gives refinement nothing to start from.
5. A suggested new ticket for a coverage gap is a **proposal**, not a created ticket — prep hands the payload to `jstack:jira-intake`; it never silently commits a new backlog item on its own authority.
6. The queue covers more than exactly one sprint's worth of refined-adjacent work — queuing only one sprint's depth leaves zero buffer, so any prep delay turns refinement into a scramble under time pressure.

### Thresholds
| Signal | Threshold | Source |
|---|---|---|
| Stale-item flag | no update beyond the configured window (commonly 30 days) — read from `skill_defaults.sprint_prep`, don't invent a number if one is configured | shape only; org-specific |
| Queue depth vs. cadence | queue more than 1 sprint's worth of candidate-ready items | buffers refinement against a slipped prep cycle |
| Owner/why-now coverage | 100% of queued items carry a rough owner and a stated reason | prevents unranked rot from degrading trust in the queue |
| New-ticket proposals | 0 tickets created directly by this skill; all routed as payloads | keeps ticket creation on its own reviewed chain |

### Named anti-patterns
| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Raw backlog straight to planning | Planning absorbs derivation time understanding each item live, burning the ceremony meant for committing | Run prep first so refinement (and then planning) gets curated material |
| Writing AC/estimates in prep | Duplicates refinement without the team's input; produces unreviewed criteria | Flag the gap; the clarifying conversation happens in refinement |
| Silently reordering stale items | Looks like an intentional call when it's actually neglect | Flag staleness explicitly with the last-touched date |
| Creating tickets directly for gaps | Bypasses the reviewed ticket-creation chain | Propose a ticket payload for `jstack:jira-intake` |
| Queuing exactly one sprint's depth | Zero buffer — any prep delay becomes an under-fire refinement session | Queue more than the immediate next sprint's worth |

### Worked example
- *Weak:* "Backlog looks fine, pull the top 10 tickets for refinement."
- *Sharp:* "Of the top 15 items: 9 have an owner and a stated why-now — queued for refinement. 3 are stale (no update >30 days, oldest since 2026-04-02) — flagged, not silently dropped. 2 lack both AC and an owner — named as the specific gap, not 'needs detail.' 1 coverage gap found: no ticket exists yet for the reported CSV-export timeout — proposing a payload for `jstack:jira-intake` rather than creating it directly. Priority order for refinement: [9 ranked items]."

### Scope edge — how the three sprint ceremonies differ
Prep decides what and in what order enters the refinement queue. It does not run the five-question refinement walkthrough (`jstack:sprint-refinement`) and does not commit a sprint goal or plan (`jstack:sprint-planning`). If prep starts asking refinement's five questions per ticket or estimating items, that is scope creep into refinement's job, not additional prep work.
""",
    "sprint/refinement": """
## Domain rules — sprint-refinement

### Absolute rules
1. Every ticket is walked through the same five questions (what / why / acceptance criteria / dependencies / estimate) before being marked ready — skipping straight to an estimate produces a confident number on a scope nobody has actually clarified.
2. Estimate comes **last**, after AC and dependencies are answered, never first — an estimate given before the scope is clear just anchors the team to a number with nothing yet to check it against.
3. A ticket exits refinement as "sprint-ready" only once it meets Definition of Ready — clear, testable, feasible within a sprint. An item marked ready with an unresolved dependency is not ready, it is optimistic.
4. An item too large for the estimation scale in use (for example, ≥13 on a Fibonacci-like scale, or larger than a typical sprint) is split before any single number is assigned — one estimate on heterogeneous, poorly understood scope hides that it's actually several items.
5. Bulk Jira writes from a refinement session require explicit user confirmation before applying — refinement produces a proposed diff (status, estimate, AC updates), not a silent batch edit across many tickets.
6. The capacity snapshot is shown alongside the sprint-ready checklist — refining items in isolation from actual room in the coming sprint(s) produces a "ready" pile the team can't act on yet.

### Thresholds
| Signal | Threshold | Source |
|---|---|---|
| Five-question completion | 5 of 5 answered before "ready" | Definition of Ready convention — [Scrum.org, Ready or Not?](https://www.scrum.org/resources/blog/ready-or-not-demystifying-definition-ready-scrum) |
| Estimate ordering | AC + dependencies answered before an estimate is recorded | prevents anchoring on an unscoped guess |
| Mandatory-split threshold | item sized ≥13 (Fibonacci-like scale) or larger than typical sprint capacity | forces decomposition before a single number is assigned |
| Bulk-write confirmation | 0 unconfirmed multi-ticket writes | keeps refinement notes auditable and undoable |

### Named anti-patterns
| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Estimate-first refinement | Anchors the team on a guess before scope is clear; AC gets written afterward to justify the number | Walk AC/dependencies/owner first, estimate last |
| Marking "ready" with an open dependency | "Ready" becomes aspirational; planning inherits the surprise later | Only mark ready once the dependency is resolved or explicitly scheduled |
| Silent bulk Jira updates from notes | Applies many estimate/status changes with no confirm step, hard to audit or undo | Present as a proposed diff; confirm before writing |
| Giant unsplit epic given one estimate | A single number can't represent heterogeneous, poorly understood scope | Split above the size threshold before estimating any piece |
| Refining with no capacity shown | Team can't tell whether the ready pile even fits the coming sprint | Show a capacity snapshot next to the sprint-ready checklist |

### Worked example
- *Weak:* "TICKET-204: refine — team says 5 points, done."
- *Sharp:* "TICKET-204 — (1) what: add CSV export to the reports page; (2) why: top support request this quarter; (3) AC: export matches on-screen filters, downloads <5MB in <3s; (4) deps: none, confirmed against the export-service roadmap; (5) estimate: 5 points, given only after 1–4 were answered. Marked sprint-ready. Contrast: TICKET-205 has no AC and an unconfirmed dependency on the billing team — held back from 'ready' despite a team member's gut '3 points'; estimate deferred until the dependency is confirmed."

### Scope edge — how the three sprint ceremonies differ
Refinement makes individual items estimable and sprint-ready. It does not decide queue order or flag staleness (`jstack:sprint-prep`'s job) and it does not decide what actually gets committed into a sprint or the sprint goal (`jstack:sprint-planning`'s job). If refinement starts negotiating which ready items get pulled into this sprint versus the next, that decision belongs to planning, not refinement.
""",
    "team": """
## Domain rules — team snapshot

### Absolute rules
1. Every listed area or component has a named individual owner. An area marked "TBD" or left blank is not neutral — it is unowned, and an unowned area is exactly where an incident finds nobody positioned to respond.
2. Bus factor is reported **per critical area**, not only as a team-wide aggregate — a healthy-looking headcount of 8–12 can still contain one critical module only one person can touch.
3. On-call coverage and area ownership are reported as two separate facts. The person on rotation this week is not automatically the deep owner of every area they get paged for; conflating the two hides the real concentration risk.
4. Never rank, score, or stack-rank individual contributors in this snapshot — it is a structural map (roster, ownership, on-call, dependencies), not a performance signal, and smuggling one in destroys trust in the skill.
5. When roster data is stale beyond the configured refresh window, say so explicitly rather than presenting an out-of-date roster as current — org changes (transfers, backfills) routinely outpace a cached snapshot.
6. A cross-team dependency without a named counterpart owner on the other side is reported as an unresolved risk, not treated as a completed handoff.

### Thresholds
| Signal | Threshold | Source |
|---|---|---|
| Bus factor on a critical area | ≤2 = high risk · 5+ = well distributed | [Bus factor — Wikipedia](https://en.wikipedia.org/wiki/Bus_factor); [Laws of Software Engineering — Bus Factor](https://lawsofsoftwareengineering.com/laws/bus-factor/) |
| Named-owner coverage | 100% of listed areas/components carry a named owner; gaps are reported, not filled with a guess | structural completeness check |
| Roster staleness | flag if unrefreshed beyond the configured window (commonly 30–90 days) — pull the actual figure from config | shape only; org-specific |
| Cross-team dependency resolution | every dependency line names a counterpart owner on the other team, or is flagged open | prevents an unresolved handoff from reading as complete |

### Named anti-patterns
| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Listing "the team" as an area's owner | A team name is not an accountable person; diffusion of responsibility slows response | Name one accountable individual per area, even if others contribute |
| Treating on-call as ownership | On-call this week ≠ deep expertise in the module being paged for | Report ownership and on-call as separate columns |
| Team-wide bus factor only | Hides a single-owner critical module inside a large, healthy-looking team | Report bus factor per critical area/component |
| Presenting a stale roster as current | Misleads on-call routing and escalation decisions | Show last-refreshed date; flag anything past the staleness window |
| Stack-ranking members inside a "snapshot" | Turns a structural view into an unrequested performance judgment | Keep the snapshot to roster, ownership, on-call, dependencies only |

### Worked example
- *Weak:* "The team has 8 engineers and things are going well."
- *Sharp:* "Roster (8 engineers, last refreshed 2026-07-20). Billing area — owner: [name], bus factor 1 (single committer/reviewer, trailing 6 months) — flagged high risk. Notifications area — owner: [name], bus factor 3 — healthy. On-call this week: [name], Notifications rotation — not the Billing owner, so a Billing incident this week would page someone without deep context. Cross-team dependency: Payments API migration blocked on Platform team; no counterpart owner confirmed on their side — flagged open, not resolved."

### What this skill must not do
- Does not evaluate individual performance or produce a stack-rank — structural snapshot only.
- Does not decide remediation staffing (pairing schedules, hiring, backfill) — it surfaces the gap for a human to act on.
- Does not perform the code-level concentration analysis with churn and fan-in weighting — that deeper investigation is `jstack:engineering-silo-scan`; this skill names bus factor at the roster level only.
""",
    "project": """
## Domain rules — project status

### Absolute rules
1. RAG color must trace to a stated, pre-agreed threshold (schedule/budget variance, milestone slip) — never assigned from narrative tone. If no threshold exists yet, say that explicitly instead of picking a color from a feeling.
2. A status carried over unchanged for a full reporting cycle with no new evidence is reported as Amber, not the prior color — silence is itself a signal, not confirmation that nothing changed.
3. A schedule slip names exactly one of three causes — scope growth, underestimation, or blockage — never a bare "behind schedule." Each cause implies a different fix, and a blended line hides which one applies.
4. A status must never jump directly from Green to Red between two consecutive reports. If the underlying evidence already crossed a Red-level threshold, the prior report should have shown Amber; a Green-to-Red jump is itself a reporting failure to name, separate from the schedule issue.
5. A milestone is marked "done" only once it resolves to a specific artifact or link — accepting verbal confirmation with nothing to point to is a guess dressed as a status.
6. Every risk and every ask to leadership carries a named owner — an ask with no owner gives leadership nothing to act on.

### Thresholds
| Signal | Threshold | Source |
|---|---|---|
| Schedule variance | Green ≤5% behind plan · Amber 5–15% · Red >15% with no approved recovery plan | [ClearPoint Strategy — RAG status for KPIs](https://www.clearpointstrategy.com/blog/establish-rag-statuses-for-kpis) |
| Budget variance | Green ≤10% over · Amber 10–20% · Red >20% | [ClearPoint Strategy](https://www.clearpointstrategy.com/blog/establish-rag-statuses-for-kpis) |
| Stale-status window | no new evidence for 1 full reporting cycle → report Amber, not the prior color | pattern documented in status-reporting failure analyses |
| Milestone evidence | 100% of "done" milestones resolve to a named artifact/link, not verbal confirmation | completeness check |

### Named anti-patterns
| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Watermelon status (Green outside, Red inside) | Report reads fine while anyone close to the work knows it's in trouble | Tie color to the pre-agreed threshold, never to tone |
| One-line "behind schedule" covering all causes | Hides which lever fixes it — descoping doesn't fix a blocker | Name scope growth / underestimation / blockage explicitly |
| Green-to-Red jump with no intermediate Amber | By the time it's undeniably Red, recovery options have narrowed | Require Amber as the mandatory intermediate step once a threshold is crossed |
| "Done" on say-so | Nothing to check the claim against later | Require the artifact/evidence link before marking a milestone done |
| Ask or risk with no owner | Not actionable by the reader | Pair every risk/ask with a named owner |

### Worked example
- *Weak:* "Project is a bit behind but the team is working hard, should be fine."
- *Sharp:* "Status: Amber (was Green last cycle; variance moved from 3% to 11% behind baseline — inside the 5–15% Amber band). Cause: scope growth — two integration requirements the sponsor approved on 2026-07-10, not underestimation of the original scope. Milestone 'API contract signed off' marked done, evidenced by the signed doc linked in Notion, not verbal confirmation. Risk: integration scope may grow further — owner: PM, watching sponsor requests. Ask: confirm whether the two July additions are in scope for this milestone or the next — owner: sponsor, needed by Friday."

### What this skill must not do
- Does not perform the multi-persona ship/no-ship reconciliation of an existing status draft — that audit is `jstack:review-project-review`; this skill produces the original cross-surface snapshot.
- Does not write back to Jira or Notion — output is a read-only snapshot.
- Does not invent a baseline, approval date, or milestone definition that wasn't provided — ask, or state the status can't be computed without it.
""",
    "engineering": """
## Domain rules — engineering (composite roll-up)

### Absolute rules
1. Report CI status, PR queue, flaky tests, and revert risk as **four separate lines**, never collapsed into one composite score — a blended "engineering health: 78/100" hides exactly which axis needs attention, the same failure a blended DORA score produces.
2. Revert risk is defined by a concrete, checkable condition — a merge to main with a failing required check, fewer than the required approving reviews, or an actual subsequent revert commit — never an inferred "this looks risky."
3. Every PR aged past the configured stale threshold is named individually (link, author, age) — a bare "12 stale PRs" count gives nobody an actionable next step.
4. Flaky tests are reported with an occurrence count and window ("4 of the last 50 runs"), never a vague "some flakiness" — a flaky test is a leading indicator that's easy to ignore until it's quantified.
5. Only repos present in config are scanned or reported. Silently expanding scope produces noise nobody asked for and may surface data outside the requester's access boundary.
6. When one signal's integration is unavailable, say so for that signal specifically — a 3-of-4-signals report must not read as "everything is fine" by omitting the fourth.

### Thresholds
| Signal | Threshold | Source |
|---|---|---|
| PR stale threshold | >3 days open with no review activity (org-configurable) | practitioner convention; confirm against `skill_defaults` |
| Flaky test flag | >1% failure rate over the last 50 runs | [Google Testing Blog — Flaky Tests at Google](https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html) |
| Revert-risk condition | merge to main with a failing required check, or fewer than the required approvals, or a revert commit within the window | concrete, checkable definition |
| CI status roll-up | reported green/red/flaky per repo, never averaged into one org-wide color | prevents one bad repo from being diluted into a "fine" aggregate |

### Named anti-patterns
| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Collapsing 4 signals into one score | Hides which axis is the actual problem, same failure as a blended DORA number | Report CI / PR queue / flaky / revert risk as four separate lines |
| Stale-PR count with no list | Not actionable — nobody knows which PR to look at | Name each stale PR: link, author, age |
| Scanning repos outside config | Exceeds the request's boundary; may expose data outside the requester's scope | Only touch configured repos; state which repos were checked |
| Omitting an unavailable signal silently | A partial report reads as "all clear" when one axis is actually unmeasured | Explicitly mark the missing signal as unavailable |
| Reporting revert risk as a feeling | Unfalsifiable, can't be checked by a second reader | Cite the specific merge and the concrete condition it met |

### Worked example
- *Weak:* "Engineering health looks okay this week, a few PRs are getting old."
- *Sharp:* "CI: green across 4/5 configured repos; `payments-service` is flaky (3 of 50 recent runs failed, ~6%, above the 1% threshold). PR queue: 14 open, 3 stale (>3 days, no review) — oldest is #482 (opened 5 days ago, author J. Lee, no reviewer assigned). Flaky test: `test_webhook_retry` in `payments-service`, 4 of the last 50 runs. Revert risk: one merge to `main` in `payments-service` this week shipped with a failing lint check overridden by an admin merge — flagged. `billing-service`'s CI integration is not configured; that signal is reported unavailable, not assumed healthy."

### What this skill must not do
- Not the deep DORA four-keys analysis with bands and trend framing — that's `jstack:engineering-health`.
- Not a code-ownership or bus-factor investigation — that's `jstack:engineering-silo-scan`.
- Does not fix CI, merge PRs, or modify repos — surfaces findings for humans to act on.
""",
    "knowledge/self-knowledge": """
## Domain rules — self-knowledge

### Absolute rules
1. Every captured entry carries provenance — a source (PR, repo, transcript, self-report) and an as-of date — before it's written. An entry with no source is unverifiable the moment it's needed again.
2. Search for near-duplicates before writing anything new. Two competing personal notes on the same topic, with neither marked canonical, make later retrieval untrustworthy.
3. **Privacy boundary runs both directions.** Personal data captured here (activity, preferences, working-style notes) is never copied into a team/shared store by default; separately, this skill never scrapes private repos or org data beyond what the configured token's scope actually grants.
4. An entry only earns capture if it's retrievable by the query a future search would plausibly use. A note filed under a title nobody would search for is worse than not captured — it creates false confidence the information was saved.
5. Entries past the configured review window are flagged for re-confirmation, not silently trusted — personal knowledge decays exactly like team knowledge, just with a smaller blast radius when it's wrong.
6. If token scope is unclear, ask before assuming broader access — never infer scope from what would be convenient to read.

### Thresholds
| Signal | Threshold | Source |
|---|---|---|
| Provenance completeness | 100% of captured entries carry source + as-of date | [Where Provenance Ends, Knowledge Decays](https://jessicatalisman.substack.com/p/where-provenance-ends-knowledge-decays) |
| Dedupe check | run before every write, not after | prevents competing "canonical" notes |
| Review cadence | risk/usage-based, not flat — high-use personal reference notes reviewed more often than one-off preferences; pull the actual cadence from config | [Knowledge Base Governance Framework](https://knowledge-base.software/guides/knowledge-base-governance-framework/) |
| Retrieval test | entry must resolve to a query a future search would plausibly use | prevents "captured but unfindable" |

### Named anti-patterns
| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Writing without a source | Can't verify later whether it's still true or who to ask | Capture source link and as-of date every time |
| Skipping the duplicate search | Two competing notes on the same topic, neither canonical | Search first; merge or supersede on a match |
| Filing under a title nobody would search | Note exists but is functionally lost — worse than not captured | Use retrieval-cue tags/titles matching the actual future query |
| Copying personal activity into the shared store by default | Leaks preferences or private context into a team-visible store | Personal capture stays personal unless explicitly promoted by the individual |
| Trusting an old entry with no re-check | Personal knowledge decays; a stale entry silently misleads | Flag entries past the review window instead of presenting them as current |

### Worked example
- *Weak:* "Noted: prefers async review over sync pairing."
- *Sharp:* "Captured 2026-07-26, source: self-reported in this session's notes. Retrieval tag: `review-style-preference` (matches how a future search would phrase it). Checked for duplicates under `review`/`pairing` tags: none found. Not synced to the team store — this is a personal working-style note, not a team process decision."

### What this skill must not do
- Does not build or maintain the team-wide knowledge graph — that's `jstack:knowledge-team-knowledge`.
- Does not write personal data into a shared store under any default path.
- Does not scrape private repos or org data beyond the configured token's actual scope.
""",
    "knowledge/team-knowledge": """
## Domain rules — team-knowledge

### Absolute rules
1. **Never write personal data into the shared team store.** An individual's private notes, preferences, or performance commentary get redacted or stripped before capture — the team store is discoverable by the whole team by design, so anything written there is effectively broadcast.
2. Every linked entry (issue, ADR, runbook) carries provenance — source and as-of date — and is checked against near-duplicates before writing; the cost of a wrong canonical is higher here than in personal capture because more people rely on it.
3. A suggested hub page must resolve to entries a team member would actually search for. A hub nobody can find via a normal query creates false confidence the topic is documented.
4. Stale pages (past the configured review window) are flagged explicitly in the graph, not silently left to imply currency — a team following an outdated runbook believing it current is worse than an admittedly gap.
5. No invented hierarchy: if a page id or parent doesn't exist in Notion/gbrain, return paste-able markdown rather than fabricating a link that looks valid but resolves nowhere.
6. Deduplication keeps the **oldest decision link** as canonical and merges the rest into it — canonical means the original decision record, not whichever entry was most recently edited.

### Thresholds
| Signal | Threshold | Source |
|---|---|---|
| Provenance completeness | 100% of linked entries carry source + as-of date | [Where Provenance Ends, Knowledge Decays](https://jessicatalisman.substack.com/p/where-provenance-ends-knowledge-decays) |
| Dedupe check | before every write | prevents parallel "canonical" entries |
| Stale-page flag | past the configured, risk/usage-based review window | [Knowledge Base Governance Framework](https://knowledge-base.software/guides/knowledge-base-governance-framework/) |
| Personal-data scan | 0 personal identifiers/preferences in team-store entries | privacy boundary, non-negotiable |

### Named anti-patterns
| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Copying a personal note into the team graph verbatim | Leaks private context into a store the whole team can see | Redact personal content; capture only the team-relevant fact |
| Building a hub with no discoverable entry point | Team believes the topic is documented, wastes time searching anyway | Verify a plausible search query surfaces the hub before proposing it |
| Treating most-recently-edited as canonical | Loses the original decision rationale in favor of whatever was touched last | Keep the oldest decision link canonical; merge duplicates into it |
| Inventing a Notion page id that doesn't exist | Produces a link that looks valid but 404s, eroding trust in the graph | Return paste-able markdown when no real id exists |
| Leaving a stale runbook unflagged | Team follows outdated steps believing them current | Flag anything past the review window in the graph itself |

### Worked example
- *Weak:* "Added a link between the incident and the runbook, looks connected now."
- *Sharp:* "Linked INC-4021 → `runbooks/payment-retry.md` (source: incident postmortem, 2026-06-14). Duplicate check: an older link from ADR-118 already covers this relationship — keeping ADR-118 canonical, superseding the new one rather than creating a parallel edge. Runbook flagged stale (last reviewed 2025-11-02, past the 6-month window) — recommend re-verifying retry steps before relying on it live. No personal names or 1:1 content included in this entry."

### What this skill must not do
- Does not manage an individual's personal capture — that's `jstack:knowledge-self-knowledge`.
- Must never write personal data into the shared store, regardless of how the request is phrased.
- Does not unilaterally restructure Notion — it proposes links/hubs/stale flags; write-scale changes need user confirmation.
""",
    "meetings/prepare": """
## Domain rules — meetings-prepare

### Absolute rules
1. Every agenda item states whether it needs a **decision**, a **discussion**, or is pure **information** — a bare topics list with no marker can't tell an attendee what to actually prepare.
2. A decision-bearing item names who is Responsible/Accountable (must attend) versus Consulted/Informed (can get the brief async) — defaulting everyone to "must attend" wastes exactly the calendar time this skill exists to protect.
3. Pre-reads ship attached to the agenda, not delivered verbally at the top of the meeting — material that needs review before a decision, read live instead, converts meeting time into read time.
4. State plainly what would happen if the meeting didn't happen. If the honest answer is "nothing" or "an async message would cover it," that is the cancellable signal — name it, don't bury it under a polished agenda.
5. Never record a decision or action item without a confirmed owner; actions additionally need a due date. An unattributed commitment can't be tracked or followed up.
6. Keep personal commentary and 1:1-specific content out of any brief meant for a shared or group meeting — the personal/team privacy boundary applies to meeting prep exactly as it does to knowledge capture.

### Thresholds
| Signal | Threshold | Source |
|---|---|---|
| Decision-item attendance | only Responsible + Accountable required in-room; Consulted + Informed can be async | [RACI for meeting attendance](https://www.pcma.org/raci-matrix-meeting-planning-clear-roles-effective-collaboration/); [McKinsey — limits of RACI](https://www.mckinsey.com/capabilities/people-and-organizational-performance/our-insights/the-organization-blog/the-limits-of-raci-and-a-better-way-to-make-decisions) |
| Pre-read delivery | attached with the agenda, before the meeting, not distributed at start | [Fellow — RACI meeting guide](https://fellow.app/blog/meetings/raci-meeting-your-complete-guide-to-a-well-informed-team/) |
| Cancellable test | purpose can't be stated in one sentence, or "what happens if this doesn't happen" answers "nothing"/"an async message" | [Lucid Meetings — Should you cancel your next meeting?](https://blog.lucidmeetings.com/blog/should-you-cancel-your-next-meeting/) |
| Action-item completeness | 100% of action items carry owner + due date; unassigned defaults to `unassigned` + a suggested ping | existing skill convention |

### Named anti-patterns
| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Topics list with no decision markers | Attendees can't tell what to prep or what "done" looks like | Tag every item decision / discussion / information |
| Defaulting the whole team to "must attend" | Wastes calendar time for people who only need the outcome | Split R+A (must attend) from C+I (async brief) per item |
| Verbal context dump at meeting start | Burns synchronous time re-explaining material that should've been pre-read | Attach pre-reads to the agenda in advance |
| Recording a decision with no clear owner | Looks decided but isn't accountable or traceable later | Confirm attribution before writing a decision down |
| Prepping a brief without flagging a failed cancellable test | Optimizes a meeting that shouldn't happen instead of naming that fact | State the cancellable signal plainly when no decision or unique sync value exists |

### Worked example
- *Weak:* "Prepped a brief with talking points for tomorrow's sync."
- *Sharp:* "One decision item: approve or reject the CSV-export scope change (Responsible: eng lead; Accountable: PM — both must attend; QA and support are Consulted, briefed async via the linked doc). Pre-read attached, not for live reading. Two other agenda lines are pure status updates with no decision attached — flagging that these could move to an async Slack update instead; recommend cutting them from the live agenda. No action items carried forward without an owner: TICKET-310 spike — owner [name], due Friday."

### What this skill must not do
- Builds a read-only, 1-page prep brief (agenda framing, pre-reads, attendance split, blockers) — it does not send calendar invites, post to Slack, or store meeting notes (`jstack:meetings-post-slack`, `jstack:meetings-store-note` own those).
- Does not itself decide to cancel the meeting — it names the cancellable signal and lets the organizer act on it.
""",
}

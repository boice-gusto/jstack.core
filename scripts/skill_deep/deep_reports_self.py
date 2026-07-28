"""
Deep domain content for the reports/* generation skills and the self/* personal skills.

Each entry overrides CATEGORY_DEEP["reports"] / CATEGORY_DEEP["self"] for its own key
(key-first lookup in apply_detailed_skills.py), so these nine skills carry real domain
depth — thresholds, named anti-patterns, worked examples — without moving to SKIP and
losing generation.

Owns exactly: reports/engineer-report, reports/manager-report, reports/team-report,
reports/project-report, reports/eval-report, self/brag, self/explain, self/impact-prep,
self/lookback.

Two constraints run through every entry here:
1. Provenance discipline — every figure traces to a source and an as-of time; a missing
   metric is `[no data]`, never interpolated, because silent omission in an
   authoritative-looking report misleads exactly as much as fabrication.
2. Performance-adjacency (self/* and reports/eval-report specifically) — these skills
   touch how a person's work is judged. None of them render a verdict on a person's
   worth, none of them carry another person's PII or performance data, and all of them
   separate an observed behavior from an inferred motive.
"""
from __future__ import annotations

DEEP: dict[str, str] = {
    "reports/engineer-report": """
## Domain rules — engineer-report

### Absolute rules

1. **"Shipped" means merged and deployed/released** — not "opened a PR," not "merged behind a
   flag with no rollout yet." Cite the release evidence (deploy log, release tag, changelog
   entry) with an as-of date; a PR link with no merge/release confirmation is a claim, not a
   shipped result.
2. **Never invent velocity, story points, or incident counts to fill a template gap.** Mark the
   row `[no data]`. A silently blank or omitted row reads as "nothing to report," which is as
   misleading as a fabricated number.
3. **Tag every figure measured / estimated / assumed.** Measured = pulled from an integration
   (GitHub/Jira/PagerDuty API) with an as-of timestamp. Estimated = derived with a stated
   assumption. Assumed = user-supplied and unverified. Collapsing the three into one unmarked
   number lets a stale guess pass as a live measurement.
4. **A blocker names the blocking dependency and the date it was raised** — "things are slow" is
   not a blocker line; it can't be escalated or aged.
5. **This report evaluates the work, not the person.** No competence rating, no inferred-motive
   line ("isn't trying hard enough"). Requests for that route to `reports/eval-report`, and even
   there the same behavior-not-motive rule applies.
6. **One report per engineer.** Cross-engineer rollups belong to `reports/team-report` /
   `reports/manager-report` — don't fold multiple people into one report to save a step.
7. **"Next" items are already scheduled** (a ticket in next sprint, an assigned follow-up), not
   aspirational filler restating the mission. An unscheduled "next" item is `[no data]`.

### Thresholds / criteria

| Signal | Rule | Source |
|---|---|---|
| Data provenance | Every figure tagged measured / estimated / assumed with a named source and as-of date | data-hierarchy pattern from [GHG Protocol Scope 3 data hierarchy](https://ghgprotocol.org/sites/default/files/standards/Scope3_Calculation_Guidance_0.pdf) (supplier-specific → hybrid → average → spend-based, most- to least-verified), applied to eng reporting |
| Missing metric | `[no data]` — never interpolated, never silently dropped | this skill's own reporting contract |
| Blocker escalation age | Org-specific threshold comes from `jstack.config.json`; state the blocker's raised-date so age is computable, don't invent a universal day count | config-first convention |
| Pull freshness | State the as-of date/time the underlying data was pulled, distinct from the report's generation date | [W3C PROV-Overview — provenance as basis for trust](https://www.w3.org/TR/prov-overview/) |

### Named anti-patterns

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| Counting "opened a PR" as shipped | Overstates progress on work that hasn't merged or released | Require merge + deploy/release evidence before marking shipped |
| Filling a blank metric with "about the usual" | An invented figure dressed as data | Mark `[no data]` and state why the source returned nothing |
| Blockers written as mood ("things are slow") | Can't be escalated, tracked, or aged | Name the blocking dependency and the date it was raised |
| Editorializing on effort or attitude | Turns a work report into an unrequested performance judgment | Report shipped/WIP/blocked facts only; route judgment elsewhere |
| Rolling several engineers into one report | Loses the per-person accountability this report exists to provide | Generate one report per engineer; aggregate in `reports/team-report` |

### Worked example

- *Weak:* "Alex shipped some good stuff this week and is generally on track."
- *Sharp:* "Shipped: PR #482 (`auth-service`) merged and deployed 2026-07-22 — closes 2 open P2
  tickets tied to session-expiry bugs (measured, source: GitHub + Jira). WIP: PR #491, in review
  since 2026-07-24, blocked on a schema-migration review from the data team (raised 2026-07-23,
  3 days aging). Next: JIRA-1201, scheduled for next sprint."

### What this skill must not do

- Does not stack-rank this engineer against peers — that comparison, if wanted, belongs to
  `reports/manager-report`'s team-level rollup.
- Does not render a competence judgment or inferred motive about the engineer.
- Must not aggregate multiple engineers into a single report.
- Not for surfacing a metric the org hasn't wired an integration for — say `[no data]`, don't
  estimate from impression.
""",
    "reports/manager-report": """
## Domain rules — manager-report

### Absolute rules

1. **Never stack-rank named individuals.** Aggregate at team level; a "rollup" that reduces to a
   sorted list of ICs by output volume is performance review by another name, not a rollup.
2. **Every rollup figure states the source reports it aggregates and their as-of dates.** A
   rollup is only as fresh as its stalest input — if one team's report is two weeks old and
   others are current, disclose the mismatch rather than blending as if simultaneous.
3. **Aggregate at the altitude a manager's question requires**, not by concatenating engineer
   reports. An engineer report answers "what did I ship"; a manager rollup answers "where do I
   need to intervene" — those are different documents even when built from the same source data.
4. **Check the IC-name redaction flag in `jstack.config.json` before writing names** — don't
   assume either a redacted or a named default.
5. **A team with `[no data]` is listed as `[no data]`, never silently dropped from the roster.**
   A missing row reads as "nothing happened," not "no report submitted."
6. **Label a measured cross-team trend separately from an estimated one** (e.g., extrapolated
   from a partial reporting period) — an unlabeled extrapolation looks like a confirmed number.
7. **This report does not substitute for 1:1 feedback or a performance review.** No paragraph
   rating any named engineer's output belongs here, regardless of how it's phrased.

### Thresholds / criteria

| Signal | Rule | Source |
|---|---|---|
| Individual attribution | Zero named-individual rankings in the rollup; team-level only | this skill's own contract — see the same behavior-not-worth boundary in `reports/eval-report` |
| Source staleness | State each source report's as-of date; flag any spread greater than one reporting cycle | provenance discipline (measured/estimated/assumed convention) |
| Redaction policy | Read from `jstack.config.json`; do not assume a default in either direction | config-first convention (`CLAUDE.md`) |
| Missing team | Listed as `[no data]`, not omitted from the roster | this skill's own reporting contract |
| Audience altitude | Rollup answers a manager's trend/risk/resourcing question, not a ticket-level activity log | [Minto Pyramid Principle — conclusion first, increasing detail below](https://www.toolshero.com/communication-methods/minto-pyramid-principle/) |

### Named anti-patterns

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| Stack-ranking ICs by ticket count | Reduces a rollup to a performance ranking nobody asked this report to produce | Aggregate at team level; route individual assessment elsewhere |
| Blending reports from different as-of dates unflagged | Reader assumes simultaneity that doesn't exist | State each source's as-of date; flag the spread |
| Dropping a `[no data]` team from the roster | Reads as "nothing happened" instead of "no report submitted" | List every team; mark missing ones explicitly |
| Copy-pasting engineer-report detail wholesale | Wrong altitude — a manager audience doesn't need ticket-level detail | Summarize to the decision/trend level; link to source reports |
| Assuming a redaction default instead of checking config | Over- or under-redacts relative to actual policy | Read the flag from `jstack.config.json` before writing names |

### Worked example

- *Weak:* "Team A and Team B both had solid weeks, no real issues to flag."
- *Sharp:* "Team A (as of 2026-07-25): 14/16 committed tickets closed; one Amber risk (vendor API
  rate limit), owner [role], recheck 2026-07-30. Team B (as of 2026-07-20 — source report not
  resubmitted, 5 days stale): reported Green last cycle; treat as stale, not confirmed current.
  No individual ranking included, per the redaction flag in `jstack.config.json`."

### What this skill must not do

- Must not name and rank individual ICs — aggregate at team level only.
- Does not replace 1:1 feedback or a performance review.
- Not for blending source reports from mismatched as-of dates without flagging the mismatch.
- Does not invent a redaction policy — reads it from config.
""",
    "reports/team-report": """
## Domain rules — team-report

### Absolute rules

1. **Velocity is a measured count from the tracker** (points completed, tickets closed) for the
   stated sprint window — never a felt sense of "productive week." Report points committed vs.
   points completed so the completion rate is computable, not just asserted.
2. **Exactly the "3 asks" the template promises** — no more (dilutes what leadership should act
   on) and no fewer (looks like nothing is needed). If there are genuinely zero live asks, state
   `No asks this week — [reason]` rather than padding a fourth item.
3. **A risk with no named owner and no next check-in date is incomplete** — leadership can't act
   on a risk nobody is accountable for.
4. **Dependencies name the blocking team/system explicitly, plus the date first raised** —
   "waiting on platform team" with no raised-date can't be escalated by age.
5. **Carried-over work is labeled `carried over (Nth week)`.** Folding it back into "this week's
   completed" inflates apparent velocity and hides a slipping timeline.
6. **Report committed, completed, and added-mid-sprint as three separate counts.** Collapsing
   them into one "velocity" number hides whether the team estimates well or is absorbing
   unplanned scope.
7. **The audience is leadership above the team, not the team itself.** Omit ticket-level detail a
   standup would want; state the decision needed, not the activity log.

### Thresholds / criteria

| Signal | Rule | Source |
|---|---|---|
| Ask count | Exactly 3 named asks; 0 requires an explicit stated reason, never silent omission | this skill's own template contract |
| Risk completeness | Every risk row: owner + next check-in date; missing either blocks publish | qualitative gate, this skill's own contract |
| Committed / completed / added | 3 distinct counts, never collapsed into one velocity figure | measured/estimated/assumed provenance discipline (see `reports/engineer-report`) |
| Audience altitude | Leadership rollup states the decision needed, not an IC-level activity log | [Minto Pyramid Principle](https://www.toolshero.com/communication-methods/minto-pyramid-principle/) |

### Named anti-patterns

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| Padding to "3 asks" with a non-ask | Trains leadership to skim past the asks section as noise | State fewer asks with a stated reason if fewer are live |
| Folding carried-over work into "completed" | Inflates apparent velocity, hides a slipping timeline | Label carried-over items and their originating week |
| Risk row with no owner | Nobody is accountable to act on it | Every risk names an owner and a next check-in date |
| One velocity number blending committed/completed/added | Hides whether the team estimates well or absorbs scope creep | Report the three counts separately |
| Writing for the team's own audience (ticket detail) | Wrong altitude for a leadership report, buries the actual ask | State the decision needed, not the activity log |

### Worked example

- *Weak:* "Good week, made progress on most things, a couple of blockers."
- *Sharp:* "Velocity: 18 pts committed / 14 pts completed / 3 pts added mid-sprint (unplanned
  hotfix). Risk: vendor API deprecation, owner [role], recheck 2026-08-01. Dependency: waiting on
  the platform team for a shared-library bump, raised 2026-07-20 (5 days aging). Asks: (1) approve
  the library-bump ticket, (2) confirm Q3 headcount for the migration, (3) unblock the
  platform-team dependency."

### What this skill must not do

- Not for individual engineer detail — that's `reports/engineer-report`.
- Must not pad or shrink the ask count to hit a fixed-looking number.
- Does not substitute for a project-level RAG status — that's `reports/project-report`.
- Must not fold carried-over or added-mid-sprint work into "completed" silently.
""",
    "reports/project-report": """
## Domain rules — project-report

### Absolute rules

1. **RAG color traces to a pre-agreed, measurable trigger stated inline** (schedule variance %,
   budget variance %) — never assigned from a feeling. If no trigger was configured, say the
   color can't be computed rather than picking one anyway.
2. **A milestone is complete only against the artifact it was defined to produce** (a closed
   ticket, a signed doc, a metric hit). "The team says it's done" is not evidence; ask for the
   artifact or mark `[unverified]`.
3. **No status jumps directly from Green to Red between reports.** If the underlying source
   shows that jump, flag the missing Amber cycle explicitly as a reporting gap — the jump is
   itself a failure independent of what caused the schedule slip.
4. **Silence for a full reporting cycle is reported as Amber (stale), never carried forward as
   the prior color.** No news is not good news in a status report.
5. **Every open risk-register row carries severity, owner, and last-updated date.** A risk row
   with no last-updated date can be months stale and still look current.
6. **Label schedule/budget figures measured (from the PM tool) vs. projected (a forecast)
   distinctly.** Presenting a forecast with the same visual weight as a measured actual misleads
   a reader who assumes both carry equal certainty.
7. **This report states RAG and evidence; it does not render the go/no-go call.** That decision
   belongs to the sponsor or stakeholder this report feeds.

### Thresholds / criteria

| Signal | Rule | Source |
|---|---|---|
| RAG banding | Illustrative external bands: Green ≤5% behind, Amber 5–15%, Red >15% with no approved recovery plan — the org's actual bands are config-defined, not these figures | [ClearPoint Strategy — RAG status for KPIs](https://www.clearpointstrategy.com/blog/establish-rag-statuses-for-kpis) |
| Estimate uncertainty | Concept-phase estimates carry roughly 4x–0.25x spread, narrowing to ~1.1x–0.9x once detailed design is complete — an unrevised concept-era number reported at execution time is itself a flag | [Construx — The Cone of Uncertainty](https://www.construx.com/books/the-cone-of-uncertainty/) |
| Stale-status window | No new evidence for one full reporting cycle → report Amber, not the prior color | qualitative gate, this skill's own contract |
| Milestone completion | Requires the defining artifact; `[unverified]` otherwise | this skill's own contract |

### Named anti-patterns

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| Watermelon status (green outside, red inside) | Reported color doesn't match ground truth | Trace RAG color to a pre-agreed measurable trigger every time |
| Green-to-Red jump with no Amber cycle | Signals a reporting gap on top of the underlying slip | Flag the missing intermediate step explicitly |
| Accepting "done" without the defining artifact | A milestone marked complete that isn't | Require the artifact before marking complete |
| Risk row with a last-updated date from a prior quarter | Looks current, may be stale by months | Require a current last-updated date on every open risk |
| Forecast shown with the same weight as a measured actual | Reader can't tell certain from projected | Label forecasted figures distinctly from measured ones |

### Worked example

- *Weak:* "Project is on track, a few minor risks, nothing urgent."
- *Sharp:* "Status: Amber (was Green last cycle, no rebaseline since). Schedule variance: measured
  9% behind the approved baseline as of 2026-07-24 (source: PM-tool burndown) — driven by scope
  growth (two integration requirements approved 2026-07-10), not underestimation. Milestone 'API
  v2 complete' marked complete against merged+deployed evidence (PR #310, deployed 2026-07-15).
  Open risk: vendor SLA delay, last updated 2026-07-22, owner [role]."

### What this skill must not do

- Does not render the go/no-go decision — states RAG and evidence; the sponsor decides.
- Must not accept "done" without the defining artifact.
- Not for evaluating an individual's performance behind a slip.
- Does not invent an approval date, baseline, or milestone definition not supplied — asks instead.
""",
    "reports/eval-report": """
## Domain rules — eval-report

This is the most performance-adjacent report kind this skill set generates. It must not become a
judgment of a person's worth, must not carry another named person's PII or performance data, and
must separate observed behavior from inferred motive throughout.

### Absolute rules

1. **Never render a verdict on the person's worth.** The 9-grid plots demonstrated impact and
   trajectory for a period of work — not a statement about who someone is. A line like "this is a
   low performer" has no place here; describe the observed pattern instead.
2. **Every grid placement cites a dated, observable artifact** (a shipped project, a review
   comment, a stated goal). An ungrounded placement ("felt like a strong quarter") isn't
   defensible if challenged and shouldn't ship.
3. **Separate observed behavior from inferred motive.** "Missed the March and April deadlines" is
   observable; "doesn't care about deadlines" is an inferred motive and must not be asserted —
   state the behavior and let the reader draw their own conclusion about cause, the same
   separation the [SBI feedback model](https://www.ccl.org/articles/leading-effectively-articles/closing-the-gap-between-intent-vs-impact-sbii/)
   draws between situation-behavior and character.
4. **No other named person's PII or performance data appears as a comparison point.** "Did more
   than [peer]" has no place in someone's evaluation artifact — a peer's private performance
   record is off-limits regardless of accuracy, and naming them is a policy risk on its own.
5. **Growth framing names a next behavior, not a trait fix.** "Adopt a written rollout checklist
   next cycle" is actionable; "be more proactive" targets a personality trait and gives no
   observable next step.
6. **Use specific, fact-based language over vague adjectives.** "Exceeded the Q2 goal by a
   measured amount" beats "did great work" — vague, trait-flavored adjectives are exactly the
   language [flagged as a discrimination-litigation risk in subjective evaluation systems](https://aaronhall.com/legal-considerations-in-employee-performance-evaluations/).
7. **Default distribution to manager-only / restricted** until a named approver explicitly
   widens it per config policy — never default this report kind to a broad audience.

### Thresholds / criteria

| Signal | Rule | Source |
|---|---|---|
| Distribution default | Restricted/manager-only until explicit sign-off broadens it | this skill's own contract |
| Behavior vs. trait | Every growth-area line names a next behavior, never a trait/adjective | [SBI feedback model](https://www.ccl.org/articles/leading-effectively-articles/closing-the-gap-between-intent-vs-impact-sbii/) |
| Specificity bar | Prefer a cited figure over an unverifiable adjective ("effective," "needs improvement") | [EEOC-aligned evaluation-language guidance](https://aaronhall.com/legal-considerations-in-employee-performance-evaluations/) |
| Self-report vs. evidence | Cross-check a self-reported placement against artifact evidence before accepting it; self- and measured-skill assessments diverge sharply at the low end (12th-percentile scorers self-rated ~62nd percentile) | [Kruger & Dunning 1999](https://en.wikipedia.org/wiki/Dunning%E2%80%93Kruger_effect) |
| Third-party data | Zero instances of another named person's PII/performance data used as a comparison | this skill's own contract |

### Named anti-patterns

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| Character judgment in a growth line ("isn't a team player") | A trait label, unactionable, and a worth-judgment this skill must not render | Name the specific observed behavior and a next action |
| Comparing to a named peer's performance | Puts another person's private performance data into someone else's artifact | Compare against the stated rubric/goal, not a peer |
| Vague adjective instead of a cited fact | Unverifiable, and a known legal/compliance risk in subjective evaluations | Cite the specific artifact and figure behind the claim |
| Defaulting distribution to broad/team-wide | This is the most sensitive report kind in the set | Default to manager-only/restricted until explicitly widened |
| Treating a self-report as equivalent to evidence | Self-assessment error is largest exactly where it matters most | Cross-check self-placement against a cited artifact first |

### Worked example

- *Weak:* "This person had a strong quarter and is a great team player who really stepped up."
- *Sharp:* "Q2 placement — Impact: led the `auth-service` migration (PRs #480–#491, deployed
  2026-07-15); on-call log shows related P2 incidents dropped from 6/month to 1/month over the
  following 6 weeks. Observed behavior: missed the stated 2026-06-01 internal deadline by 3 weeks
  — no cause asserted here. Growth area: adopt a written rollout checklist before the next
  migration (specific next behavior), not 'be more careful.' Distribution: manager-only, per this
  report's default."

### What this skill must not do

- Must not become a judgment of the person's worth — describes a period of observed work only.
- Must not include another named person's PII or performance data as a comparison point.
- Does not assert inferred motive — states observed behavior only.
- Not for broad distribution by default — manager-only/restricted until explicitly widened.
""",
    "self/brag": """
## Domain rules — brag

Personal-target by default: this writes to the user's own gbrain and covers only their own,
verifiable work.

### Absolute rules

1. **Capture within the same reporting cycle the work happened.** A brag entry drafted from
   memory months later is a reconstruction, not a contemporaneous record, and reconstruction is
   lossy in a specific direction: only the most salient or most recent items survive, which is
   exactly why [a brag document's value is the log, not the eventual recall](https://jvns.ca/blog/brag-documents/).
2. **State the impact, not just the output.** "Shipped the migration" is an activity; "shipped
   the migration, cutting P1 incident volume from N to M over the following two weeks" is
   impact — an entry with no stated consequence is a to-do-list item, not a brag entry, and
   conflating output with impact is exactly the gap [outcome-over-output framing exists to close](https://www.svpg.com/outcomes-are-hard/).
3. **Tier significance by the configured label** (size, blast radius), not by entry length or
   personal enthusiasm — a two-line hotfix that stopped an outage can outrank a large refactor if
   the configured tier says so.
4. **Only the user's own verifiable contribution.** Never fold a teammate's work into the user's
   entry as if solely theirs, and never store a teammate's private activity data without their
   consent and redaction.
5. **Label a self-reported, unsourced claim `[self-reported, unverified]`** rather than
   presenting it with the same confidence as an API-sourced commit/PR/ticket.
6. **Calibrate in both directions.** Don't inflate a routine task into a headline accomplishment,
   and don't habitually under-claim high-impact work out of modesty — either failure defeats the
   document's purpose of preserving accurate evidence.
7. **A team win is not automatically an individual line item** unless the individual's specific,
   attributable contribution is named.

### Thresholds / criteria

| Signal | Rule | Source |
|---|---|---|
| Capture cadence | Logged within the same day/week the work happened, not reconstructed later | [Julia Evans — "Get your work recognized: write a brag document"](https://jvns.ca/blog/brag-documents/) |
| Impact statement | Every entry states output AND consequence; output alone is incomplete | outcome-vs-output distinction, [SVPG — Outcomes Are Hard](https://www.svpg.com/outcomes-are-hard/) |
| Attribution | Only the user's own verifiable contribution; teammate work needs explicit consent + redaction | this skill's own personal-target-by-default contract |
| Source confidence | API-sourced entries and self-reported claims are visually distinguished, never blended | provenance discipline shared with `reports/*` |

### Named anti-patterns

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| Reconstructing months later from memory | Loses most entries to recency/salience bias by write time | Log within the same day/week the work happens |
| Listing output with no stated consequence | Reads as a to-do list, not a brag entry | State the measured or observed effect, not just the action |
| Claiming a team win as a solo line item | Misattributes credit that isn't verifiably the user's own | Name the user's specific, attributable contribution only |
| Treating every PR as equally significant | Buries the one high-impact fix among routine ones | Tag entries with the configured significance tier |
| Habitual under-claiming of high-impact work | Loses evidence the document exists to preserve | Calibrate to the artifact's actual impact, not to modesty |

### Worked example

- *Weak:* "Did a lot of good work this week on the migration project."
- *Sharp:* "2026-07-22: Shipped PR #482 (auth-service migration, tier: high-blast-radius per
  config), cutting open session-expiry P2 tickets from 4 to 0 within the week — verified via
  ticket-close log. Logged same day; source: GitHub PR + Jira closure, not self-reported."

### What this skill must not do

- Not for compiling a teammate's activity — personal target by default.
- Does not substitute for `self/explain`'s short per-update narrative or `self/impact-prep`'s
  rubric-mapped evidence gather — this is the running contemporaneous log those draw from.
- Must not present a self-reported, unverified claim with the confidence of a sourced one.
""",
    "self/explain": """
## Domain rules — explain

### Absolute rules

1. **Describe what happened and its effect, not an inferred motive.** "I really pushed hard on
   this" can't be verified from the commit history and doesn't belong in the narrative.
2. **Every claim traces to a commit, ticket, or review comment that exists.** Do not narrate work
   that isn't in the record, even to make an update sound more complete.
3. **State outcome over output where the data exists.** "Reduced API p95 latency by a measured
   amount" beats "refactored the query layer." If no outcome measurement exists yet, state the
   output and mark the outcome `[not yet measured]` — don't invent a plausible-sounding number.
4. **Cover only the period since the last update.** A standup narrative that reaches back further
   to pad length misrepresents "since last time."
5. **Match length to venue.** A PR description can run several sentences of context; a standup
   update is one to three lines — the same event gets different treatment without changing what
   happened.
6. **State a revert or block alongside forward progress.** Omitting a revert from "what happened
   since last time" misleads about actual state.
7. **This narrates recent, already-completed-or-in-flight work.** It does not compile a broader
   accomplishment record — that's `self/brag`'s job over a longer window.

### Thresholds / criteria

| Signal | Rule | Source |
|---|---|---|
| Venue length | Standup: 1–3 lines; PR description: as much as justifies the diff, no fixed minimum | this skill's own venue contract |
| Claim traceability | Every sentence maps to an existing commit/ticket/review comment | provenance discipline shared with `reports/*` |
| Outcome vs. output | State a measured outcome when available; otherwise state output and mark `[not yet measured]` | [SVPG — Outcomes Are Hard](https://www.svpg.com/outcomes-are-hard/) |
| Coverage window | Only the period since the prior standup/PR base | this skill's own scope contract |

### Named anti-patterns

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| Narrating an inferred motive ("I really pushed hard") | Unverifiable from the record, reads as self-serving | State what happened and its observed effect |
| Padding by reaching past "since last time" | Misrepresents the actual period covered | Cover only the period since the last update |
| Describing only forward progress after a revert | Misleads about current state | State the revert/blocker alongside the progress |
| Inventing an outcome number with no measurement | Fabricated precision looks more credible than it is | Mark the outcome `[not yet measured]` |
| Same-length narrative for a standup and a PR description | Wrong length for the venue, buries the point | Match length to venue: 1–3 lines vs. fuller context |

### Worked example

- *Weak:* "Worked hard on the caching layer this week, made real progress."
- *Sharp:* "Since last standup (2026-07-22): merged the caching-layer PR (#503); measured p95
  latency on the `orders` endpoint dropped from 340ms to 210ms in yesterday's dashboard snapshot.
  One follow-up (#505) was reverted after a flaky test surfaced — reopening today."

### What this skill must not do

- Not for compiling a longer accomplishment record — that's `self/brag` over a longer window.
- Must not narrate work that isn't in the commit/ticket/review record.
- Does not invent an outcome measurement that doesn't exist yet.
""",
    "self/impact-prep": """
## Domain rules — impact-prep

Personal-target by default: prepares one person's evidence for a human-run review process; it
does not run that process itself.

### Absolute rules

1. **Every rubric dimension is backed by at least one named artifact** (PR, doc, ticket,
   message). A rubric score with no artifact is a self-assessment, not evidence — flag it as a
   gap to fill with a targeted question rather than filling it with a plausible-sounding claim.
2. **Ask gap-filling questions one at a time, specific to the missing artifact.** "What did you
   do this quarter" is not a gap question; "what's the artifact for the Q2 goal on
   [rubric dimension]" is.
3. **Calibrate against the rubric's stated bar, not against effort expended.** "I worked hard on
   this" is not evidence the bar was met — only the artifact, evaluated against the bar, is.
4. **Flag a self-assessed vs. evidence-supported divergence explicitly rather than averaging it
   away.** Self-assessment miscalibration is a measured effect, sharpest exactly where the
   underlying skill is weakest, so a diverging self-rating is a signal to gather more evidence,
   not to split the difference.
5. **A Quarterly sweep aggregates existing Growth Check-ins plus new artifacts as its primary
   source** — it does not re-derive the whole quarter from memory when check-ins already exist.
6. **This gathers evidence and identifies gaps; it does not render the eventual
   promotion/rating verdict.** That belongs to the human process consuming the prepared evidence.
7. **Personal target by default** — this prepares one person's evidence, not a team-wide
   calibration exercise.

### Thresholds / criteria

| Signal | Rule | Source |
|---|---|---|
| Artifact requirement | ≥1 named artifact per rubric dimension before marking it met; otherwise flag a gap | evidence-over-assertion convention shared with `reports/*` |
| Gap question specificity | One question at a time, naming the missing artifact/dimension | `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/question-patterns.md` |
| Self vs. evidence divergence | Flagged explicitly, never averaged, especially at the low end where self-assessment error is largest | [Kruger & Dunning 1999](https://en.wikipedia.org/wiki/Dunning%E2%80%93Kruger_effect) |
| Verdict boundary | This skill prepares evidence; it does not issue the rating/promotion decision | this skill's own scope contract |

### Named anti-patterns

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| Scoring a dimension from stated effort, not an artifact | Effort isn't evidence the bar was met | Require a named artifact per dimension before marking it met |
| Averaging a self-rating with an evidence-based rating | Hides a real, informative divergence | Flag the divergence explicitly instead of blending it away |
| Asking one broad "how'd you do this quarter" question | Doesn't fill the specific evidence gap | Ask one targeted question per missing artifact |
| Re-deriving a Quarterly sweep from memory when check-ins exist | Discards better, more contemporaneous source data | Aggregate existing Growth Check-ins as the primary source |
| Issuing an implied rating/verdict from the prepared evidence | Oversteps this skill's role | Prepare evidence only; leave the verdict to the human process |

### Worked example

- *Weak:* "I think I had a strong quarter across the board."
- *Sharp:* "Rubric dimension 'technical ownership': artifact = migration design doc + PRs
  #480–#491 (evidence-supported: met). Rubric dimension 'cross-team collaboration': no artifact
  found — gap question: 'What's a specific instance this quarter where you coordinated across
  teams? Do you have the thread or doc?' Self-rated this dimension 'exceeds'; evidence not yet
  found — flagging the divergence rather than averaging it."

### What this skill must not do

- Does not write the final performance narrative or render a rating/promotion verdict.
- Must not average a self-rating against an evidence-based rating when they diverge.
- Not for team-wide calibration — personal target by default.
""",
    "self/lookback": """
## Domain rules — lookback

Explicitly gentle and observational, not therapeutic or diagnostic — the SKILL.md's own
out-of-scope clause already redirects mental-health-adjacent content to professional support;
these rules keep the pattern-surfacing itself honest.

### Absolute rules

1. **A surfaced pattern names the dated data points behind it** ("3 of the last 5 gbrain entries
   mention the same blocked dependency"). An unsupported mood summary ("you seem stressed
   lately") is a guess dressed as an observation, not a pattern.
2. **Separate observed behavior from inferred internal state.** "Logged working past 8pm on 4 of
   the last 7 days" is observable; "you're burning out" is an inferred state this skill must not
   assert — name the observable pattern and let the user draw their own conclusion, the same
   behavior/character separation the [SBI feedback model](https://www.ccl.org/articles/leading-effectively-articles/closing-the-gap-between-intent-vs-impact-sbii/)
   draws in a work-feedback context.
3. **Suggestions name a next behavior, not a trait fix.** "Try logging blockers same-day next
   week" is actionable; "be more resilient" targets a trait and gives no next action.
4. **Stay observational and gentle.** If a surfaced pattern suggests a mental-health concern, name
   the pattern plainly and redirect to professional support — do not attempt to counsel.
5. **Only the user's own data.** This reads personal gbrain/calendar, not a teammate's; if a
   pattern only makes sense with a teammate's private data, say it can't be substantiated from
   personal data alone.
6. **State the review window explicitly** ("looking at the last 14 days"). An undisclosed window
   lets a cherry-picked range imply a trend a different window wouldn't support.
7. **This surfaces retrospective patterns; it does not evaluate performance or worth**, and does
   not feed a manager-facing artifact or `reports/eval-report` without the user's explicit choice
   to share it.

### Thresholds / criteria

| Signal | Rule | Source |
|---|---|---|
| Pattern support | ≥2 concrete, dated data points before naming a pattern; fewer is speculation | evidence-over-assertion convention shared with `reports/*` |
| Behavior vs. inferred state | Names the observed event; never asserts an internal state (burnout, disengagement) not directly evidenced | [SBI feedback model](https://www.ccl.org/articles/leading-effectively-articles/closing-the-gap-between-intent-vs-impact-sbii/) |
| Window disclosure | States the exact day range reviewed | this skill's own scope contract |
| Scope boundary | Never diagnoses; redirects to professional support when content warrants it | SKILL.md's own out-of-scope clause |

### Named anti-patterns

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| Naming a mood pattern from a single entry | One data point isn't a pattern | Require multiple dated data points before naming a pattern |
| Asserting an internal state ("burnout") from behavior | Diagnostic overreach outside this skill's remit | State the observed behavior; redirect to professional support if warranted |
| Undisclosed lookback window | Lets a cherry-picked range imply an unsupported trend | State the exact day range reviewed |
| Framing a suggestion as a trait fix ("be more resilient") | Not actionable, targets identity rather than behavior | Name a specific next behavior to try |
| Feeding a pattern into a manager-facing report without consent | Repurposes a personal reflection tool without the user's choice | Keep output personal-target by default; share only by explicit choice |

### Worked example

- *Weak:* "You seem like you've been stressed and overworked lately."
- *Sharp:* "Looking at the last 14 days (2026-07-13 to 2026-07-26): 4 of 10 gbrain entries logged
  working past 8pm, up from 1 of 10 in the prior 14-day window. Pattern: later end-of-day logging
  this period. Suggestion: try logging blockers same-day next week to see if that shifts it. Not
  a diagnosis — if this reflects something more, professional support is the right next step, not
  this tool."

### What this skill must not do

- Must not diagnose a mental-health concern — redirects to professional support when warranted.
- Does not feed a manager-facing report or evaluation without the user's explicit choice to share it.
- Not for surfacing a pattern from a single data point.
""",
}

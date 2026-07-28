"""
Deep domain content for the planning/judgment skill cluster: prioritize, sdlc,
self/eval, pe/report-context, incident/oncall-summary, incident/find-sme.

See scripts/skill_deep/__init__.py for how DEEP merges into the generator.
"""
from __future__ import annotations

DEEP: dict[str, str] = {
    "prioritize": """
## Domain rules — prioritize

**Absolute rules**

1. Never publish a score without first naming the framework and showing the inputs. A number with no formula behind it is not reproducible by a second reviewer — it is an opinion wearing a table.
2. RICE inputs use the standard scales only: Impact = massive 3x / high 2x / medium 1x / low 0.5x / minimal 0.25x; Confidence = high 100% / medium 80% / low 50% ([Intercom — RICE](https://www.intercom.com/blog/rice-simple-prioritization-for-product-managers/)). A confidence value outside {100, 80, 50}% signals someone picked a number to make the score come out right — reject it and ask which tier it actually is.
3. WSJF is `Cost of Delay ÷ Job Size`, where Cost of Delay = Business Value + Time Criticality + Risk Reduction/Opportunity Enablement, each scored on a relative Fibonacci-like scale (1, 2, 3, 5, 8, 13, 20) ([Scaled Agile Framework — WSJF](https://framework.scaledagile.com/wsjf/)). Job Size uses the same scale — never a different unit (hours vs points) than the value inputs, or the ratio is meaningless.
4. A ranking built entirely on estimated inputs (reach, impact, confidence, job size) must be labeled `[estimate]` in the output, not presented with the same authority as a ranking built on measured usage data. The two are not interchangeable, and hiding the difference lets a shaky guess outrank a well-evidenced item purely on formatting.
5. Criteria are set before scoring, never re-derived after seeing which item "should" win. If a scoring column's weight or scale changes after a preferred answer is visible, that is not recalibration — it is reverse-engineering a foregone conclusion (the HiPPO failure mode: authority substituting for evidence).
6. Every ranked list ends with an explicit cutline and an explicit deferred list. Silently dropping items below the line hides the trade-off; "not shown" is not the same as "considered and deferred."
7. Kano classification requires the paired importance/satisfaction question pattern, not a single "would you like this" question — a single question cannot distinguish must-be from indifferent ([Kano model](https://en.wikipedia.org/wiki/Kano_model)).

## Thresholds

| Signal | Threshold | Why |
|---|---|---|
| RICE confidence | Only 100% / 80% / 50% are valid values | Matches the standard scale; any other number is an unlabeled guess dressed as precision ([Intercom](https://www.intercom.com/blog/rice-simple-prioritization-for-product-managers/)) |
| WSJF job size | Fibonacci-like scale 1–20; a job sized >20 (or "can't size it") | Must be decomposed before scoring — an unsized job breaks the ratio for every other item on the same list ([SAFe](https://framework.scaledagile.com/wsjf/)) |
| RICE impact | Only 3x / 2x / 1x / 0.5x / 0.25x | Five fixed multipliers, not a free-text 1–10 impact guess |
| Cutline recompute | Any time total capacity or team size changes by roughly 20% or more, or the org's approval threshold for scope changes is crossed (pull the actual number from `skill_defaults.prioritize` — do not invent it) | A cutline computed against stale capacity silently promotes work that should have been re-evaluated |

## Anti-patterns

| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Scoring without naming the framework | Unreproducible — a second reviewer can't check the arithmetic or challenge an input | State RICE/WSJF/Kano/custom explicitly, with every input shown, before the score appears |
| Reach measured in raw total users | Inflates low-value-per-user features that happen to touch everyone | Define reach as the segment actually affected per period, not the whole install base |
| Confidence set from conviction, not evidence | A 100% confidence with no data behind it multiplies a guess by 1.0 and calls it certainty | Confidence maps to evidence: 100% = validated data/experiment, 80% = partial data, 50% = opinion only — no confidence claim without naming which |
| Silent cutline | Hides which items got cut and why, so the trade-off can't be challenged | Publish the deferred list alongside the ranked list every time |
| Re-scoring after seeing the "wanted" winner | HiPPO in a spreadsheet: authority overrides the framework instead of feeding into it | Freeze criteria and weights before scoring; treat a late executive opinion as one more input to the next cycle, not a script edit to this one |

## Worked example

- *Weak:* "I ranked these: mobile push notifications, then billing export, then the onboarding tweak." No formula, no inputs, no cutline — this is one person's gut order.
- *Sharp:* "RICE, standard scales: billing export scores 400 (reach 500 accounts/quarter × impact 2x × confidence 80%, based on 40 support tickets citing it, ÷ effort 0.2 person-months). Mobile push scores 90 (reach 2,000/quarter × impact 1x × confidence 50% — unvalidated hunch about engagement ÷ effort 2.5). Onboarding tweak scores 60. Cutline: ship billing export and mobile push this cycle `[estimate]` since mobile push confidence is only 50%; onboarding tweak is deferred and gets re-scored once we have activation data instead of a guess."

## What this skill must not do

- Does not create or transition tickets — output is a scored table and cutline, not a Jira mutation (hand off to `jstack:jira-intake`/`jstack:jira-create`).
- Does not invent this org's actual reach, revenue, or effort figures — pull from provided data or ask; an unlabeled invented number is worse than a stated `[assumption]`.
- Does not rank or compare people — this scores work items, never a stack-rank of who is more valuable to the team.
- Does not treat a roadmap position produced here as a delivery date commitment; sequencing is not a promise.
""",
    "sdlc": """
## Domain rules — sdlc

**Absolute rules**

1. Every stage gate has entrance criteria (what must be true to start the phase) and exit criteria (what must be true to leave it), evaluated by a named decision owner — not a committee vote and not "whoever argues hardest in the room" ([Stage-Gate International](https://www.stage-gate.com/blog/the-stage-gate-model-an-overview/)).
2. A silently skipped gate is worse than an absent one. An absent gate is a known process gap someone can fix; a silently skipped gate looks compliant on paper while carrying the actual risk of no gate at all — the failure is invisible until it surfaces downstream.
3. Any gate bypass requires a written risk-acceptance record: named risk, named owner, named approver, and an expiration/review date. Risk acceptance without an expiration is not risk acceptance — it is an unmanaged exception that never gets revisited ([security exception vs. risk acceptance](https://www.fairinstitute.org/blog/security-exception-vs.-risk-acceptance-whats-the-difference)).
4. Schema and API changes that break existing callers use expand → migrate → contract (parallel change), never a single big-bang cutover: add the new form alongside the old (expand), move every caller over (migrate), then remove the old form only once nothing still calls it (contract) ([Martin Fowler — Parallel Change](https://martinfowler.com/bliki/ParallelChange.html); [Evolutionary Database Design](https://martinfowler.com/articles/evodb.html)).
5. The contract phase never proceeds while any caller still depends on the old form — "most callers migrated" is not a contract-ready state, it is a production incident waiting for the one caller that wasn't checked.
6. No production release ships without a stated revert plan, decided before deploy, not improvised after something breaks. A rollback plan that has never been executed is a hope, not a plan ([rollback plan checklist](https://www.manifest.ly/use-cases/software-development/rollback-plan-checklist); [AWS — Ensuring Rollback Safety](https://aws.amazon.com/builders-library/ensuring-rollback-safety-during-deployments/)).
7. Gate evidence is scoped to the current release. A test run, sign-off, or security scan from a prior build does not satisfy this cycle's exit criteria just because "nothing changed much."

## Thresholds

| Signal | Threshold | Why |
|---|---|---|
| Parallel-change contract readiness | 0 remaining callers on the old form (100% migrated) | "Nearly all" leaves exactly the caller that breaks on removal — Fowler's pattern only holds at 100% |
| Risk-acceptance record | Must carry an expiration/review date; missing one = invalid record | Time-bound is the defining property that separates a risk acceptance from a silent, permanent exception |
| Rollback validation | Exercised at least once (staging or a scoped prod test) before being relied on | An untested rollback path routinely fails at the exact moment it's needed |
| Gate evidence age | Evidence older than the current release cycle does not count toward this gate | Prevents a stale test run or approval from silently covering a changed codebase |

## Anti-patterns

| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Skipping a gate under deadline pressure with no record | Invisible risk — nobody downstream knows the gate didn't run, so nobody compensates | Write the risk-acceptance record even under pressure; a documented skip is a decision, a silent one is a landmine |
| Big-bang schema cutover | No window to catch a missed caller before it's broken in production | Expand, migrate every caller, verify zero remaining old-form usage, then contract |
| Rollback plan written after the incident starts | Improvised under pressure, untested, and often blocked by the very outage it's meant to fix | Write and test the revert plan before the release ships |
| Treating a gate as a rubber stamp | Criteria exist on paper but nobody actually checks them against evidence | Require the decision owner to name which specific evidence satisfied which specific criterion |
| Reusing last release's sign-off for this release | Evidence goes stale the moment the code it covered changes | Regenerate gate evidence per release; carry-forward is not evidence |

## Worked example

- *Weak:* "We're behind schedule, so we're skipping the security review gate for this release and shipping anyway."
- *Sharp:* "Security review gate cannot be silently skipped. Here is the risk-acceptance record instead: risk = unreviewed auth-path change in this release; owner = the feature's tech lead; approver = security lead; mitigation = feature-flagged off by default, review scheduled within 5 business days; expiration = record auto-invalidates if not reviewed by then, at which point the flag stays off. This is a documented, time-bound decision, not an absent gate."

## What this skill must not do

- Does not make Jira state changes or trigger deploys — it produces gate checklists and risk-acceptance narrative for humans to act on.
- Does not invent this org's actual gate policy, approval chain, or SLA windows — read from `prompts/policies/` or config when available and label `[assumption]` when it isn't; describe the shape of an org-specific threshold ("above the configured approval threshold") rather than making up a number.
- Does not approve its own risk-acceptance record — it drafts the record; a human approver signs it.
""",
    "self/eval": """
## Domain rules — self/eval

**Absolute rules**

1. Every impact claim needs at least one concrete, dated example behind it. A claim with no example attached is an impression, not an assessment — if you can't name the instance, don't make the claim.
2. Self-ratings must be calibrated against evidence, not confidence alone. Research on self-assessment accuracy found bottom-quartile performers grossly overestimate their ability, while top-quartile performers underestimate theirs — in one study, top performers scoring in the 86th percentile rated themselves at only the 68th ([Dunning–Kruger effect](https://en.wikipedia.org/wiki/Dunning%E2%80%93Kruger_effect)). Both directions are miscalibration; neither confident overclaiming nor reflexive underclaiming is more "humble" or more honest by default — evidence decides, not instinct.
3. An activity list is not an impact statement. "Attended 12 meetings," "reviewed 40 PRs," and "shipped feature X" are outputs; none of them says what changed as a result. Every bullet needs the consequence named, not just the action taken.
4. "Shipped X" is not impact without the consequence attached. Shipping is an output; impact is what shipping X caused — a metric that moved, a workflow that got faster, an incident that stopped recurring ([output vs. outcome](https://productschool.com/blog/analytics/output-vs-outcome); [Intercom — ship outcomes, not features](https://www.intercom.com/blog/outcomes-vs-features/)). If the consequence can't be named, say so rather than implying it by proximity.
5. Growth framing names a next behavior, not a trait. "Be more strategic" is unfalsifiable and unactionable; "in the next planning cycle, write the problem statement before proposing a solution" is a specific, checkable behavior change.
6. Exactly one growth goal per eval cycle, stated as a behavior with a timeframe — not a list of aspirations that dilutes into nothing being prioritized.
7. This is personal reflection, not formal HR input, unless the user explicitly says otherwise — do not imply institutional weight the artifact doesn't have.

## Thresholds

| Signal | Threshold | Why |
|---|---|---|
| Evidence per claim | ≥1 concrete, dated instance per impact claim | Zero examples means the claim is an impression, not a self-assessment |
| Activity-vs-impact ratio | If most bullets name an action with no stated consequence, flag the draft as activity-heavy | An eval that is majority activity-listing under-serves the actual question ("what changed because of this work") |
| Growth goals | Exactly 1 named next-behavior goal per cycle | More than one dilutes focus; zero means the eval has no forward motion |
| Self-rating vs. evidence gap | A rating that moves >1 tier (e.g., "exceeds" to "meets") from what the cited evidence supports, in either direction | Matches the calibration failure pattern in both directions — over- and under-claiming both need a check against the actual examples listed |

## Anti-patterns

| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Listing activities as accomplishments | "Shipped X, attended Y, reviewed Z" says nothing about effect | Attach the consequence: what metric, workflow, or outcome changed because of the activity |
| Rating from confidence instead of evidence | Confident self-assessment with no examples is exactly the overclaiming pattern the research warns about | Write the examples first, then let the rating follow from what they actually show |
| Reflexive underclaiming by strong performers | Understating real impact denies the evidence the same way overclaiming does — both are miscalibration | Check the rating against the evidence list, not against a feeling of not wanting to overstate |
| Growth goal as a trait ("be more proactive") | Unfalsifiable — no way to check in two weeks whether it happened | Restate as a specific behavior with a timeframe ("propose the next sprint's risk list before planning starts") |
| Comparing self to named peers | Turns a personal reflection into a ranking exercise and drags another person's performance into a document about your own | Describe your own evidence only; if comparison is unavoidable, describe the situation, not the peer by name |

## Worked example

- *Weak:* "This quarter I shipped the onboarding redesign and helped out with the migration. I think I did strong work and should be rated highly."
- *Sharp:* "Shipped the onboarding redesign (Mar–Apr); activation rate for new signups went from 41% to 53% over the following four weeks (evidence: analytics dashboard, dated). Supported the database migration by writing the rollback script that was used when the first attempt failed, avoiding a second full migration window. Next-behavior goal: write the rollback/revert plan before starting a migration, not after the first attempt — this quarter it was reactive."

## What this skill must not do

- Must not become a judgment of a person's worth or character — it evaluates specific, evidenced work in a period, not the person as a whole.
- Must not include another person's PII or performance detail. If teammates appear, name only their role in a shared outcome ("paired with the on-call engineer to..."), never their personal information or an assessment of their performance.
- Must not submit or publish itself anywhere — it stays a draft for the user unless the user explicitly says this is formal HR input.
- Must not fabricate a metric or outcome to make an impact claim look stronger than the evidence supports.
""",
    "pe/report-context": """
## Domain rules — pe/report-context

**Absolute rules**

1. Describe observable behavior, not inferred motive. What someone did, said, or produced is evidence; why they supposedly did it is speculation — "motivation is speculation, behavior is evidence" ([Psychology Today — Motivation Is Speculation, Behavior Is Evidence](https://www.psychologytoday.com/us/blog/how-we-learn/202508/motivation-is-speculation-behavior-is-evidence)). A report that states intent ("they don't care about quality") as fact has crossed from evidence into character judgment.
2. Every claim about a person needs a specific, dated example, ideally in situation-behavior-impact form: what was the situation, what did they do, what resulted. If you cannot name the instance, the claim doesn't belong in the report.
3. Never generalize from a single incident. A pattern claim ("consistently misses deadlines") needs evidence from multiple, separated instances — a single data point supports "on this date, X happened," not a trend.
4. Recency and range both matter: draw evidence from more than one time window (not all from the same week) so a single bad sprint or one good month doesn't dominate the read. A single standout incident can swing a rating by a large margin if left unchecked (the horn/halo effect) — treat any claim resting on one incident as unverified until corroborated ([performance review bias examples](https://sprad.io/blog/performance-review-biases-12-examples-and-how-to-fix-them-with-manager-scripts)).
5. Include only the minimum data necessary for the report's stated purpose. No unrelated personal details — health, family situation, protected-class information, personal opinions traded in confidence — belong in a report about work behavior.
6. State uncertainty explicitly. If evidence is thin, secondhand, or contested, say so rather than presenting it with the same confidence as a directly observed, corroborated fact.

## Thresholds

| Signal | Threshold | Why |
|---|---|---|
| Evidence span | ≥2 separate dated instances, from different time windows, before stating a pattern | One instance is an event; a pattern claim needs more than one data point to be more than an anecdote |
| Recency window | Weight examples from within the current reporting period; anything much older needs an explicit reason for staying relevant | Old, resolved issues shouldn't silently anchor a current assessment |
| Single-incident swing | Any claim resting on exactly one incident is flagged `[single-incident, unverified]` | A single standout event can move an assessment by a large margin (the horn/halo effect) even when it's not representative |
| PII fields in report | Zero unrelated personal identifiers (health, family, protected-class status, private conversations) | The report exists to describe work behavior, not a person's life outside it |

## Anti-patterns

| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Stating motive as fact | "They did this because they don't respect the process" is a guess written as if observed | State the behavior only; if motive is genuinely relevant, mark it explicitly as an inference, not a fact |
| Single-incident generalization | One bad meeting becomes "consistently unprofessional" — the horn effect distorting a whole assessment | Require a second, separate, dated instance before calling something a pattern |
| Vague trait language | "Not a team player," "bad attitude" — unfalsifiable, unactionable, and easy to dispute because there's nothing concrete to point to | Replace with the specific situation-behavior-impact instance that prompted the concern |
| Including unrelated personal information | Health status, family situation, or private confidences have no bearing on work-behavior evidence and create real privacy harm | Include only what's necessary to describe the work-relevant behavior and its impact |
| Reporting hearsay as firsthand observation | "I heard that..." presented with the same confidence as something directly witnessed misleads the reader about evidence quality | Label secondhand information explicitly and note who observed it directly, if known |

## Worked example

- *Weak:* "This person doesn't take feedback well and seems checked out lately."
- *Sharp:* "In the March 14 design review, when asked to revise the API contract, the response was to close the doc without further comment; the revision wasn't made until a second, separate request on March 21. This is one specific instance from one week — flagging it as a single data point, not a stated pattern, since I don't have a second, separated example of the same behavior to corroborate a trend."

## What this skill must not do

- Must not render a judgment about a person's overall worth, character, or potential — it assembles evidence about specific, observable work behavior for a stated, legitimate purpose, nothing broader.
- Must not include another person's PII: health information, family details, protected-class status, or private conversations shared in confidence have no place here.
- Must not state inferred motive as if it were observed fact — motive, if included at all, is explicitly marked as inference.
- Must not generalize a pattern from a single incident, and must not omit the uncertainty when evidence is thin or secondhand.
- Must not be the mechanism that decides a personnel outcome — it prepares context for a human decision-maker; it does not make the decision.
""",
    "incident/oncall-summary": """
## Domain rules — incident/oncall-summary

**Absolute rules**

1. Every handoff carries, at minimum: open/active incidents with current status and severity, silenced or muted alerts with expiration and reason, in-flight mitigations, and current escalation state (who's paged, who's next). Omitting any of these is an incomplete handoff, not a shorter one ([incident.io — on-call best practices](https://incident.io/blog/on-call-best-practices-guide-2026); [OneUptime — on-call handoff procedures](https://oneuptime.com/blog/post/2026-01-27-oncall-handoff-procedures/view)).
2. An unwritten (verbal-only) handoff loses context the moment the outgoing person is unreachable — write it down even when a live handoff conversation also happens. The write-up is the artifact that survives; the conversation is a bonus.
3. Every timestamp carries an explicit timezone or is in UTC. A bare local time is ambiguous the instant the reader is in a different zone, and incident timelines get read by people who weren't on the original call.
4. "Resolved" and "mitigated" are not the same word and must not be used interchangeably. Mitigated means the immediate impact is contained but the root cause or a workaround is still in place; resolved means the underlying issue is actually fixed. Reporting a mitigated incident as resolved sets up the next on-call to be surprised when it recurs.
5. Every silenced alert must state why it's silenced and when the silence expires. A silence with no expiration is a monitoring gap wearing a maintenance excuse.
6. The incoming on-call summarizes the handoff back before the outgoing person signs off — if they can't repeat back the open items, the handoff didn't actually transfer the context.

## Thresholds

| Signal | Threshold | Why |
|---|---|---|
| Handoff checklist coverage | 100% of active incidents, silenced alerts, and in-flight mitigations listed — zero omitted | A single omitted open item is exactly the kind of context loss a handoff exists to prevent |
| Live overlap window | Roughly 30–60 minutes of overlap between outgoing and incoming for a live handoff conversation, when schedules allow | Enough time for questions and clarification without being a full extra shift ([incident.io](https://incident.io/blog/on-call-best-practices-guide-2026)) |
| Silence expiration | Every silenced alert has an expiration; silences left unbounded for more than roughly 24 hours without re-review | An unbounded or stale silence is a live monitoring risk being carried forward invisibly |
| Timestamp format | 100% of logged timestamps carry timezone or UTC | Bare local time is unreadable to the next responder if they're anywhere else |

## Anti-patterns

| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Verbal-only handoff | Evaporates if the outgoing person becomes unreachable; nothing to reference later | Always produce a written summary, even alongside a live conversation |
| Reporting "mitigated" as "resolved" | Sets the next on-call up to be blindsided when the underlying cause resurfaces | State status precisely: mitigated (contained, root cause pending) vs resolved (actually fixed) |
| Omitting silenced alerts because "it's probably fine" | The next on-call inherits a blind spot they don't know exists | List every active silence with reason and expiration, no exceptions |
| Timestamps with no timezone | Ambiguous the moment the reader isn't in the same zone as the writer | Log every timestamp with UTC or an explicit offset |
| Skipping the incoming person's summarize-back | No verification that context actually transferred, just that words were said | Require the incoming on-call to restate the open items before sign-off |

## Worked example

- *Weak:* "Nothing major, one thing might still be acting up, check Slack if you're unsure."
- *Sharp:* "Handoff at 2026-07-27 18:00 UTC. Open: INC-4821 (Sev3, checkout latency), mitigated via cache-warm script re-run at 17:40 UTC, root cause (connection pool exhaustion) not yet fixed, owner: platform team, next check-in 2026-07-27 22:00 UTC. Silenced: `db-replica-lag` alert, silenced 16:00–20:00 UTC by me, reason: known replica catch-up after maintenance, will auto-unsilence at 20:00 UTC. Escalation: primary is me until 18:00 UTC, then you; secondary is unchanged. No other open items."

## What this skill must not do

- Does not itself resolve or mitigate the incident — it documents current state for the next responder.
- Does not declare an incident resolved without verification; when in doubt, report the more conservative status (mitigated, not resolved).
- Does not skip the written record because a verbal handoff happened — both, not either.
- Does not invent an incident's severity or timeline detail it wasn't given — state what is known and flag any gap explicitly.
""",
    "incident/find-sme": """
## Domain rules — incident/find-sme

**Absolute rules**

1. Evidence for "who knows this" comes from code ownership signals — recent commit history, review/approval history, and CODEOWNERS-style mappings — not from reputation or hearsay ("I think it was someone on that team") ([git blame and code ownership](https://www.gitkraken.com/answers/how-code-ownership-tracking-speeds-troubleshooting); [git_sme — identifying experts from commit history](https://github.com/sjaveed/git_sme)).
2. Weight recency: a name that only appears in commits from years ago is a stale lead, not a current SME — verify they're still the right contact before treating the match as current, since ownership drifts as people change teams or leave.
3. Never surface a single name as the only path to the answer without naming the bus-factor risk. If exactly one person has touched a critical file or module in the recent history, say so explicitly — a bus factor of one is itself a finding worth flagging, not just a routing shortcut ([Assessing the Bus Factor of Git Repositories](https://www.researchgate.net/publication/272794507_Assessing_the_Bus_Factor_of_Git_Repositories)).
4. Escalation follows the defined order: primary on-call, then secondary/backup, then team/eng lead. Never skip a level because someone "seems faster to reach" — the order exists precisely so availability doesn't override accountability.
5. Respect on-call boundaries: do not page or interrupt someone who is off-call, on leave, or outside their defined on-call window just because they wrote the code, unless the incident severity and defined escalation policy explicitly call for it.
6. Every candidate returned is labeled with its evidence basis — "3 of the last 5 commits to this file" is a strong lead; "mentioned in a Slack thread once" is hearsay and must be labeled as such, not presented with equal confidence.

## Thresholds

| Signal | Threshold | Why |
|---|---|---|
| Bus factor | ≤2 recent contributors to a critical file/module | Flag as a bus-factor risk worth naming, not just a routing convenience — losing either person leaves a knowledge gap |
| Evidence recency window | Commits/reviews within roughly the last 6–12 months weighted as current; older activity treated as historical context only | Ownership and team membership drift; an old commit doesn't guarantee current expertise or availability |
| Escalation order | Primary → secondary/backup → team lead, in that order, no skipped level | Skipping steps "because it's faster" erodes the reason an escalation policy exists |
| Hearsay confidence | Any lead with zero commit/review/ownership evidence behind it is labeled `[unverified]` | Prevents a rumor from being paged with the same confidence as a documented owner |

## Anti-patterns

| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Paging based on reputation ("ask so-and-so, they know everything") | No evidence trail; may not even be current on this specific code | Check recent commit/review history for the actual file or module in question first |
| Always routing to the same one person | Creates a single point of dependency and burns out the de facto owner | Surface the bus-factor risk explicitly and suggest a second reviewer/owner be established |
| Skipping the escalation order for speed | Undermines the reason the order exists — accountability and coverage, not just speed | Follow primary → secondary → lead; if primary is unresponsive within the policy's window, escalate per policy, not by guessing who's awake |
| Paging someone off-call or on leave without checking policy | Violates on-call boundaries and burns goodwill even when well-intentioned | Check on-call status first; only override for severity levels the escalation policy explicitly allows |
| Presenting a hearsay lead as equal to a verified owner | Misleads the incident commander about how solid the lead actually is | Label every candidate with its evidence basis so confidence is visible |

## Worked example

- *Weak:* "Ping Jordan, I think they built this."
- *Sharp:* "Recent evidence for the payment-retry module: Jordan authored 4 of the last 6 commits and reviewed 2 of the other 2 (last activity 3 weeks ago) — strong current lead. Priya is the only other contributor in the last 12 months (1 commit, 8 months ago) — bus factor of 2 on this module, worth flagging separately. Jordan is off-call this week per the schedule; per escalation policy this is a Sev2, so page the secondary on-call first and loop Jordan in async rather than paging them directly outside their window."

## What this skill must not do

- Does not page or contact anyone directly — it produces a ranked candidate list with evidence and escalation guidance for a human (or the incident commander) to act on.
- Does not override on-call boundaries or the defined escalation order on its own judgment; it surfaces the policy and any tension with it.
- Does not present a single match as definitive without naming the bus-factor risk or the possibility the lead is stale.
- Does not share a candidate's personal availability or off-call details beyond what's needed to route the page appropriately.
""",
}

"""
Deep domain content for the review/* skills: code-review, counsel-review,
project-review, announcement-review.

Each entry overrides CATEGORY_DEEP["review"] for its own key (key-first lookup in
apply_detailed_skills.py), so these four skills carry real domain depth — thresholds,
named anti-patterns, worked examples — without moving to SKIP and losing generation.

Owns exactly: review/code-review, review/counsel-review, review/project-review,
review/announcement-review.
"""
from __future__ import annotations

DEEP: dict[str, str] = {
    "review/code-review": """
## Domain rules — code-review

### Absolute rules

1. **Never approve a diff you have not read.** Approving from the PR title, the description, or a
   one-line summary is not a review — it's a rubber stamp with the reviewer's name on it.
2. **Every posted comment carries an explicit severity prefix**: `Blocking:`, `Nit:`,
   `Optional:`/`Consider:`, or `FYI:`. An unlabeled comment is read as blocking by default and
   stalls the change for no reason.
3. **Approve once the change leaves the codebase healthier than before it landed** — not once it
   matches the reviewer's personal style. Withholding approval because "I'd have done it
   differently" with no cited mechanism is a review defect, not diligence.
4. **State the diff's size and the review's elapsed time.** A pass that silently exceeds roughly
   400 LOC or 60 minutes of continuous reading is under-detecting defects regardless of how
   careful it felt — disclose it so a second pass or a split request is an option.
5. **Say explicitly what was not read.** Vendored code, generated files, or a "trust me, tested it
   live" hotfix folded into the same PR are common places an unread diff hides; name them instead
   of implying full coverage.
6. **First response lands within one business day**, even when the substantive review isn't done.
   A fast "will finish by Thursday" produces fewer author complaints than a thorough review that
   arrives silently late.
7. **A missing test for a changed code path is a finding, not an assumption to skip.** State it as
   a defect with a severity label; do not wave it through because CI is green on unrelated paths.

### Thresholds

| Signal | Threshold | Source |
|---|---|---|
| Review size ceiling | 200–400 LOC per review pass; detection density drops sharply beyond it | [SmartBear/Cisco — 11 Best Practices for Peer Code Review](https://smartbear.com/learn/code-review/best-practices-for-peer-code-review/) (2,500 reviews, 3.2M LOC) |
| Review pace | 300–400 LOC/hour finds the most defects; above ~450 LOC/hour, defect density found drops below average | [SmartBear/Cisco](https://smartbear.com/learn/code-review/best-practices-for-peer-code-review/) |
| Session length | ≤~60 minutes of continuous review | [SmartBear/Cisco](https://smartbear.com/learn/code-review/best-practices-for-peer-code-review/) |
| First response latency | ≤1 business day | [Google eng-practices — Speed](https://google.github.io/eng-practices/review/reviewer/speed.html) |
| Approval bar | "Improves overall code health," not "is perfect" | [Google eng-practices — Standard of code review](https://google.github.io/eng-practices/review/reviewer/standard.html) |

### Named anti-patterns

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| Rubber-stamp "LGTM" | Signs off on unread risk; the approval stops meaning anything the first time it's caught doing this | State what was actually read (diff, tests, blast radius) before approving |
| Nitpick-only review | Buries the one blocking defect under twenty style comments; the author can't tell what matters | Severity-label every comment; lead with `Blocking:`, push style to `Nit:` |
| Review-by-preference (bikeshedding) | Personal taste dressed as correctness stalls a mergeable change on an unfalsifiable argument | Defer to the style guide where one exists; otherwise say "preference, not blocking" explicitly |
| Silently absorbing an oversized diff | Blows the ~400 LOC ceiling; defect detection collapses without anyone noticing it happened | Ask the author to split the PR, or disclose partial coverage and flag the risk |
| Approving vendored/generated code by omission | The reviewer implicitly signs off on code nobody actually looked at | Name exactly what was and wasn't read in the review summary |
| Blocking on taste with no cited mechanism | Costs the author a round-trip for a claim that can't be verified or disproven | Cite the concrete mechanism (a defect class, a threshold, a race) or downgrade to `Nit:` |

### Worked example

- *Weak:* "This query might have an issue, worth a look."
- *Sharp:* "`Blocking:` `getUserOrders()` (`api/orders.ts:42`) interpolates `req.query.status`
  directly into the SQL string (`WHERE status = '${status}'`) — this is a SQL-injection vector
  reachable from an unauthenticated query param. Use a parameterized query
  (`db.query('... WHERE status = $1', [status])`) before merge; this is not a style preference,
  it's an injectable input with no sanitization on the path."

### What this skill must not do

- Does not perform multi-persona synthesis across roles (EM/PM/design/security) — that reconciliation
  belongs to `jstack:counsel-review`.
- Does not substitute for CI: it flags a missing test as a finding, it does not run the suite itself
  or assert coverage it hasn't verified.
- Does not grant final merge authority over policy-gated changes (security-sensitive, migration,
  billing) without the human sign-off the org's policy requires.
- Does not review non-code artifacts (announcements, project updates) — those route to
  `jstack:announcement-review` and `jstack:project-review` respectively.
""",
    "review/counsel-review": """
## Domain rules — counsel-review

### Absolute rules

1. **Never vote-count.** "4 of 5 lenses approved" is not a verdict — severity and evidence quality
   decide, not headcount.
2. **Every finding is attributed to the lens that raised it.** An unattributed "there are concerns
   about X" has already lost the information a reader needs to weigh it.
3. **A minority objection blocks the verdict when it is high-severity and well-evidenced**,
   regardless of how many other lenses stayed silent on it — silence from lenses outside their
   expertise is not disagreement with the one that spoke.
4. **Separate factual disagreement from values/priority disagreement.** "Does this lock the table
   for 40 minutes" is checkable — resolve it with evidence before it reaches the user. "Is a
   40-minute lock acceptable given the launch date" is the user's call, not this skill's to
   adjudicate by fiat.
5. **Never average two opposed positions into a synthetic middle ground nobody argued for.** If one
   lens says ship and another says block, the output states both and names the actual
   disagreement — it does not quietly produce "proceed with caution."
6. **Hold each lens against its own material before comparing.** Synthesizing from a guess at what
   a persona "would probably say" produces one voice wearing several hats, not multi-perspective
   review.
7. **State severity and confidence as two separate axes.** A finding can be high-severity and
   low-confidence at once ("if true, this blocks ship, but it's unverified") — collapsing that into
   one adjective hides exactly what a reader needs to check next.
8. **Unanimous approval from lenses shown the same shallow summary is not strong evidence.** Treat
   an unexplained 5-for-5 as a possible consensus-theater signal worth a second, deeper pass before
   reporting it as agreement.

### Thresholds

| Signal | Threshold | Source |
|---|---|---|
| Confidence band | High ≥80% (directly verified) · Medium 50–79% (plausible, unverified) · Low <50% (speculation) | judgment convention — state the band, not a bare adjective |
| Individual accuracy alone, unambiguous judgment | >99% correct with no group pressure present | [Asch conformity experiments](https://en.wikipedia.org/wiki/Asch_conformity_experiments) |
| Conformity under unanimous wrong-group pressure | 35.7% of individual trial responses conformed; 74% of participants conformed at least once across 12 trials | [Asch conformity experiments](https://en.wikipedia.org/wiki/Asch_conformity_experiments) |
| Minority-objection override bar | One high-severity, evidenced objection outweighs several low-severity approvals — never a nose count | structural rule (Prime Directive 3), not a vote |

### Named anti-patterns

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| Vote-counting | Treats headcount as evidence when severity and evidence quality are what actually matter | Rank by severity × confidence; state that a lone objection is blocking and why |
| Averaging conflicting positions | "Ship with monitoring" when nobody argued for that middle ground invents a position out of thin air | State both positions, name what they actually disagree about, let the user decide |
| Dropping the dissent | A lens's objection quietly disappears from the summary because it complicates a clean verdict | Every dissent meeting the severity bar appears, attributed, even if the final call overrides it |
| Unattributed synthesis | Rewriting findings in the synthesizer's own voice loses which lens actually raised each one | Tag every finding with its source lens; paraphrase closely, don't rewrite with new confidence |
| Consensus theater | All lenses "approve" because they were shown one shared surface-level summary, not their own checklist | Run each lens against its own material and hard-reject list independently before comparing |
| Blending factual and values disagreements in one line | Flattens a checkable claim into the same bucket as an unresolvable priority call | Tag each finding factual or values/priority; resolve factual ones with evidence first |

### Worked example

- *Weak:* "The team reviewed the migration plan and everyone thinks it's basically fine, just
  tighten up the rollback section."
- *Sharp:* "**Engineer lens** (high confidence, factual): the migration in `migrate_v2.sql` adds a
  `NOT NULL` column with no down-migration — checked directly, not disputable, ~1 day to add.
  **PM lens** (values/priority): launch date is fixed by a partner contract; a 1-day slip risks a
  penalty clause. **Tension:** this is not a facts disagreement — both lenses agree the
  down-migration is missing. The real tension is whether a 1-day slip against a contractual
  penalty is acceptable. **Verdict: revise** — add the down-migration regardless of date (checkable,
  not optional); the date-vs-penalty tradeoff is the user's call, not resolved here. What would
  change it: if the down-migration already exists in a shared runbook, this drops from blocking to
  a minor note."

### What this skill must not do

- Does not invent a lens's opinion when its persona material is unavailable — skip that lens
  explicitly and say so.
- Does not perform the single deep technical read itself — `jstack:review-code-review` owns
  line-level diff findings; this skill reconciles perspectives that already exist.
- Does not resolve a values/priority tension on the user's behalf — it names the tension and the
  evidence that would move it, then asks.
- Not a substitute for a real-time, no-time-to-hold-lenses-independently decision — if there isn't
  time to run each lens on its own material, say so rather than faking a synthesis.
""",
    "review/project-review": """
## Domain rules — project-review

### Absolute rules

1. **A status with no updated evidence for a full reporting cycle is Amber, not Green.** Silence
   is not "no news is good news" — it is itself a signal that must be reported as such.
2. **RAG color must trace to a measurable, pre-agreed trigger, not a feeling.** If no threshold was
   set, say that explicitly rather than assigning a color from vibes.
3. **Name which of three causes explains a schedule slip: scope growth, underestimation, or
   blockage.** A bare "we're behind" line conflates causes that need different fixes — descoping
   fixes scope growth, re-estimating fixes underestimation, neither fixes an external blocker.
4. **A status that jumps directly from Green to Red is itself a reporting failure**, independent of
   whatever caused the underlying delay — flag the missing Amber step, not just the current color.
5. **Never accept "done" on say-so.** A milestone is complete only against the artifact or evidence
   it was defined to produce; ask for it before marking it closed.
6. **Schedule confidence must scale with project phase.** An estimate made at kickoff carries far
   more uncertainty than one made after detailed design — an unrevised kickoff-era number still
   being reported at execution time is itself a red flag.
7. **A recovery plan attached to Amber or Red names an owner and a date.** "We'll monitor" is not a
   plan; it's a status with the accountability removed.

### Thresholds

| Signal | Threshold | Source |
|---|---|---|
| Schedule variance | Green ≤5% behind plan · Amber 5–15% behind · Red >15% behind with no approved recovery plan | [ClearPoint Strategy — RAG status for KPIs](https://www.clearpointstrategy.com/blog/establish-rag-statuses-for-kpis) |
| Budget variance | Green ≤10% over · Amber 10–20% over · Red >20% over | [ClearPoint Strategy — RAG status for KPIs](https://www.clearpointstrategy.com/blog/establish-rag-statuses-for-kpis) |
| Estimate uncertainty (Cone of Uncertainty) | Initial concept: 4x–0.25x (16x spread) narrowing to ~1.1x–0.9x once detailed design is complete | [Construx — The Cone of Uncertainty](https://www.construx.com/books/the-cone-of-uncertainty/) |
| Stale-status window | No new evidence for 1 full reporting cycle → report Amber, not the prior color | [Reworked — "Why Everything's Green Until It's Red"](https://www.reworked.co/collaboration-productivity/the-yellow-zone-why-perfect-status-reports-are-killing-your-projects/) |

### Named anti-patterns

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| Watermelon status (green outside, red inside) | The report says Green while anyone on the ground knows it's in trouble | Attach RAG to objective, pre-agreed triggers; escalate on evidence, not optimism |
| "Green until suddenly Red" | By the time it's undeniably Red, it's usually too late to recover cleanly | Require Amber as a mandatory intermediate step once a trigger is crossed |
| One "behind schedule" line covering three different causes | Hides which lever actually fixes it — cutting scope doesn't fix a blocked dependency | Name the specific cause (scope growth / underestimation / blockage) and its specific fix |
| Reusing a kickoff-era estimate unrevised at execution | Cone of Uncertainty implies 2–4x error at that phase; treating it as still accurate is itself a risk | Re-estimate at each phase gate and disclose whether the range actually narrowed |
| "We'll monitor" as the stated recovery plan | No owner, no action, no date — not actually a plan | Name an owner, a concrete action, and a date to re-check |
| Scope growth absorbed silently with no rebaseline | The original schedule becomes meaningless but is still reported against it | Rebaseline explicitly and disclose that the comparison point moved |

### Worked example

- *Weak:* "The project is a bit behind but should be fine, team is working hard."
- *Sharp:* "Status: **Amber** (was Green last cycle, no rebaseline since). Schedule variance is 11%
  behind the approved baseline — inside the Amber band (5–15%) — driven by two integration
  requirements the sponsor approved on [date], not by underestimation of the original scope. This
  is scope growth, not blockage: no external dependency is stalling work. Recovery: engineering
  lead owns a decision by Friday to either descope the v2 reporting item or accept a 1-week slip."

### What this skill must not do

- Does not perform the multi-persona ship/no-ship synthesis — that's `jstack:counsel-review`; this
  skill evaluates the project update itself against schedule, scope, risk, and stakeholder signals.
- Does not invent a baseline, an approval date, or a milestone definition that wasn't provided —
  ask for it or say the status can't be computed without it.
- Does not make the final go/no-ship call — it surfaces risk and a recommended color; the sponsor
  or stakeholder owns the decision.
- Not for evaluating individual contributor performance behind a slip — that's EM territory, not a
  project-status finding.
""",
    "review/announcement-review": """
## Domain rules — announcement-review

### Absolute rules

1. **Verify destination and audience before reviewing content quality.** An accurate, well-toned
   message sent to the wrong distribution list is still a failed send — content review cannot fix
   an addressing error after the fact.
2. **Never let a draft publish without a named approver's sign-off recorded before send.** An
   unnamed "looks good" in a thread is not an approval trail; approval happens before publish,
   never after ("we'll fix it if someone complains" is not a process).
3. **Internal and external tone are not a find-replace of each other.** External copy needs its own
   pass against legal/compliance-sensitive language (forward-looking statements, specific numbers,
   customer or partner commitments) that an internal-only draft doesn't require.
4. **Check explicitly for content that must never leave the org** — unreleased financials,
   incident specifics before the comms lead clears them, individual PII or performance detail,
   unannounced roadmap — before reviewing tone. Assume it might be present; don't assume it's
   absent.
5. **Any unresolved placeholder blocks publish**, regardless of how polished the rest of the draft
   reads — a stray `[DATE]`, `[NAME]`, or `TODO` that ships is a completeness failure, not a nit.
6. **When the audience is ambiguous, review against the stricter (external) standard** until it's
   confirmed internal-only — assuming the more permissive standard is the wrong default when wrong.
7. **Draft first, select the recipient/distribution last.** Autocomplete-filled recipient fields
   populated before the sensitive content is finished are a recurring cause of wrong-audience
   sends.

### Thresholds

| Signal | Threshold | Source |
|---|---|---|
| Named approval sign-off | At least one designated final-approval point per message, recorded before send | [PRSA — Crisis Communications Checklist](https://jobs.prsa.org/career-resources/finding-talent-10/crisis-communications-checklist-24-hour-response-protocol-405) |
| Internal-before-external release lag | Internal stakeholders informed before the public/external release, not after | [PRSA — Crisis Communications Checklist](https://jobs.prsa.org/career-resources/finding-talent-10/crisis-communications-checklist-24-hour-response-protocol-405) |
| Recipient-selection order | Draft and review content before populating the recipient/distribution field | [MindTools — 10 Common Communication Mistakes](https://www.mindtools.com/ar0qk6t/10-common-communication-mistakes/) |
| High-stakes template pre-approval | Template approved by legal/leadership in advance of need, not drafted live under time pressure | [PRSA — Crisis Communications Checklist](https://jobs.prsa.org/career-resources/finding-talent-10/crisis-communications-checklist-24-hour-response-protocol-405) |

### Named anti-patterns

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| Reviewing tone before verifying destination | A perfectly-toned message to the wrong list is still a failed send | Confirm audience and distribution first; review content second |
| Auto-filled recipient before drafting sensitive content | Autocomplete recipient fields are a recurring cause of wrong-audience sends | Draft first, select the recipient deliberately last |
| Publish-then-fix | Treats the live channel as a scratchpad and the audience as beta testers | Require an approval gate before publish, not a correction plan after |
| Find-replace between internal and external drafts | External copy needs its own legal/compliance-sensitive pass, not a search-replace of internal language | Review external copy against its own checklist, independent of the internal draft |
| Unnamed "LGTM" treated as approval | No accountable approver if the send causes a problem | Record a named approver and a timestamp before send |
| Defaulting ambiguous audience to "internal" | Understates risk when the message actually reaches outside the org | Default to the stricter external standard until audience is confirmed |

### Worked example

- *Weak:* "This announcement reads fine, ship it."
- *Sharp:* "`Blocking:` distribution is set to the company-wide list, but paragraph 3 references an
  unreleased roadmap item scoped to one team — this list includes contractors outside that scope.
  Hold send until either the roadmap reference is removed or distribution is narrowed to the
  intended team. Also `Blocking:` the `[DATE]` placeholder in paragraph 2 is still unresolved.
  Tone and structure otherwise fit an internal-all-hands announcement; no legal-sensitive language
  flagged."

### What this skill must not do

- Does not author the announcement's original content as its primary job — it reviews a draft that
  already exists, or asks for one to be produced first.
- Does not itself grant approval — it recommends approve/revise/block; a named human owns the
  actual sign-off.
- Does not perform multi-persona ship/no-ship synthesis across legal, PR, and executive stakes —
  route that reconciliation to `jstack:counsel-review` when the call spans more than tone/accuracy.
- Does not review source code or technical diffs — that's `jstack:review-code-review`.
""",
}

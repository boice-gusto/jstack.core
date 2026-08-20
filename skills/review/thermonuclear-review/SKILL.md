---
name: jstack-thermonuclear-review
description: >-
  Dispatches a diff/PR/file set to six independent lenses in parallel — security, compliance,
  performance, code quality, QA/testability, and AI-slop detection — then combines them into one
  severity-ranked list, never a blended verdict. Every finding is attributed to the lens that
  raised it and cites concrete evidence.
  Use for a high-stakes change, a security-sensitive surface, or a pre-launch review — not a
  routine PR. For a routine PR, use `jstack:review-code-review` (single lens, lighter weight). For
  a cross-role ship/no-ship call without this skill's security/compliance/AI-slop depth, use
  `jstack:counsel-review`. This skill complements both; it replaces neither.
when_to_use: >-
  "thermonuclear review," "exhaustive review," "audit this before we ship," "give me every lens on
  this," "security and compliance and everything review," "tear this diff apart," "pre-launch
  review," "review this like the launch depends on it."
category: review
effort: high
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config, diff_or_artifact -->
<!-- outputs: structured_result -->
<!-- chains-to: jstack:plugin/create-plugin-pr, jstack:jira -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md
Load the policy this domain is governed by (do not restate it from memory):
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/policies/review-policy.md

## What this skill is for

Run six independent review lenses — security, compliance, performance, code quality,
QA/testability, and AI-slop detection — against the same artifact **in parallel**, then combine
them into one severity-ranked list where every finding is still attributed to the lens that raised
it. This is deliberately heavier than a single-pass review: reserve it for a high-stakes change, a
security-sensitive surface (auth, payments, PII, admin tooling), or a pre-launch sweep — not a
routine PR.

- **Out of scope:** Routine PR review (`jstack:review-code-review` is lighter-weight and sufficient
  there); a cross-role ship/no-ship call that doesn't need this skill's specific lens set
  (`jstack:counsel-review`); merging or approving; writing the fix itself.

## Domain rules — thermonuclear-review

This skill sits above `jstack:review-code-review` (one deep technical lens) and
`jstack:counsel-review` (multi-persona reconciliation across CEO/PM/eng/QA/design). It borrows
`jstack:counsel-review`'s exact independence-and-attribution discipline — see
[`skills/review/counsel-review/SKILL.md`](../counsel-review/SKILL.md) — and applies it to six
review-specific lenses instead of five stakeholder personas, with two lenses (security, AI-slop)
that neither existing skill goes deep on.

### Absolute rules

1. **Every lens reports independently and is attributed by name.** An unattributed "multiple
   issues were found" has already lost the information a reader needs to weigh it — reuse
   `jstack:counsel-review`'s Prime Directive 1 verbatim: every finding names the lens that raised
   it.
2. **Never run the six lenses sequentially in one continuous context.** Draft each lens's findings
   before reading any other lens's output — the same "isolate each lens before reconciling"
   determinism rule `jstack:counsel-review` applies to five personas, applied here to six lenses.
   When the host supports it, dispatch one subagent per lens via the Agent tool in a single batch
   of parallel calls so isolation is structural, not a matter of discipline.
3. **Never collapse the six lenses into one synthesized paragraph.** Render findings as an
   attributed table (lens, finding, evidence, severity) before any cross-lens ranking happens.
4. **A finding needs concrete evidence — a `file:line` citation or an exact quoted excerpt.** No
   lens gets to hand-wave ("this could be more secure," "consider more tests," "this feels
   AI-generated"). Drop an unevidenced claim rather than passing it through as a finding.
5. **Cap findings per lens at 8**, ranked by that lens's own severity scale. If a lens's true count
   is higher, state the cap and how many were cut — this skill's value is depth on real issues, not
   volume; an uncapped lens becomes an infinite nitpick generator.
6. **Rank the combined finding set by severity across all six lenses at the end**, not lens by
   lens with no prioritization. State the ranking method (severity × impact/exploitability), not
   "security's findings go first because security is scary."
7. **A lens with nothing to report says so explicitly**, and that silence is not treated as
   confirmation the artifact is clean in that dimension — the same caution
   `jstack:counsel-review` applies to a suspiciously unanimous five-for-five approval.
8. **Never flag something as AI-slop merely because it is short or simple.** Simple, correct,
   idiomatic code matching the codebase's existing patterns is not slop — see the AI-slop dimension
   below for what actually qualifies.

### Lens roster and routing

| Lens | Routes to | Why this owner |
|---|---|---|
| Security | `security-auditor` agent | OWASP-grounded exploitability lens; not covered by any other agent in this roster. |
| Compliance | `compliance-officer` agent | Data-handling/regulatory-risk lens; explicitly not legal advice — see that agent's disclaimer. |
| Performance | `staff-engineer` agent, **not** `architect` | `architect`'s own "what this agent does NOT own" table restricts it to findings that cross a service/module boundary ("only weigh in if the diff crosses a service/module boundary"); most diff-level performance findings (an O(n²) loop, an N+1 query, a redundant round trip, a missing index) are single-lens technical reads inside one file or service — `staff-engineer`'s charter. If a performance finding turns out to be structural (a new synchronous cross-service hop, a compounding-availability concern), the performance lens states that explicitly and hands it to `architect` rather than resolving it itself. |
| Code quality | `staff-engineer` agent | Complexity, debt, maintainability — the same lens `staff-engineer` applies to `jstack:review-code-review`. |
| QA / testability | `qa-engineer` agent | Whether a test would catch a regression of each other lens's findings, plus its own boundary/coverage sweep. |
| AI-slop detection | This skill's own checklist below — **no dedicated agent** | See "Why no dedicated agent" below. |

Performance and code quality both route to `staff-engineer`. Run them as **two separately-isolated
passes with distinct rubrics** (performance: algorithmic complexity, N+1s, resource use;
quality: complexity/debt/maintainability) — do not let one pass answer both questions at once, or
the "six independent lenses" claim degrades into five.

### Why no dedicated agent for AI-slop detection

AI-slop detection is a concrete, mechanical pattern-match against known LLM-code-generation
smells, not a standing professional expertise that other skills would independently dispatch —
unlike security or compliance, no other skill in this catalog has a reason to invoke "the AI-slop
lens" on its own. It's written directly into this skill's body instead of as a seventh agent so the
checklist stays colocated with the orchestration logic it's tightly bound to, without inflating the
agent roster with a persona that has no reuse case elsewhere.

### The AI-slop-detection checklist (apply directly, no persona needed)

Sweep the artifact against every row below. State which rows actually fired — do not report all
six by rote if only two apply.

| Pattern | What it looks like | Why it's a tell |
|---|---|---|
| Generic/boilerplate error handling | A `catch`/`except` block that logs a generic message and swallows the error, when every other error path in this codebase re-throws a typed error or attaches structured context | LLM completions default to the most generic error-handling shape they've seen, not the one this codebase actually uses |
| Comments explaining WHAT, not WHY | `// increment the counter` above `counter++`, with no comment where a genuinely non-obvious constraint exists (a timeout value, a magic number, an ordering requirement) | Restates code in prose instead of documenting the one thing a reader couldn't infer from the code itself |
| Unnecessary abstraction for a single call site | A new interface, factory, or strategy pattern wrapping one concrete implementation with exactly one caller | LLM completions often reach for "proper" architecture patterns regardless of whether the call-site count justifies the indirection |
| Defensive validation for input that can't occur | A null-check, type-check, or range-check on a value that the caller graph guarantees is already valid (e.g., re-validating a value the function three lines up already validated and never mutated) | Pattern-matches "always validate inputs" without checking what this specific caller graph actually allows |
| Suspiciously uniform structure across functions that should differ | Three functions handling genuinely different business rules but sharing near-identical shape, variable names, and comment cadence, where the codebase's own established pattern for this kind of function varies more | A tell that each function was independently generated from a similar prompt rather than following the codebase's actual convention |
| Trailing "helper" utilities duplicating shared lib | A new `formatDate()`, `deepClone()`, or `retry()` added at the bottom of a file when an equivalent already exists in the shared lib (`cli/src/lib/`, `utils/`, etc.) | LLM completions frequently reinvent a small utility rather than searching for the existing one |

**Explicit non-slop clause:** short, simple, correct code that matches the codebase's existing
patterns is not a finding under any row above. A ten-line function with no comments and no
abstraction is not slop; it's just short.

### Thresholds

| Signal | Threshold | Source |
|---|---|---|
| Findings cap per lens | 8, ranked by that lens's own severity; state the count cut if truncated | This skill (Absolute Rule 5) |
| Lens independence | Draft each lens's findings before reading any other lens's output | `jstack:counsel-review` "Isolate each lens" determinism rule |
| Minority-objection override | One high-severity, evidenced finding from a single lens outweighs five lenses reporting nothing on that surface | `jstack:counsel-review` Prime Directives 3 and 6 |
| Diff size per lens pass | 200–400 LOC per pass finds the most defects; state the size and consider splitting the dispatch above it | [SmartBear/Cisco — 11 Best Practices for Peer Code Review](https://smartbear.com/learn/code-review/best-practices-for-peer-code-review/) (same ceiling `jstack:review-code-review` and `staff-engineer` use) |
| Confidence band (per finding) | High ≥80% (directly verified) · Medium 50–79% (plausible, unverified) · Low <50% (speculation) | `jstack:counsel-review` confidence-band convention |

### Named anti-patterns

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| Sequential-lens anchoring | Running all six lenses back-to-back in one context lets lens 2–6 read lens 1's framing before forming their own, producing one voice wearing six hats | Draft each lens's findings before reading any prior lens's output; use isolated subagent dispatch when the host supports it |
| Collapsing six takes into one paragraph | Loses which lens actually raised each finding, and hides where lenses genuinely disagree on severity for the same code | Attributed table first (lens, finding, evidence, severity); synthesis and ranking come after, never instead of |
| AI-slop-by-simplicity | Flags short, idiomatic, correct code as "clearly AI-written" with no actual pattern match from the checklist | Cite the specific checklist row that fired; if none fired, the code isn't a finding regardless of how it "feels" |
| Unranked lens-by-lens dump | Six sections of findings with no combined priority order leaves the reader to do the actual triage | Rank the combined set by severity × impact once all six lenses have reported, in a section separate from the per-lens tables |
| Uncapped nitpicking | A lens with no cap produces 40 style notes that bury the 2 real findings | Cap at 8 per lens; state what got cut |
| Treating unanimous silence as a clean bill of health | Six lenses finding nothing can mean "genuinely clean" or "shown too shallow a surface to find anything" | State which lenses were silent and, for a high-stakes review, note that unanimous silence itself deserves a second, deeper pass |

### Worked example

**Synthetic diff** (illustrative, not from any real system):

```diff
+ async function refundPayment(orderId, amountCents) {
+   const order = await db.query(`SELECT * FROM orders WHERE id = ${orderId}`);
+   // call the payment provider
+   try {
+     await paymentProvider.refund(order.payment_token, amountCents);
+   } catch (e) {
+     console.log("something went wrong");
+   }
+   return { ok: true };
+ }
```

**Security lens (security-auditor):** `A03:2021 — Injection.` `orderId` is interpolated directly
into the SQL string with no parameterization (`refund.ts:2`). Precondition: reachable by any
caller who can invoke this endpoint with a crafted `orderId`. Severity: **Critical** (CVSS ~9.1 —
network-reachable, no stated auth check in this snippet, direct data exposure/modification).

**Code quality lens (staff-engineer):** `Blocking:` the function always returns `{ ok: true }`
(`refund.ts:9`) even when the provider call in the `catch` block failed — a caller cannot
distinguish a successful refund from a swallowed failure. This is a correctness defect, not a
style note.

**AI-slop lens (checklist):** Generic/boilerplate error handling — `catch (e) { console.log(...) }`
(`refund.ts:5-7`) swallows the error with an unstructured log line, while the rest of this
hypothetical codebase's payment path (per the diff's surrounding context) re-throws typed errors.
Also: comment `// call the payment provider` restates the next line with no WHY — no comment
documents why the DB lookup happens before the provider call (ordering constraint, if any) or what
`amountCents` units assume.

**Combined severity-ranked summary:**

1. **Critical — Security:** SQL injection via unparameterized `orderId` (`refund.ts:2`). Fix before
   merge; not a style preference.
2. **Blocking — Code quality:** Refund failure is silently reported as success (`refund.ts:9`).
   Fix before merge; violates the contract callers rely on.
3. **Nit — AI-slop:** Generic swallow-and-log error handling inconsistent with this path's own
   convention (`refund.ts:5-7`); WHAT-not-WHY comment adds no information (`refund.ts:3`).

(Compliance, performance, and QA lenses are omitted from this illustrative example for brevity — a
real run reports all six, including any that found nothing.)

### What this skill must not do

- Does not average or vote-count across lenses — a single Critical from one lens outranks five
  lenses' clean bills, per the Absolute Rules above.
- Does not perform the single deep technical read on its own terms — `jstack:review-code-review`
  remains the lighter-weight, single-lens tool for a routine PR.
- Does not reconcile stakeholder viewpoints (CEO/PM/design) — that is `jstack:counsel-review`'s
  job; this skill's six lenses are all review-technical, not cross-functional.
- Does not merge, approve, or push to a default branch — hands off to `jstack:plugin/create-plugin-pr`
  once findings are resolved and a PR is wanted.
- Does not grant final sign-off on a policy-gated change (security, compliance, migration) without
  the human approval `prompts/policies/review-policy.md` requires.

## Config and references
- `jstack.config.json` — team ids, integrations, `skill_defaults`, `jira_rules`, `notion`, `gbrain`. Never hardcode.
- Questions (open-ended, one at a time): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/question-patterns.md`
- Discrete choices (when the host supports AskUserQuestion or equivalent): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/ask-user-question-patterns.md`
- Integrations: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/integration-guide.md`
- Chaining: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/chaining-guide.md`

## Intake
1. Parse `$ARGUMENTS` — get the artifact (diff, PR link/number, or file set) before doing anything else. No artifact means no review; ask for one rather than improvising.
2. Confirm this is the right tool: if the change is a routine PR with no security-sensitive surface, say so and suggest `jstack:review-code-review` instead of running all six lenses anyway.
3. If a required id (PR number, branch) is missing, ask **one** focused question; otherwise use config defaults (label assumptions as `[assumption]`).

## Procedure
### Step 1 — Load config
Read relevant keys from `jstack.config.json` and `prompts/policies/review-policy.md`. If an integration is missing or unhealthy, say so and point to `jstack setup` / `jstack doctor` instead of faking data.

### Step 2 — Plan the safe path
Read the whole artifact before dispatching any lens. State its size (files, LOC); if it exceeds the ~200–400 LOC per-lens ceiling, say so and either split the dispatch or disclose partial coverage explicitly. Confirm the six lenses in the roster table above are all applicable — note any that clearly don't apply (e.g., no compliance-relevant data anywhere in the artifact) rather than running a lens with nothing to check for form's sake.

### Step 3 — Execute
Dispatch all six lenses in parallel, isolated from each other's output: `security-auditor`, `compliance-officer`, `staff-engineer` (performance pass), `staff-engineer` (quality pass, run as a second isolated pass with its own rubric), `qa-engineer`, and this skill's own AI-slop checklist. When the host supports the Agent tool, send one subagent call per lens in a single batch so isolation is structural. Each lens caps at 8 findings, cites `file:line`/exact quotes, and states its own severity band. Once all six report, combine into one table ranked by severity × impact across the whole set, and list which lenses reported nothing.

### Step 4 — Validate
Confirm every finding is attributed to its lens, cites concrete evidence, and respects the per-lens cap. Confirm the combined ranking is genuinely cross-lens, not lens-by-lens. Confirm no AI-slop finding rests on simplicity alone. State explicitly which lenses were silent and any artifact size/coverage limitation.

### Step 5 — Summarize and hand off
State the top-ranked findings, what changed, and what to verify. Suggest `jstack:plugin/create-plugin-pr` once findings are resolved and a PR is wanted, or `jstack:jira` for tracking remediation after approval.

## Output shape
- **Summary** (2–4 sentences: artifact reviewed, size, overall risk read)
- **Per-lens findings** — one table per lens: finding, evidence (`file:line`/quote), severity, confidence
- **Lenses reporting nothing** — named explicitly, not omitted
- **Combined severity-ranked summary** — top findings across all six lenses, ranked, not grouped by lens
- **Next steps** with owner + timeline if known
- **Limitations** (partial coverage, artifact size cut, lens not applicable)
- For eval-gated runs, end with `result_ok: true` or `result_ok: false` + reason

## Failure modes

| Symptom | Recovery |
|---------|----------|
| No artifact to review | Ask for a diff, PR link, or file paths. Do not improvise a review on empty input. |
| Artifact exceeds the per-lens size ceiling | State the size, split the dispatch by file/module, or disclose partial coverage explicitly per lens. |
| A lens is not applicable (e.g., no PII in this change) | State it explicitly with the reason; do not fabricate a finding to fill the slot. |
| Host has no parallel-agent dispatch capability | Run each lens as a sequential but isolated pass — draft its findings to a scratch note before reading any other lens's prior output — and say so in Limitations. |
| Missing config / integration | Point to `jstack setup` or `jstack doctor`; do not continue with invented ids. |
| Auth / 403 / expired token | Stop; tell the user to refresh credentials. Never print secrets. |

## Chaining
Use `jstack:review-code-review` instead when the change is a routine PR with no security-sensitive
surface — this skill is deliberately heavier and should not become the default for every diff. Use
`jstack:counsel-review` instead when the actual ask is reconciling stakeholder viewpoints
(CEO/PM/design), not review-technical depth. Once findings are resolved, `suggested_next:
jstack:plugin/create-plugin-pr` to open the PR, or `suggested_next: jstack:jira` to track
remediation after approval. Do not auto-invoke either without user intent.

## User request

$ARGUMENTS

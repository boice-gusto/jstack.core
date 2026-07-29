---
name: jstack-review-code-review
description: PR workflow — seek (find review queue), appraise (file-by-file review with draft comments), polish (pre-push self-review vs default branch).
category: review
effort: high
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md
Load the policy this domain is governed by (do not restate it from memory):
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/policies/review-policy.md

## What this skill is for
Review a diff for correctness, security, and maintainability, separating blocking defects from taste, and naming a specific required edit for each blocker.
- **Out of scope:** Merging or approving, and rewriting the change wholesale instead of reviewing it.

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

## Config and references
- `jstack.config.json` — team ids, integrations, `skill_defaults`, `jira_rules`, `notion`, `gbrain`. Never hardcode.
- Questions (open-ended, one at a time): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/question-patterns.md`
- Discrete choices (when the host supports AskUserQuestion or equivalent): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/ask-user-question-patterns.md`
- Integrations: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/integration-guide.md`
- Chaining: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/chaining-guide.md`

## Intake
1. Parse `$ARGUMENTS` — note whether the user **pasted** data or is asking you to **query** a system.
2. If a required id is missing, ask **one** focused question; otherwise use config defaults (label assumptions as `[assumption]`).
3. If the request bundles multiple unrelated goals, handle the first and offer to continue.

## Procedure
### Step 1 — Load config
Read relevant keys from `jstack.config.json`. If the integration is missing or unhealthy, say so and point to `jstack setup` / `jstack doctor` instead of faking data.

### Step 2 — Plan the safe path
Read the whole change before commenting on any part of it. Separate blocking findings from suggestions, and cite `file:line` for each. Do not approve based on a summary you did not verify. Rank by severity, not by reading order.

### Step 3 — Execute
Apply the `jstack-review-code-review` workflow using values from `jstack.config.json`. There is no `templates/review/` directory — derive the output shape from the Output shape section below rather than looking for a template file.

### Step 4 — Validate
Confirm every finding cites a real location and that severities are ordered. Confirm you did not present a preference as a defect. State explicitly what you did not review.

### Step 5 — Summarize and hand off
State what changed, what to verify, and suggest **one** next jstack skill if the work naturally continues.

## Output shape
Use a domain-appropriate heading, then:
- **Summary** (2–4 sentences)
- **Details** (bullets, table, or structured fields)
- **Next steps** with owner + timeline if known
- **Limitations** (partial data, no write access, etc.)
- For eval-gated skills, end with `result_ok: true` or `result_ok: false` + reason

## Failure modes

| Symptom | Recovery |
|---------|----------|
| Missing config / integration | Point to `jstack setup` or `jstack doctor`; do not continue with invented ids. |
| Auth / 403 / expired token | Stop; tell user to refresh credentials. Never print secrets. |
| Ambiguous goal | One clarifying question; if still unclear, present options A/B. |
| No artifact to review | Ask for doc link, paste, or file path. Do not improvise a review. |

## Chaining
Complete the work here. If a natural follow-up exists, add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

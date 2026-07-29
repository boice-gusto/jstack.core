---
name: jstack-sdlc
description: Map SDLC stages to evidence (tests, sign-offs, flags, migrations). Produce gate checklists, not Jira state changes.
category: sdlc
effort: high
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md
Load the policy this domain is governed by (do not restate it from memory):
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/policies/sdlc-gates.md

## What this skill is for
Map SDLC stages to evidence the team produces. For each gate, list entrance/exit criteria. Do not waive a gate without a named risk-acceptance line.
- **Out of scope:** Making Jira state changes or deploying code — produce checklists and narrative only.

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
Gates are not skippable silently. If one must be bypassed, produce a risk-acceptance line naming who approved it, what risk was accepted, and the mitigation. Confirm the revert path exists before release.

### Step 3 — Execute
For each stage gate (dev → test → stage → prod), list entrance and exit criteria based on `prompts/policies/` or team convention.
- Map criteria to evidence the team produces: test results, sign-offs, feature flags, migration plans.
- If a gate is missing evidence, list what is needed — do not auto-approve.
- Include a revert / kill-switch sentence for any prod deploy discussion.

### Step 4 — Validate
Confirm each gate is either satisfied with evidence or explicitly bypassed with a recorded risk acceptance.

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
| Policy file missing in `prompts/policies/` | Use sensible defaults; list assumptions explicitly. |
| Gate evidence incomplete | List what is missing per gate; do not auto-approve. |

## Chaining
Complete the work here. If a natural follow-up exists, add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

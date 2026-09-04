---
name: jstack-engineering-blast-radius
description: >-
  Find what a change could break somewhere else — beyond the diff itself — before it ships:
  other callers of a changed function, other consumers of a changed schema/type, another
  language reading the same wire format, a feature flag three hops downstream. Then prove the
  one fact that makes it safe (or not) by running real code — grepping for callers, executing
  the function, running the affected test — never by writing a plausible-sounding paragraph.
  Use for "blast radius of X," "what could this break," or reviewing a small diff you don't
  fully trust yet. Do NOT use for in-diff correctness review (is this specific change right) —
  that is `jstack:review-code-review`. Do NOT use for verifying an arbitrary claim unrelated to
  a shipping change (a perf number, "did this fix it") — that is `jstack:engineering-verify-this`.
  Inspired by Cursor's `pstack` plugin's `blast-radius` skill, adapted to jstack conventions.
category: engineering
effort: high
generator: skip
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config, diff_or_change_description -->
<!-- outputs: structured_result -->
<!-- chains-to: jstack:review-code-review, jstack:engineering-verify-this -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Hunt for what a change breaks **outside** the diff — a caller grep won't show, a consumer in
another file, another service, or another language reading the same data — and prove the single
fact the change's safety actually rests on by running real code, not by writing a convincing
paragraph. A blast-radius writeup that merely sounds right is worthless: it reads as true whether
or not it is.
- **Out of scope:** Judging whether the diff itself is correct (that's `jstack:review-code-review`,
  which owns in-diff correctness — what's wrong *within* the changed lines); verifying a claim
  that isn't about a change about to ship (that's `jstack:engineering-verify-this`, a general
  claim-verification skill for an arbitrary before/after, not specifically about impact outside a
  diff's boundaries); listing callers as the deliverable — grep finds those in a second, the job
  is the breakage grep won't show.

## Domain rules — blast radius
Never assert a change is "safe" without having actually run something. Grep is a start, not
proof — reading a call site and confirming the changed contract still holds there is the actual
work, and even that stops one rung short of proof until something real gets executed. State
explicitly what you did **not** check; a silent gap reads as coverage it never had.

### Absolute rules
1. **Listing callers is not the job.** A caller list is table stakes, produced in the first minute.
   The actual work is what a symbol search misses: the JSON shape an API returns, a DB column read
   by a different service, a wire format another language parses, a feature flag gating this path
   three hops downstream.
2. **Find the one fact the change is safe because of, and spend your time there.** Most changes
   that look scary are safe because of a single narrow fact ("this only touches already-expired
   cache entries"). Confirm that fact instead of enumerating a long list of maybes.
3. **A safety fact has a confidence level, and you name it.** Ranked, cheapest-to-hardest: (1) "I
   said so" — worthless alone; (2) a real `file:line` citation; (3) walked the failure path
   step-by-step and it provably doesn't reach; (4) ran a script/test against the real code and it
   failed loud if wrong; (5) reproduced it in the running app. Get every safety-critical fact to at
   least level 4 — a script or test that calls the real code — or say explicitly it's unproven.
   Never round an unproven fact up to settled.
4. **Never invent a caller, an API, or a search result.** A search that finds nothing is still a
   real, citable answer ("grepped `X`, 0 matches in `cli/src` or `dashboard/src`"). Do not present
   an assumption as a finding.
5. **Cite real `file:line` for every risk kept.** A risk without a location is a guess wearing a
   risk's clothes.
6. **Name what you did not check, every time.** Files outside the search path, a language/service
   boundary you couldn't cross, a call site sampled rather than read exhaustively — say so in the
   same breath as the finding, not buried in a caveat nobody reads.

### Named anti-patterns

| Anti-pattern | Why it's wrong | Do this instead |
|---|---|---|
| Asserting "this is used in one place" without actually grepping | An unverified guess about caller count is exactly the mistake this skill exists to catch | Run the grep, paste the actual hit count, and read every hit before stating a caller count |
| Treating "no tests failed" as proof when no test exercises the changed path | A green suite proves nothing about a line no test touches — absence of failure isn't presence of coverage | Confirm which specific test(s) exercise the changed line before citing a green run as evidence; if none do, say so |
| Writing a risk narrative with no executed command backing it | Convincing prose reads as true whether or not it is — a paragraph is not a proof | Ship the actual output of a script, test, or grep alongside the reasoning, not the reasoning alone |
| Stopping at the first caller found | The second or third caller is often the one that actually breaks — an early stop just means the writeup got lucky | Exhaustively search (symbol name, import path, wire-format field name) before concluding |
| "Should be fine" from reading the diff alone | The diff shows what changed, not who else depends on the old behavior — this is a guess dressed as a review | Grep for every real caller/consumer before forming an opinion, then read the ones that matter |

### Worked example

- *Weak:* "This looks safe, the change is small."
- *Sharp:* "Grepped every call site of `resolveAgentCwd()`:
  ```bash
  $ rg -n "resolveAgentCwd\(" --type ts
  dashboard/src/app/api/agent/stream/route.ts:41:  const cwd = resolveAgentCwd(session);
  dashboard/src/app/api/agent/start/route.ts:18:   const cwd = resolveAgentCwd(session);
  cli/src/lib/agentRunner.ts:104:                  cwd = resolveAgentCwd(opts);
  ```
  3 hits, all read. The first two always pass an explicit `session.cwd`, so the new fallback branch
  never triggers there. `cli/src/lib/agentRunner.ts:104` is the riskiest — it's the only call site
  that can hit the new fallback when `AGENT_CWD` is unset. Ran the one test that exercises exactly
  that path:
  ```bash
  $ bun test cli/src/lib/agentRunner.test.ts -t "falls back to repo root when AGENT_CWD unset"
  ✓ agentRunner > falls back to repo root when AGENT_CWD unset [3ms]
  1 pass
  0 fail
  ```
  Confirmed it still passes on this branch. **Did not check:** whether any deploy config outside
  this repo sets `AGENT_CWD` to something the fallback would silently override — that's a different
  repo, out of reach here."

## Config and references
- `jstack.config.json` — team ids, integrations, `skill_defaults`, `jira_rules`, `notion`, `gbrain`. Never hardcode.
- Questions (open-ended, one at a time): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/question-patterns.md`
- Discrete choices (when the host supports AskUserQuestion or equivalent): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/ask-user-question-patterns.md`
- Integrations: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/integration-guide.md`
- Chaining: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/chaining-guide.md`

## Intake
1. Parse `$ARGUMENTS` for a diff, PR reference, or plain description of the change under review.
2. If no change is identifiable (no diff, no PR, no description), ask **one** focused question.
3. If asked to also judge in-diff correctness, do the blast-radius work here and suggest
   `jstack:review-code-review` for the correctness pass — don't blend the two.

## Procedure
### Step 1 — Load config
Read relevant keys from `jstack.config.json`. If the integration is missing or unhealthy, say so and point to `jstack setup` / `jstack doctor` instead of faking data.

### Step 2 — Read the change and find the one fact
Read the diff, the symbols it adds/changes/deletes, and what it now does differently — including
the part the diff doesn't spell out. Identify the single fact the change's safety most depends on.
Most changes are safe because of one narrow fact, not a long list of unrelated ones — spend the
bulk of the effort here, not on breadth.

### Step 3 — Search past where grep stops
Grep for every caller, importer, and consumer — this is the floor, not the finding:
```bash
rg -n "changedFunctionName\(" --type ts
rg -n "from ['\"].*/changedModule" -g '*.ts' -g '*.tsx'
```
Then run whichever tests actually exercise the changed path, using this repo's own commands
(see `CLAUDE.md`'s "Commands you'll use most"):
```bash
bun test cli/src                                       # every CLI/lib test
bun test cli/src/lib/foo.test.ts                        # one file
bun test cli/src/lib/foo.test.ts -t "fixture name"      # one test by name
```
Then go further: read the library source at the pinned version for anything called externally,
check for another format/language reading the same data (a JSON shape, a DB column, a wire
format), and check for a feature flag or config value that changes behavior downstream. A search
that finds nothing is a real, citable result — record it (e.g. "`rg -n resolveAgentCwd
dashboard/src` — 0 matches").

### Step 4 — Prove the one fact
Write and run a small script or test that calls the real code and would fail loud if the safety
fact were false. Paste the actual output. If proving it cheaply isn't possible, say so explicitly
and mark it unproven rather than rounding it up.

### Step 5 — Validate and hand off
Confirm every kept risk cites a real `file:line`, every cleared risk states what was checked, and
the one safety fact's confidence level is stated honestly. State what you did not check. Suggest
`jstack:review-code-review` (in-diff correctness) or `jstack:engineering-verify-this` (a narrower
before/after claim) as the natural next step if either is still needed.

## Output shape
Use a domain-appropriate heading, then:
- **Summary** (2–4 sentences: what changed, including the non-obvious part)
- **The one fact it's safe because of** — stated, with its confidence level and the proof
- **Risks kept** — each with `file:line`, likelihood, cost, and how to check further
- **Cleared** — what was checked and found fine, and why
- **Before you merge** — the cheapest test/repro that would catch the real bug
- **Limitations** (anything not checked, or not provable cheaply)
- For eval-gated skills, end with `result_ok: true` or `result_ok: false` + reason

## Failure modes

| Symptom | Recovery |
|---------|----------|
| No diff or change description provided | Ask for one; do not analyze a guessed change. |
| A call site exists in a part of the codebase with no test coverage | Say so explicitly — "no test exercises this call site" — don't fabricate confidence by citing an unrelated green suite. |
| The change lives in a hot/generated file (a large lockfile, a generated catalog, a codegen'd client) where grep produces too much noise to read every hit | Say the file is generated/hot, sample deliberately, and state the sampling instead of claiming exhaustive coverage you didn't do. |
| A downstream consumer lives in a different repo or service not visible here | Say so explicitly — this is a real limit, not something to guess past — and name what would need to be checked in that repo/service instead. |
| Can't run the affected code (no test harness, no fixture) | Mark the safety fact unproven rather than skipping the section. |
| The "one fact" turns out false when proven | Report the real finding — the change is not safe as-is — rather than searching for a different fact to make the writeup land clean. |

## Chaining
Complete the work here. If in-diff correctness is still an open question, suggest
`suggested_next: jstack:review-code-review`; if a narrower single claim needs its own
baseline/treatment verdict, suggest `jstack:engineering-verify-this`. Do not auto-invoke without
user intent.

## User request

$ARGUMENTS

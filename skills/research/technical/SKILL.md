---
name: jstack-research-technical
description: "Structured technical investigation: architecture options, tradeoff matrix, recommendation with migration/operability risks."
category: research
agent: Explore
context: fork
effort: high
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Produce a technical tradeoff analysis: options as rows, decision criteria as columns, and an explicit recommendation with the condition that would reverse it.
- **Out of scope:** Implementing the chosen option, and asserting a benchmark number you did not measure or cite.

## Domain rules — technical

### Absolute rules

1. **Rank sources by a fixed hierarchy**: spec/RFC/official docs > maintainer statements
   (changelog, a maintainer's own issue/PR comment) > blog posts/tutorials > forum answers. When
   two sources conflict, the higher tier wins unless the lower tier is more recent *and* version-
   matches the installed version being asked about.
2. **Version-pin every behavioral claim.** An answer true for one major version can be false for
   the next — Semantic Versioning exists precisely because a MAJOR bump signals incompatible API
   changes ([semver.org](https://semver.org/)). State the exact version checked, not "the current
   version" or "generally."
3. **Distinguish documented behavior from observed behavior**, always labeled. Documented = the
   spec/official docs say this happens. Observed = this is what actually happened when it was run.
   The two usually agree; when they don't, that gap is itself the most important finding.
4. **Never assert API behavior not verified in the installed version.** If it can't be run, say
   "documented, not verified in this environment" — do not present untested reasoning as a fact
   with the same confidence as a checked one.
5. **Runtimes label their own stability.** Where a stability index exists — e.g. Node.js marks
   APIs Deprecated / Experimental / Stable
   ([Node.js documentation conventions](https://nodejs.org/api/documentation.html#stability-index))
   — surface that label; recommending an Experimental API as if it were Stable misrepresents risk
   the source itself already disclosed.
6. **A top-voted forum answer is not automatically current.** Check its age and the version it was
   written against before relying on it; an answer several major versions old is a lead to verify,
   not a citation to trust.
7. **State what could not be verified.** "Could not confirm this in the installed version — docs
   say X, no environment available to test" is a complete, honest answer; a confident guess dressed
   as a checked fact is not.

### Thresholds

| Signal | Threshold | Basis |
|---|---|---|
| Source tier | Tier 1 spec/RFC/official docs, Tier 2 maintainer statement, Tier 3 blog/tutorial, Tier 4 forum answer | Fixed ranking resolves conflicts without re-litigating each time |
| Version pin | 100% of API-behavior claims name the exact version checked | An unpinned claim can't be validated against a MAJOR-version change ([semver.org](https://semver.org/)) |
| Verification label | Every claim marked "documented" or "observed" (or both) — 0% unlabeled | Conflates guaranteed behavior with a single run |
| Answer staleness | An answer referencing a version ≥1 major version behind the installed version is flagged for re-verification | Matches how semver defines a breaking-change boundary |

### Named anti-patterns

| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Treating a top-voted forum answer as authoritative | May predate several major versions; upvotes measure popularity, not currency | Check the spec/changelog first, then confirm against the currently installed version |
| Copying a blog snippet untested | Blogs can be wrong or outdated when written, and never get corrected | Verify against official docs and, where feasible, a minimal repro |
| Silent version omission | The reader can't tell whether the claim applies to their install | State the exact version checked in every claim |
| Reporting "observed" as "documented" | Conflates what happened once with what the spec guarantees to always happen | Label each separately; flag disagreement between them explicitly |

### Worked example

- *Weak:* "You can just use `array.flat()` to flatten nested arrays in JS."
- *Sharp:* "`Array.prototype.flat()` is documented on
  [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/flat)
  with broad modern-engine support. This repo's `.nvmrc` pins Node 18.x; `flat()` has shipped since
  Node 11, so it's safe here — documented and, per a quick `node -e` check, observed working
  identically. A 2015 Stack Overflow answer recommending a recursive polyfill predates this API
  entirely (Tier 4, superseded by Tier 1) and should not be used for this codebase's target
  runtime."

### What this skill must not do

- Does not execute untrusted third-party code without sandboxing to "verify" a claim.
- Does not fabricate a citation when no source was found — states "could not verify" instead.
- Does not substitute for `jstack:research-explain-codebase`'s structural mapping — this skill
  investigates an external technical question, not this repo's own architecture.

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
State which sources you searched and which you could not reach — silent partial coverage reads as completeness. Distinguish "not found" from "does not exist". Timestamp findings, because a stale answer presented as current is worse than no answer.

### Step 3 — Execute
Architecture options, tradeoff matrix, recommendation.
- Include migration and operability risks, not just API surface.

### Step 4 — Validate
Confirm every claim has a source and an as-of time, and that coverage gaps are stated rather than implied. No source, no claim.

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
| Web search unavailable | Return assumptions as `[unverified]` with a to-verify checklist. |
| Codebase too large to map | Top-down overview first, then offer targeted deep dives. |

## Chaining
Complete the work here. If a natural follow-up exists, add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

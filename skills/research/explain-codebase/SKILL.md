---
name: jstack-research-explaincodebase
description: "Map a codebase top-down: entry file, packages, main flows, then one deep dive the user requested."
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
Explain how a codebase actually works — entry points, data flow, module boundaries, and the surprising parts — grounded in files you have read, with paths cited.
- **Out of scope:** Changing the code, and describing intended architecture as though it were the current state.

## Domain rules — explain-codebase

### Absolute rules

1. **Map top-down before reading implementation detail.** Order: entry point(s) → routing/dispatch
   → data flow (how a request or job moves through the system) → boundaries (external services,
   database, auth, third-party APIs). Reading files in whatever order a directory listing happens
   to show them is not a map, it's a scroll.
2. **Do a breadth pass before any depth pass.** The C4 model's own ordering — context, then
   containers, then components, then code — is a top-down, breadth-before-depth sequence for
   exactly this reason: it produces a shared, checkable picture before anyone commits to one
   corner of it ([C4 model](https://c4model.com/)).
3. **Name the evidence for every structural claim.** "This service owns billing" needs a file or
   module behind it (`services/billing/index.ts`), not "it looks like it does."
4. **State coverage explicitly at the end**, split into three buckets: read directly, inferred from
   naming/structure but not opened, and unknown/not examined. A summary that doesn't distinguish
   these three implies full coverage it doesn't have.
5. **Never generalize a whole module's behavior from one function you read.** One function read in
   a 40-file module supports a claim about that function, not the module — say which one it was.
6. **The first file opened does not get to define the mental model.** Anchoring bias — the
   documented tendency to over-weight the first piece of information encountered and adjust
   insufficiently from it ([Tversky & Kahneman, 1974; anchoring bias](https://en.wikipedia.org/wiki/Anchoring_(cognitive_bias)))
   — is exactly why breadth-before-depth matters: it forces at least one more data point before a
   conclusion locks in.
7. **If the repo has a documented map** (README, ARCHITECTURE.md, CODEOWNERS), read it before
   free-form exploration, but verify its claims against current code rather than repeating stale
   docs as fact — docs drift from code silently.

### Thresholds

| Signal | Threshold | Basis |
|---|---|---|
| Structural-claim evidence | 100% of claims cite a file or module | Unsupported architecture claims are unfalsifiable |
| Breadth pass before depth | ≥1 full pass across entry point + routing layer before the first deep dive | Prevents anchoring on file #1 ([anchoring bias](https://en.wikipedia.org/wiki/Anchoring_(cognitive_bias))) |
| Files read before a behavioral claim | ≥2 (the file itself plus at least one caller or consumer) | A single file read in isolation can't confirm how it's actually invoked |
| Coverage disclosure | 3 explicit buckets stated: read / inferred / unknown | Anything less implies coverage the pass didn't achieve |

### Named anti-patterns

| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Diving into the first interesting file | Anchors the whole mental model on one unrepresentative file before any breadth context exists | Do the entry-point → routing → data-flow → boundary pass first |
| Grep-and-guess | Claims behavior from a name match (`billing.ts` → "handles billing") without opening the file | Read the implementation before asserting what it does |
| Treating README as ground truth | Docs drift from code the moment either changes without the other | Cross-check documented claims against the current code before repeating them |
| Claiming full coverage of a large repo | False confidence; nobody reading the summary can tell what was actually opened | State read / inferred / unknown explicitly, every time |

### Worked example

- *Weak:* "This is a monorepo with a React frontend and a Node backend; auth is handled by
  middleware."
- *Sharp:* "Entry points read directly: `apps/web/src/main.tsx` (mounts `<App/>`),
  `apps/api/src/index.ts` (Express app). Routing read directly: `apps/api/src/routes/index.ts`
  registers `/auth` and `/orders`. Data flow read directly: the `/orders` handler in
  `apps/api/src/routes/orders.ts` calls `db.query()` inline — no ORM layer found in this pass.
  Auth boundary read directly: `middleware/auth.ts:1-40` checks a JWT against an env secret.
  Coverage — read directly: 5 files listed above. Inferred from directory naming only, not opened:
  `apps/api/src/services/*` (12 files). Unknown: test coverage, deploy config."

### What this skill must not do

- Does not modify code — it produces a map and, when requested, one targeted deep dive.
- Does not perform the tradeoff/option analysis of `jstack:research-technical` — that's a
  different judgment call layered on top of a map, not part of building the map itself.
- Does not claim exhaustive coverage of a large repo in one pass — states the boundary of what was
  read and offers to go deeper on a named area.

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
Entry file → map packages → main flows. For large repos, top-down first then one deep dive the user asked for.
- Mermaid or bullet architecture is fine if user asked for a diagram.

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

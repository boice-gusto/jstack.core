---
name: jstack-engineering-create-verification-skill
description: >-
  Generate a project-local, checked-in skill that drives a project's real app, CLI, service, or
  TUI the way an actual user would — clicks, CLI invocations, API calls, or keystrokes — and
  defines what counts as proof for that mechanism (exit code + stdout, a screenshot/ARIA snapshot,
  a HAR file, a captured network log) so future work has a scripted, evidence-backed way to
  confirm behavior instead of "looks right" or a stub that always reports success. Use when a
  project has no scripted way to prove UI/CLI/service behavior, or the user says "make a control
  skill for this repo," "give this project a verification skill," "generate a verify-skill for
  X," or "/create-verification-skill". Do NOT use to settle one specific claim right now — that is
  `jstack:engineering-verify-this` (a single ad hoc VERIFIED/NOT VERIFIED/INCONCLUSIVE call, run
  once and discarded); this skill instead produces a reusable, checked-in skill that can verify
  many future claims about the same project. Do NOT use to author the SKILL.md mechanics yourself
  (frontmatter fields, file placement, chain contract shape) — delegate that structure to
  `jstack:skill-creator`; this skill's own job is the interview and the proof-standard content
  that goes inside the generated file. Inspired by Cursor's `cursor-team-kit` plugin's
  `create-verification-skill` skill, adapted to jstack conventions.
category: engineering
effort: max
generator: skip
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config, target_project_root -->
<!-- outputs: generated_skill_path, feature_map, proof_manifest -->
<!-- chains-to: jstack:skill-creator, jstack:engineering-verify-this -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Interview a project to find how it is actually driven — CLI flags, browser automation, API calls,
a TUI — and generate a project-local skill that any future agent can run cold, mid-task, to launch
that project's real app and capture evidence a claimed behavior actually happened. The output is a
checked-in, reusable artifact (a `SKILL.md` plus a feature map), not a one-time answer to today's
question.
- **Out of scope:** Settling a single claim right now — that's `jstack:engineering-verify-this`,
  which runs once and returns a verdict, not a reusable skill. Authoring the generated file's own
  SKILL.md mechanics (frontmatter shape, `chains-to`, where it registers) — that structure is
  `jstack:skill-creator`'s domain; this skill supplies the interview answers and proof content that
  fill it in. Fixing anything the interview turns up (a broken build, a missing README) beyond the
  minimum needed to generate against a working base.

## Domain rules — verification-skill generation

### Absolute rules
1. **Interview the repo, not the user, first.** Answer surface, run, drive, observe, and isolate
   (below) from the codebase — package scripts, Makefile, README quickstart, existing Playwright/
   Cypress specs, a debug port — before asking the user anything. Only ask what genuinely cannot be
   observed.
2. **Match the proof artifact to the driving mechanism.** A CLI's proof is exit code + stdout/
   stderr; a browser UI's proof is a screenshot or ARIA snapshot of the resulting state, not just
   "no error"; an API's proof is the response body/status plus, where the claim needs it, a
   captured HAR or network log; a TUI's proof is a PTY transcript. Never accept a weaker artifact
   than the mechanism actually supports.
3. **Never let the generated skill claim success without a captured artifact.** This repo's own
   `runWorkflowStub` returned `ok: true` with no artifact for every run, no matter what actually
   happened — `jstack:workflows-execute` has to explicitly translate that into `unverified` rather
   than trust the stub's claimed success (see `skills/workflows/execute/SKILL.md`'s failure-modes
   table and the eval case `skill-workflows-execute-reports-unverified-not-pass` in
   `evals/a2a/cases/skills.yaml`). A generated verification skill that reports "passed" from a
   stub, a mock, or a test-only endpoint reproduces that exact failure mode inside the very tool
   meant to prevent it.
4. **Delegate SKILL.md's own structure to `jstack:skill-creator`.** Frontmatter fields, file
   placement, chain-contract shape, and the regeneration/`SKIP` rules are `jstack:skill-creator`'s
   canonical domain — do not reinvent or restate them here. This skill's entire unique value is the
   *content* question: what interview finds the real driving mechanism, what counts as proof for
   it, and how the generated skill avoids ever claiming success without evidence.
5. **Prove the generated skill once before handing it over.** Run its own instructions end to end —
   launch, doctor, drive one mapped feature, capture evidence, clean up — and confirm the evidence
   still exists after cleanup. An unexecuted skill is a draft, not a deliverable.
6. **Seed a feature map**, not just the one path proven in Step 4. A skill that only documents the
   one thing it happened to be built against is a narrower deliverable than "a reusable way to
   verify this project" — the map is what lets a later run cover the rest.

### Interview axes → what they answer
| Axis | What it answers | Where to look first |
|---|---|---|
| Surface | Web UI, CLI/TUI, desktop app, API, mobile app, or library — pick the primary one if several exist, note the rest | Routes/pages, `bin`/`cli` entry, `package.json` scripts, API route files |
| Run | The exact local-start command, ports, env vars, seed data, auth | README quickstart, `Makefile`, `docker-compose.yml`, dev scripts |
| Drive | How an agent interacts with it programmatically | Existing Playwright/Cypress specs first, then a PTY/tmux harness for CLI/TUI, plain HTTP for services, CDP/browser automation for web/Electron |
| Observe | What evidence can actually be captured | Screenshots, ARIA snapshots, terminal transcripts, response bodies/HAR, logs, exit codes, DB rows |
| Isolate | Whether two instances can run side by side without corrupting a shared session | Port config, data-dir/profile flags, existing test fixtures |

### Driving mechanism → proof artifact
| Mechanism | Minimum proof | Why that, not less |
|---|---|---|
| CLI / script | Exit code + captured stdout/stderr (and a diff against a golden fixture when the claim is about output shape) | Exit code alone can't distinguish "did nothing" from "did the right thing" |
| Browser UI | Screenshot **and** an ARIA/DOM snapshot of the resulting state, with the app identity visible | A screenshot alone can't be asserted against programmatically; a snapshot alone can miss a rendering regression |
| API / service | Response status + body, plus a HAR or captured network log when the claim involves timing, headers, or a multi-request flow | A 200 with an empty or unchecked body is not evidence of the claimed field or side effect |
| TUI | Full PTY transcript (input and output), not just the final screen | The final screen can look right by accident of a redraw; the transcript proves the actual sequence |
| Mutating action (write, charge, send) | The above **plus** a read-only second view of the stored/side-effect state (reopened record, second query, delivered message) | A success response does not prove the write landed; only an independent read does |

### Named anti-patterns

| Anti-pattern | Why it's wrong | Do this instead |
|---|---|---|
| Writing "run the command and check it works" with no real syntax | A cold-read agent, mid-task, has nothing executable to run — this is the exact gap a generated skill exists to close | Name the exact command/selector/endpoint from this repo, with real flags and the expected observable result |
| Treating "no error was thrown" as sufficient proof for a UI or mutating action | Absence of an exception is not presence of the claimed behavior — a silently broken click handler also throws nothing | Capture the mechanism-appropriate artifact (table above) and assert the specific claimed outcome, not just that execution completed |
| Wrapping a stub, mock, or test-only endpoint in the "Drive" step and calling its `ok: true` response proof | Identical failure mode to this repo's own `runWorkflowStub`, which returned `ok: true` with no artifact for every call until `jstack:workflows-execute` had to explicitly downgrade that into `unverified` | Drive the real user-facing path; if only a stub or mock currently exists, say so in the generated skill and refuse to call it verified |
| Reinventing SKILL.md frontmatter/structure rules inline instead of delegating | Duplicates and drifts from the canonical checklist `jstack:skill-creator` already maintains, and this skill's effort goes to the wrong layer | Delegate structure to `jstack:skill-creator`; spend this skill's effort on the interview content and proof standards |
| Handing over a generated skill that was drafted but never executed | An unexecuted skill is a draft dressed as a deliverable — the first real user hits the first broken step, at the worst time | Run the generated skill's own instructions end-to-end once (Procedure Step 4) before calling it done |

### Worked example

- *Weak:* Generated `verify-billing-api`'s Drive section reads: "Call the billing endpoint and
  check it works." Its Evidence section reads: "note whether it succeeded." A cold-read agent has
  no command to run and no way to know what "succeeded" means.
- *Sharp:* Drive section: `` curl -sS -X POST http://127.0.0.1:4000/api/charges -H 'content-type: application/json' -d '{"amount":500,"customer":"test_cus_1"}' -D /tmp/verify/charges.headers -o /tmp/verify/charges.json; echo $? > /tmp/verify/charges.exit ``.
  Evidence section: "Capture `charges.exit` (must be `0`), `charges.headers` (status line), and
  `charges.json` — assert `status == 'succeeded'` and a non-empty `id`; a 200 with an unchecked
  body is not proof — assert the specific field the claim is about, then reopen the charge via
  `GET /api/charges/:id` as the independent read-only confirmation." The sharp version gives the
  next agent an executable recipe and a concrete pass/fail assertion, closing the exact gap
  `runWorkflowStub` exploited by returning `ok: true` with nothing behind it.

## Config and references
- `jstack.config.json` — team ids, integrations, `skill_defaults`, `jira_rules`, `notion`, `gbrain`. Never hardcode.
- SKILL.md structure/frontmatter mechanics: delegate to `jstack:skill-creator` and its checklist
  `skills/skill-creator/references/jstack-skill-checklist.md` — this skill supplies the interview
  and proof-standard content, not the authoring rules.
- Questions (open-ended, one at a time): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/question-patterns.md`
- Discrete choices (when the host supports AskUserQuestion or equivalent): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/ask-user-question-patterns.md`
- Integrations: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/integration-guide.md`
- Chaining: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/chaining-guide.md`

## Intake
1. Parse `$ARGUMENTS` for a target project path (default: current working directory) and whether
   the user already named a primary surface (web/CLI/API/TUI) or wants the full interview run cold.
2. If the target project doesn't build or start as-is, say so precisely and ask whether to fix that
   first or stop — a skill generated against a broken base teaches the next agent wrong steps.
3. If the request bundles generating the skill with settling one specific claim right now ("and
   also prove bug #123 is fixed"), generate and prove the reusable skill here, then suggest
   `jstack:engineering-verify-this` for the immediate one-off claim rather than blending a single
   verdict into what's meant to be a reusable artifact.

## Procedure
### Step 1 — Load config
Confirm the target project root. Check the target for an existing skill/agent-instruction
convention (`.claude/skills/`, `.cursor/skills/`, or another documented location) and default to
`.claude/skills/verify-<app>/SKILL.md` only if the target has no convention of its own. Read
`jstack.config.json` only if the target is itself jstack-managed and the interview needs a
`skill_defaults` value — most of this work is interview-driven, not config-driven, so don't force a
lookup that isn't relevant.

### Step 2 — Plan the safe path
Before writing anything, state the five interview answers (Surface, Run, Drive, Observe, Isolate)
and the proof artifact each mapped feature will need (Driving mechanism → proof artifact table).
Confirm the project actually builds/starts (Intake step 2). This skill only ever writes new files
under the target project's own skill directory — it never runs a destructive command against real
data; pick a disposable data directory or seed fixture per the Isolate answer before driving
anything.

### Step 3 — Execute
Interview the repo per the axes above, then write the generated `SKILL.md` covering Launch (start
command + ready signal + teardown), Doctor (one read-only "is this instance worth driving" check),
Drive (the harness recipe with real selectors/commands from this repo, not placeholders), Evidence
(what to capture and where, per the proof table, plus the mutating-action rule: verify the read-only
second view, not just the response), Cleanup (tear down only what this run started, never by
process name, and never delete captured evidence), and Helpers (any shipped script, with its
invocation shown inline). Seed the feature map: `features/README.md` plus one file per top 3-5
user-facing features, each using the four-H2 shape — `Sub-features`, `How to get to it (user
POV)`, `Driving it with <harness>`, `Gotchas` — grounded in real routes/commands/menus, never
placeholders. For the generated file's own frontmatter, placement, and chain contract, follow
`jstack:skill-creator`'s conventions rather than improvising a new shape (Absolute rule 4).

### Step 4 — Validate
Run the generated skill's own instructions end to end once: launch, doctor, drive **one** mapped
feature, capture evidence, clean up. After cleanup, confirm the evidence still exists at the
location the skill names — a cleanup that eats the proof fails this step. Confirm no step of the
generated skill claims success without a captured artifact (Absolute rule 3) — read every Drive/
Evidence pairing back and ask "would this accept a stub's `ok: true` as proof?"; if yes, tighten it
before handing over.

### Step 5 — Summarize and hand off
State what was generated (paths), the interview answers, which one feature was proven end-to-end
in Step 4, and which mapped features are documented but not yet individually proven. Suggest
`jstack:skill-creator` if the generated file still needs structural cleanup, or
`jstack:engineering-verify-this` if the user's real, immediate need turns out to be a single ad
hoc claim rather than the reusable skill just generated.

## Output shape
Use a domain-appropriate heading, then:
- **Summary** (2–4 sentences: what was generated, for which project, and which surface/harness)
- **Details** — generated file paths, the five interview answers, and which feature was proven
  end-to-end in Step 4 vs. only mapped
- **Next steps** with owner + timeline if known
- **Limitations** (features mapped but not yet individually proven, any part of the project that
  couldn't be driven programmatically, isolation constraints)
- For eval-gated skills, end with `result_ok: true` or `result_ok: false` + reason

## Failure modes

| Symptom | Recovery |
|---------|----------|
| Target project doesn't build or start as-is | Report the exact failure precisely; fix it first or stop — never generate a skill against a broken base. |
| No stable driving mechanism exists (no CLI flags, no API, no accessible UI selectors) | Say so plainly in the generated skill; do not invent a fragile coordinate- or tab-order-based recipe. |
| Two instances can't run side by side (shared port or data dir) | State that limitation in the generated skill; it must refuse to double-drive a shared instance rather than corrupt the user's session. |
| Step 4's proof run was skipped | Run it before handing over; an unexecuted generated skill is a draft, not a deliverable. |
| Generated Drive step only reaches a stub, mock, or test-only endpoint | Name that explicitly in the generated skill and do not call its `ok: true` "proof" — the `runWorkflowStub` failure mode this skill exists to prevent. |
| User's actual need is a single one-off claim, not a reusable skill | Point to `jstack:engineering-verify-this` instead of generating a whole project skill for one question. |
| Generated file's frontmatter/structure is malformed or non-standard | Route the structural fix through `jstack:skill-creator` rather than hand-patching frontmatter here. |

## Chaining
Complete the work here. If the generated file needs structural polish or a checklist pass, suggest
`suggested_next: jstack:skill-creator`. If the user's immediate need turns out to be settling one
specific claim rather than the reusable skill just built, suggest `jstack:engineering-verify-this`.
Do not auto-invoke without user intent.

## User request

$ARGUMENTS

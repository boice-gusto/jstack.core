---
name: jstack-engineering-compatibility-check
description: Runs jstack.core's own sixteen structural/config gates (schema and config drift, write-gate and SRI security checks, agent/skill config-matrix and depth, chain and router integrity, description-reference, referenced-file, name-collision, prompt-wiring, and alias-drift checks) and blends the results into one weighted compatibility score plus a ranked "fix these first" list. Read-only — it only runs checks and reports; it never edits a file and never runs the slower legs of `bun run check` (typecheck, tests, format, evals, the a2a suite). For DORA-banded engineering health, use jstack:engineering-health instead; for bus-factor / knowledge-silo risk, use jstack:engineering-silo-scan instead; for the full CI chain including tests and typecheck, tell the user to run `bun run check` directly.
when_to_use: "Also trigger on: 'is the skill catalog healthy', 'run the compatibility gates', 'score the repo's config/skill checks', 'what's broken across the gates', 'give me a fix-first list for the structural checks', or a request to summarize `bun run check` failures into one number."
category: engineering
context: fork
agent: Explore
effort: high
generator: skip
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config, repo_root -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Run jstack.core's sixteen deterministic structural/config gates, score each one against fixed anchors, blend the scores into one weighted compatibility number, and hand back a ranked list of the highest-value fixes.
- **Out of scope:** Fixing anything the gates flag, running the slower legs of `bun run check` (typecheck, `test:cli`, `test:dashboard`, `format:check`, the `eval:*` suite, the `a2a` behavioral suite), or scanning any repo other than jstack.core unless the user explicitly names another one.

## Domain rules — compatibility check

### Absolute rules
1. Never modify a file. This skill only runs the sixteen gate commands below and reports; it must not fix, format, or auto-resolve anything a gate flags, and must not run `bun run check`'s test/typecheck/format/eval legs — those are slower, behavior/build gates outside this skill's declared scope, and folding their signal into this score would conflate two different kinds of evidence.
2. Score each of the sixteen gates independently first and show the per-gate scores — never jump straight to one blended number with no per-gate table behind it, for the same reason `jstack:engineering-health` never collapses the four DORA keys into one composite.
3. Blend into the overall score using the stated weighted formula (below), not an unweighted average — a `validate-config` break has far more blast radius than a `check-name-collisions` flag, and the weights must reflect that.
4. Rank fixes by weighted points lost (weight × severity), not by raw failure count — a 15-point gate losing 8 points outranks a 4-point gate losing all 4.
5. When one root cause trips more than one gate (e.g., a missing `prompts/*.md` file fails both `check-referenced-files` and `check-prompt-wiring`), report it as a single fix ranked by its *combined* weighted impact across every gate it touches, not as separate smaller fixes — fixing the root cause clears every gate it broke.
6. Never invent a failure count or pass/fail status for a gate that didn't actually run (e.g. `bun install` wasn't done, or the process errored before the check's own logic executed). Report `[not run: <reason>]` and exclude that gate from the weighted formula's denominator — do not blend it in as a 0 or a 100.

### Anti-overcorrection notes
- Do not conflate a `check-prompt-wiring` or `check-referenced-files` failure on a brand-new, uncommitted skill with the same failure on a shipped skill — run `git status` first; an in-progress file mid-authoring is not the same severity as live drift on something others already depend on.
- Do not conflate a Tier B/C advisory finding from `skills-depth-check`/`agents-depth-check` with a CORRECTNESS failure or a Tier A depth miss — both scripts only make DEPTH findings fatal under `--strict`, and tier depth requirements to a skill's/agent's own `effort`. Read each finding's `kind` (correctness vs depth) and tier before weighting two findings as equally severe.
- Do not conflate a `check-name-collisions` flag (two skill names within edit-distance ≤2 that fail to disambiguate each other in prose) with a `validate-chains` or `check-referenced-files` failure (a reference pointing at something that does not exist). One is a discoverability risk between two working skills; the other is a functional break.
- Do not conflate a `skills-depth-check` pass backed by an entry in the script's own `EXEMPTIONS` table with a skill that passed the rule outright — an exemption is a reviewed, reasoned waiver of one specific rule, not evidence the skill is fully clean on that dimension. Note exemption-backed passes explicitly rather than folding them into "N gates fully clean."

### Gate weights (blast radius)
Weights sum to 100 and are fixed to this repo's real topology, not assigned per run. Sixteen gates, not ten — every fast, deterministic, non-test/typecheck/format/eval/a2a gate in `bun run check`'s real chain (`package.json`'s `check` script) is in this table; if a future `bun run check` adds another gate of this kind, add it here rather than letting the score go quietly incomplete.

| Gate | Command | Weight | Why this weight |
|---|---|---|---|
| Config schema | `bun run validate-config` | 15 point | Every skill's config defaults load through this; a break here degrades every skill in the catalog, not one. |
| Chain integrity | `bun run validate-chains` | 11 point | A dangling `chains-to:` breaks the multi-skill handoff the catalog advertises. |
| Write-gate coverage | `bun run check-write-gates` | 8 point | Confirms every write/operational skill declares `disable-model-invocation` — a miss here lets a model auto-trigger an external write. Security-adjacent, weighted accordingly. |
| Agent config matrix | `bun run check-agent-matrix` | 8 point | Cross-checks agent frontmatter against `docs/agents-config-matrix.md`'s 24-agent matrix. |
| Agent depth | `bun run agents-depth:strict` | 8 point | Structural/depth quality gate across all 24 agents. |
| Skill depth | `bun run skills-depth:strict` | 7 point | Structural/depth quality gate across the full skill catalog (currently 147+ skills). |
| Router matrix | `bun run check-routers` | 7 point | Router → child-skill resolution; a break here strands a router's children. |
| SRI / third-party pinning | `bun run check-sri` | 6 point | Enforces SRI pins and a minimum DOMPurify version on report HTML shells — a real CDN-substitution/mXSS security gate, not a style check. |
| Description references | `bun run check-description-refs` | 6 point | Confirms `use jstack:<slug>` disambiguation prose in descriptions resolves to a real skill. |
| Config schema drift | `bun run schema:check` | 5 point | Confirms `config/schema.json` matches the Zod source in `cli/src/types/config.ts` — a different failure mode than `validate-config` (drift in the generated reference, not a bad config value). |
| Referenced files | `bun run check-referenced-files` | 5 point | Confirms a `templates/`/`prompts/`/`skills/` path quoted in prose actually exists on disk. |
| Prompt wiring | `bun run check-prompt-wiring` | 4 point | Confirms every file under `prompts/` is `!cat`'d by at least one skill or agent. |
| Name collisions | `bun run check-name-collisions` | 4 point | Flags skill names within edit-distance ≤2 lacking mutual disambiguation — a discoverability risk, not a functional break. |
| Agent frontmatter | `bun run agents-check` | 3 point | Validates `agents/*.md` YAML frontmatter (name, description) — the agent-side analog of a skill's own frontmatter checks. |
| Report schema drift | `bun run report-schema:check` | 2 point | Same drift check as `schema:check`, scoped to the narrower report-payload schema. |
| Alias drift | `bun run validate:alias-drift --strict` | 1 point | Confirms alias mappings haven't drifted from their target skills — narrow blast radius, lowest weight. |

### Failure-count anchor bands
Applied per gate, using that gate's own reported failure count (not a 1-10 guess):

| Failures reported by the gate | Score |
|---|---|
| 0 | 100 |
| 1 — a single, isolated instance (one typo'd path, one stale reference) | 88 |
| 2-4 — a handful, still enumerable by hand in the tool's own output | 65 |
| 5-11 — a pattern, e.g. the same mistake repeated across several skills or one shared template bug | 30 |
| ≥12 — systemic: touches a double-digit share of the ~143-skill / 24-agent catalog | 10 |

A single typo-level failure (score 88) must never read the same as 12 skills failing the same gate (score 10) — that is the entire reason this uses bands, not a linear "minus N points per failure" formula, which would score both cases near-identically once N is small.

### Overall score formula
`overall = round( Σ(weight_i × score_i) / Σ(weight_i for gates that ran) )`

Gates marked `[not run: <reason>]` (Absolute rule 6) drop out of both the numerator and denominator — they do not silently count as failing (0) or passing (100).

### Named anti-patterns
| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Treating every gate failure as equally urgent regardless of `git status` | An uncommitted, mid-authoring skill failing `check-prompt-wiring` is noise from work in progress, not live drift | Check `git status` before ranking; flag uncommitted-file failures separately and lower priority |
| Flattening `skills-depth-check`'s tiered CORRECTNESS/DEPTH findings into one bucket | The script enforces depth *proportionally* to `effort` tier and only makes DEPTH fatal under `--strict` — a Tier C advisory is not a fatal Tier A miss | Report CORRECTNESS and Tier A DEPTH findings separately from Tier B/C advisory findings |
| Reading an `EXEMPTIONS`-backed pass as a clean pass | `scripts/skills-depth-check.ts`'s `EXEMPTIONS` table waives one named rule for one named skill with a stated reason — a reviewed waiver, not equivalent evidence of quality | Note exemption-backed passes explicitly; don't count them toward "N gates fully clean" without the caveat |
| Weighting `check-name-collisions` like a functional-break gate | It flags a naming-ambiguity risk between two *working* skills, unlike `validate-chains`/`check-referenced-files`, which flag a reference to something that does not exist | Keep its 5-point weight low relative to the functional-break gates (table above) |
| Folding `bun run check`'s typecheck/test/format/`a2a` legs into this score | Those are slower behavior/build gates outside the sixteen structural/config gates this skill blends; mixing them in adds unrelated signal to the number | Run only the sixteen named gates here; point the user at `bun run check` directly for the full chain |

### Worked example
- **Weak:** "Compatibility score: 74/100. A few skills have issues, mostly minor."
- **Sharp:** "Compatibility score: 95/100 (15 of 16 gates ran; `check-referenced-files` was not run — `bun install` was stale — and is excluded from the blend, not scored as 0). Per-gate: `validate-config` 100 (15 pts), `validate-chains` 100 (11 pts), `check-write-gates` 100 (8 pts), `check-agent-matrix` 100 (8 pts), `agents-depth:strict` 100 (8 pts), `skills-depth:strict` 65 (7 pts, 3 Tier-A depth misses), `check-routers` 100 (7 pts), `check-sri` 100 (6 pts), `check-description-refs` 88 (6 pts, 1 dangling `use jstack:` reference), `schema:check` 100 (5 pts), `check-prompt-wiring` 65 (4 pts, 3 orphaned prompt files), `check-name-collisions` 100 (4 pts), `agents-check` 100 (3 pts), `report-schema:check` 100 (2 pts), `validate:alias-drift` 100 (1 pt). Weighted sum 9,043 over a 95-point denominator (100 minus `check-referenced-files`'s excluded 5) rounds to 95. Top fix: the 3 orphaned prompt files under `check-prompt-wiring` (4 pts lost) turn out to be the same 3 files `check-referenced-files` would also have flagged had it run — one root cause (files moved without updating their `!cat` sites) — ranked above the 3 Tier-A depth misses (7 pts lost, but confined to one gate) once both gates are confirmed to share the cause; ranked by weighted loss alone the prompt-wiring break would have looked lower-priority than it actually is. A single blended '95/100, mostly minor' would have hidden that the depth misses and the prompt-wiring break need two different fixes, not one."
- The sharp version shows the per-gate table before the blend, states which gate was excluded and why, and ranks by combined cross-gate impact rather than raw point loss alone. Recompute the arithmetic before citing a score — a worked example whose own numbers don't reduce to its stated total is worse than no example.

### What this skill must not do
- Not fix, format, or auto-resolve any finding — report only; the user or a follow-up skill applies fixes.
- Not run `bun run check`'s typecheck, `test:cli`, `test:dashboard`, `format:check`, `eval:*`, or `a2a` legs — those are out of scope for this score.
- Not invent a score for a gate that did not run — mark it `[not run: <reason>]` and exclude it from the blend.
- Not scan a repo other than jstack.core unless the user explicitly names one.
- Not treat this score as a substitute for `bun run check` passing — a 100 here does not mean CI is green; it means the sixteen structural/config gates are green.

## Config and references
- This is a self-check of the jstack.core repo's own gates, not a team-config-driven report — it needs no `jstack.config.json` values beyond confirming the repo root; do not read `jira_rules`/`notion`/`gbrain`/integration config for this skill, they're not relevant to what it does.
- Questions (open-ended, one at a time): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/question-patterns.md`
- Discrete choices (when the host supports AskUserQuestion or equivalent): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/ask-user-question-patterns.md`
- Chaining: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/chaining-guide.md`

## Intake
1. Parse `$ARGUMENTS` — note whether the user wants the full sixteen-gate run (default) or named a subset of gates.
2. If the working tree has uncommitted changes, run `git status` first so gate failures can be flagged as mid-authoring noise vs. live drift (Anti-overcorrection notes).
3. If the request bundles multiple unrelated goals, handle the compatibility check first and offer to continue.

## Procedure
### Step 1 — Load config
Confirm the working directory is jstack.core (not `jstack.gusto` or another overlay) and check `git status` for uncommitted files, per the anti-overcorrection notes. No `jstack.config.json` values are required to run the gates themselves.

### Step 2 — Plan the safe path
Name the exact sixteen commands to run (Gate weights table) before running anything. Confirm none of them write files — all sixteen are read-only checks by design (verify against their own source comments if in doubt) — since this skill must never modify the repo.

### Step 3 — Execute
Run each of the sixteen commands and capture its exit code and reported failure count:
Run in the same order as the Gate weights table, so the per-gate table you build in Step 4 lines up with it directly:
```
bun run validate-config
bun run validate-chains
bun run check-write-gates
bun run check-agent-matrix
bun run agents-depth:strict
bun run skills-depth:strict
bun run check-routers
bun run check-sri
bun run check-description-refs
bun run schema:check
bun run check-referenced-files
bun run check-prompt-wiring
bun run check-name-collisions
bun run agents-check
bun run report-schema:check
bun run validate:alias-drift --strict
```
For each gate, map its reported failure count to the anchor bands, apply its weight, and compute `overall` with the stated formula. Cross-reference failures between gates (Absolute rule 5) before ranking. Order the fix list by weighted points lost, breaking ties by how many gates a single root cause touches, then by how many skills/agents/files it touches within the top gate.

### Step 4 — Validate
Confirm every per-gate score cites the actual command run and its literal reported failure count — never a paraphrase or a guessed number. Confirm the overall score's arithmetic matches the stated formula exactly, and that any gate marked `[not run]` was excluded from both numerator and denominator.

### Step 5 — Summarize and hand off
State the overall score, the per-gate table, the ranked fix list, and what changed nothing (this skill made zero edits). Suggest **one** next jstack skill (e.g. `jstack:engineering-health` for runtime/DORA signal, or point at `bun run check` for the full CI chain) if the work naturally continues.

## Output shape
Use a domain-appropriate heading, then:
- **Summary** (2-4 sentences: overall score, how many gates ran, headline root cause if one dominates)
- **Details** — per-gate table (gate, weight, failure count, score) and the ranked fix list (root cause, gates/skills affected, weighted points recoverable)
- **Next steps** with owner + timeline if known
- **Limitations** (any `[not run]` gates and why, uncommitted-file caveats)
- For eval-gated skills, end with `result_ok: true` or `result_ok: false` + reason

## Failure modes

| Symptom | Recovery |
|---------|----------|
| A gate command errors before its own check logic runs (e.g. missing `bun install`) | Mark that gate `[not run: <reason>]`; exclude from the weighted formula; do not score it 0. |
| Two or more gates fail from the same root cause | Report as one fix ranked by combined weighted impact across every gate it touches (Absolute rule 5). |
| Working tree has uncommitted changes | Run `git status` first; flag failures on uncommitted files as lower-urgency mid-authoring noise, not equal to shipped-skill drift. |
| `skills-depth-check`/`agents-depth-check` reports both correctness and depth findings | Separate CORRECTNESS and Tier A DEPTH (fatal-under-`--strict`) from Tier B/C advisory findings before scoring. |
| User asks for the full `bun run check` result, not just these sixteen gates | Explain this skill's scope is the sixteen structural/config gates, then point at `bun run check` for typecheck/tests/format/evals/a2a. |

## Chaining
Complete the work here. If a natural follow-up exists, add one line: `suggested_next: <skill-name>` with a copy-paste handoff block (e.g. `jstack:engineering-health` for runtime signal, or `bun run check` directly for the full CI chain). Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

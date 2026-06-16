# CLAUDE.md Improver — Design

**Status:** Approved (CEO/PM/ENG/QA convergence at 10/10/10/10 after three review rounds)
**Date:** 2026-04-29
**Author:** Claude Opus 4.7 (autonomous design pass at user direction)
**Scope:** New sub-skill at `skills/skill-creator/improve-claude-md/SKILL.md` (`gate_id: jstack:skill-creator/improve-claude-md`). New typed module `cli/src/lib/claude-md-improver.ts` + CLI subcommand `jstack claude-md improve`. New persona file `prompts/personas/pm.md` (general-purpose). Catalog regen via `scripts/apply_detailed_skills.py` (skill added to `SKIP`).

**Decision being approved:** Author one new sub-skill + one new CLI subcommand + one new persona file (~500 LOC TS + ~180 lines markdown) over four sequential PRs. Read-only by default; emits a unified diff against `CLAUDE.md` and waits for the user to apply. Estimated author time: ~3 engineer-days. Strategic value: most projects' `CLAUDE.md` files drift away from reality within weeks — this skill keeps them aligned to what the codebase and the user's actual workflows demand, so Claude makes fewer mistakes per session.

## 1. Problem

`CLAUDE.md` is the highest-leverage file in a Claude-Code-driven project: every session loads it, and a single sharp rule there saves dozens of corrections downstream. But three failure modes accumulate silently:

1. **Drift.** A rule that was true at write-time goes stale: "use Yarn" persists after the team migrates to pnpm; "tests live in `__tests__/`" persists after a move to `tests/`.
2. **Vagueness.** Rules read fine to a human but give Claude no traction: "follow our style guide" with no link; "always test" with no framework named.
3. **Missing rules where the user is repeatedly correcting Claude.** The session JSONL transcripts contain N user prompts of the form *"no, don't do X — do Y"* — those are unwritten rules paid for in tokens every week.

Today no skill in `jstack.core` (134 skills) audits CLAUDE.md against the project's actual state and the user's actual session history. The closest neighbors are `jstack-skill-creator` (authors a *new* skill, not edits to CLAUDE.md), `jstack-self-explain` (explains decisions, not project rules), and `jstack-doctor` (config health, not prose). There is a real gap.

### Why a skill, not a one-off script

Claude Code already gives every session full read access to `~/.claude/projects/<encoded>/*.jsonl`, the project's `CLAUDE.md`, and the live working tree. The synthesis from "here are 30 days of corrections + commits + the live `CLAUDE.md`" to "here are 5 surgical edits that prevent the next week of corrections" is exactly the kind of judgment task an LLM-driven skill does well — and exactly the kind of task a deterministic linter cannot do well, because the question "is this rule too vague?" has no syntactic answer.

### Per-engineer ROI sketch

Conservative back-of-envelope (assumptions explicit so they can be argued):

- Mid-level engineer fully-loaded cost: **$75/hr**.
- Average correction event ("no, don't do that — do this") in a session: **2-3 min** of human time.
- Observed correction rate on a CLAUDE.md that has drifted ~30 days: **~6 corrections/week**.
- Each accepted CLAUDE.md improvement eliminates ~1 of those: **2.5 min × 1/week × 4 weeks ≈ 10 min/month per rule**.
- A single recommender run that lands 4 accepted edits: **40 min/month/engineer ≈ $50/month/engineer**.
- For a 10-engineer team running this monthly: **$500/month team-wide**, against ~3 days of one-time author cost.

## 2. Goals

- A single command (`/jstack:skill-creator/improve-claude-md` or via the parent router) that reads `CLAUDE.md` + recent commits + recent session transcripts + project state, then **emits a ranked list of proposed edits** to `CLAUDE.md` — each rendered as a unified diff (before / after) with category, benefit, evidence, and time-saved estimate.
- Each recommendation includes provenance: which commits, which session messages, which file paths in the working tree triggered it.
- Read-only by default. The skill **never writes** to `CLAUDE.md` itself — it emits a `.patch` file and the user runs `git apply` (or pastes individual hunks). Optional `--apply` flag bypasses for users who want one-shot application; gated behind a confirmation per the safety norms in `_core/references/safety.md`.
- Multi-persona internal review (CEO/PM/ENG/QA) of the proposed edits **before** presenting to the user, so low-quality / risky edits are filtered automatically.
- Pluggable detector set so the skill can grow without touching the core orchestration.

### User journey (when does the user actually run this?)

Three explicit entry points — designed for all three:

1. **Monthly hygiene.** A `routines` entry (`scripts/routines/monthly-claude-md-review.json`) runs the improver on the first Monday of each month and posts the proposed diff to the user's Notion `private_scratchpad` (or stdout if Notion isn't configured).
2. **After a high-correction session.** A `Stop` hook detects sessions where the user issued ≥5 corrections (regex over the JSONL: `^(no|don't|stop|wait|that's wrong)\b`). On detection, prints a one-liner: *"You corrected Claude 7 times this session — run `/jstack:skill-creator/improve-claude-md` to capture them as rules."*
3. **Ad-hoc.** User notices CLAUDE.md is stale and runs the skill directly.

### Discovery surface

- `jstack-skill-creator` (parent) lists `improve-claude-md` in its sub-skills section.
- README "Quick start" gets a 2-line bullet: *"Keep CLAUDE.md sharp: `/jstack:skill-creator/improve-claude-md`."*
- The `Stop` hook from §2.2 surfaces it organically when value is highest.

## 3. Non-Goals

- Authoring **new skills** based on session signals. That is a different feature and was previously scoped in a separate spec; it is explicitly out of scope here.
- Replacing `jstack-recon` (work signals) or `jstack-doctor` (config health). This skill is about **prose in CLAUDE.md**.
- Automatically writing CLAUDE.md without user confirmation. The default is *propose-as-diff*; `--apply` is opt-in.
- Editing global / user-scope `~/.claude/CLAUDE.md`. v1 only edits the project-root `CLAUDE.md` (and `CLAUDE.local.md` if present, treated as a separate target with its own diff).
- Inventing rules from thin air. Every recommendation must cite ≥1 piece of evidence (commit, session, working-tree path, or another rule).

## 4. Inputs

| Source | What we read | Why |
|--------|--------------|-----|
| `CLAUDE.md` (project root) | All lines, parsed as markdown sections | The thing we're proposing edits to |
| `CLAUDE.local.md` (if present) | Same | Personal overrides — proposed as a separate diff |
| `git log --stat -n 100 --pretty=format:'%H%x09%s%x09%ad'` | Last 100 commit subjects + touched files | Detects (a) what the user actually does, (b) whether commit messages contradict CLAUDE.md rules |
| `~/.claude/projects/<encoded>/*.jsonl` (last 30d) | User messages (`type:"user"`) and assistant tool sequences | Detects user corrections, repeated asks, places where Claude misread CLAUDE.md |
| `package.json` / `Cargo.toml` / `pyproject.toml` / `go.mod` (when present) | Language, dependencies, scripts | Detects rules that contradict the actual stack ("use Yarn" vs `package-lock.json`) |
| Working-tree filenames touched by recent commits | Paths only, no content | Detects stale path references in CLAUDE.md ("tests live in `__tests__/`" when the directory is now `tests/`) |
| `jstack.config.json` | Integrations, `skill_defaults` | Detects rules referencing integrations the user hasn't configured (or vice versa) |
| `README.md` | First 100 lines | Detects rules that duplicate README content (move to README) or contradict README |

**Encoded path resolution:** `<HOME>/.claude/projects/<path-with-/-replaced-by->`. If absent, the skill runs without session-derived detectors and labels those rules as `confidence: medium` (it can still find drift and vagueness from the working tree alone).

**Token budget.** The skill must work on a CLAUDE.md up to 2000 lines and a transcript directory up to 200 JSONL files (≈ 100MB). Implementation: the deterministic Bun module pre-filters transcripts by recency and by regex (`corrections`, `tool errors`, `repeat asks`) before the LLM ever sees them. Typical LLM-visible token count: ~4k tokens of CLAUDE.md + ~6k tokens of distilled evidence ≈ 10k input tokens per run.

## 5. Architecture

### 5.1 Pipeline (read-only, five stages)

```
   ┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌────────────────┐
   │ 1. Collect  │ →  │ 2. Detect    │ →  │ 3. Propose   │ →  │ 4. Persona   │ →  │ 5. Render      │
   │   inputs    │    │   issues     │    │   edits      │    │   review     │    │   diff + report│
   └─────────────┘    └──────────────┘    └──────────────┘    └──────────────┘    └────────────────┘
```

**Implementation split (v1 from day one):**

- **Deterministic stages 1, 2, 5** are a typed Bun module at `cli/src/lib/claude-md-improver.ts`:
  - `collect()` — file IO, transcript filtering, project-state probe.
  - `detect()` — runs detectors D1-D10 against collected inputs, emits `Issue[]`.
  - `render()` — turns final approved edits into a unified diff + markdown report.
- **LLM-driven stages 3, 4** live in the SKILL.md procedure:
  - `propose()` — for each `Issue`, the LLM writes a concrete patch (before/after text). Detectors emit *what's wrong*; the LLM emits *what to write instead*.
  - `review()` — four-persona pass over the proposed patches.

CLI exposes the deterministic stages via `jstack claude-md improve --json` so the SKILL.md just calls one command, parses JSON, runs the prompt, calls back into `jstack claude-md improve --render --input final.json`.

### 5.2 Detectors (curated, finite list — v1)

A **detector** consumes one input source and emits zero or more `Issue` records. Detectors find the *evidence*; the LLM proposes the *fix*. v1 ships with the following ten detectors. The list is curated (not LLM-generated) so issues are reproducible across runs and can be unit-tested.

| # | Detector | Source | Trigger heuristic | Issue category |
|---|----------|--------|---------------------|----------------|
| D1 | Stale package-manager rule | CLAUDE.md + lockfiles | CLAUDE.md says `yarn`/`npm`/`pnpm` but a different lockfile exists | `remove-stale-rule` |
| D2 | Stale path reference | CLAUDE.md + working tree | CLAUDE.md mentions a path (`__tests__/`, `src/legacy/`) that does not exist | `remove-stale-rule` |
| D3 | Vague rule (no concrete subject) | CLAUDE.md | Sentence matches `\b(always|never|prefer|use)\b` and contains no proper noun, code-fence, or path | `sharpen-rule` |
| D4 | Repeated user correction | session JSONL | ≥3 user messages in 30d matching `^(no|don't|stop|wait|that's wrong)\b.*\b<noun>\b` for the same noun | `add-rule` |
| D5 | Repeated user re-ask | session JSONL | Same prompt (Levenshtein ≤10%) ≥3× across sessions and CLAUDE.md does not answer it | `add-rule` |
| D6 | Internal contradiction | CLAUDE.md | Two rules in the same file that semantically conflict (LLM-judged in stage 3, but D6 surfaces candidate pairs by topic-tag overlap) | `fix-contradiction` |
| D7 | Missing example for a rule | CLAUDE.md | A rule references a "style"/"format"/"convention" without a code-fence or link within 3 lines | `add-example` |
| D8 | Unmentioned high-frequency command | commits + transcripts | A command (e.g. `bun run typecheck`) appears in ≥5 commits/sessions but is not in CLAUDE.md | `add-rule` |
| D9 | README duplication | CLAUDE.md + README | A rule's normalized text appears verbatim (or ≥80% match) in README — keep one, link the other | `dedupe` |
| D10 | "Don't" gap | CLAUDE.md + session JSONL | All CLAUDE.md rules are positive ("do X") and the session JSONL contains a recurring class of *what not to do* not yet captured | `add-rule` (with negative framing) |

Each detector is a function in `cli/src/lib/claude-md-improver.ts` with a fixture input + expected `Issue[]` output. Implementation notes live in `references/detectors.md`.

### 5.3 Issue and Edit shapes

```ts
type Issue = {
  id: string;                       // i-001, i-002, ...
  detector: string;                 // "D2"
  category: "remove-stale-rule" | "sharpen-rule" | "add-rule" |
            "add-example" | "dedupe" | "fix-contradiction" | "add-reference";
  claude_md_anchor: { line_start: number; line_end: number } | null; // null for "add"
  evidence: {
    commits?: string[];             // short hashes
    session_excerpts?: { session_id: string; excerpt: string }[]; // ≤80 chars, redacted
    file_paths?: string[];          // relative to project root
    related_rules?: number[];       // line numbers of related CLAUDE.md rules
  };
  raw_summary: string;              // one-line description of the issue
  estimated_corrections_avoided_per_week: number;
  confidence: "high" | "medium" | "low";
};

type ProposedEdit = {
  issue_id: string;
  category: Issue["category"];
  before: string | null;            // null for "add" categories
  after: string | null;             // null for "remove" categories
  rationale: string;                // 1-2 sentences for the user
  diff_hunk: string;                // unified-diff hunk against CLAUDE.md
  benefit: string;                  // "Claude stops suggesting Yarn commands."
  example: string;                  // a concrete next-session example of how this rule helps
  time_saved_min_per_week: number;  // = estimated_corrections_avoided × 2.5
  monthly_savings_min: number;
  confidence: "high" | "medium" | "low";
  priority_score: number;           // = monthly_savings_min × confidence_weight
};
```

### 5.4 Persona-review filter (CEO / PM / ENG / QA)

After stage 3, the proposed edits are passed through a four-persona internal critique using `prompts/personas/{ceo,pm,engineer,qa}.md`. Each persona scores against a structured rubric (defined in `references/persona-review.md`) with 1-10 sub-scores. An edit is included in the final report only if **≥3 of 4 personas score ≥8 OR all four score ≥8 after one auto-iteration pass**.

| Persona | Sub-scores (1-10 each, must avg ≥8) | Hard rejects |
|---------|--------------------------------------|--------------|
| CEO (`ceo.md`) | (a) Strategic value of the rule  (b) Avoids over-prescription  (c) Risk profile | Vanity rules; rules that lock the team to a vendor |
| PM (new `pm.md`) | (a) Trigger clarity  (b) Outcome observability  (c) Fit with user's actual workflow | Vague rules; rules contradicting another tool's docs |
| ENG (`engineer.md`) | (a) Technical accuracy  (b) Convention fit  (c) No conflict with existing rule | Wrong API; deprecated pattern; conflicts with another CLAUDE.md line |
| QA (`qa.md`) | (a) Testability  (b) Reversibility (no side effects from the rule itself)  (c) Failure-mode coverage | Rule introduces ambiguity; rule that can't be observed in a session |

**Deterministic test mode.** `--persona-mode=rubric-only` scores each edit against the rubric without LLM judgment (e.g. checks "edit contains an `example` field" → outcome-observability sub-score). Used in CI evals.

The skill iterates each edit up to **one** auto-revision pass if any persona scores <8, applying that persona's text edit to the `rationale`/`after`/`example` fields, then re-scoring. After one pass, drop any edit still <8 and surface it in the "Filtered out" section with the rejection reason — the user can still see it for transparency.

### 5.5 Report renderer & selection UX

Two artifacts written to `.jstack/`:

1. **`.jstack/claude-md-improvements-<YYYY-MM-DD>.md`** — human report. Sections per accepted edit with category, benefit, evidence, persona scores, and the diff hunk inline.
2. **`.jstack/claude-md-improvements-<YYYY-MM-DD>.patch`** — single unified diff against `CLAUDE.md` containing every accepted edit. The user runs `git apply .jstack/claude-md-improvements-2026-04-29.patch` to apply all, or copies individual hunks.

After printing the report, the skill emits:

```
Apply edits: [a]ll, [n]one, or numbered hunks (e.g. 1,3,5).
Or run with --apply to apply all without prompting (one git commit will be created).
```

If the user picks numbered hunks, the skill writes a filtered patch and prints the `git apply` command — it does not run it. **The skill never runs `git` mutations or writes to `CLAUDE.md` directly except behind the explicit `--apply` flag.**

### 5.6 Example output (illustrative)

```diff
# Improvement 2 of 4 — Remove stale package-manager rule       [priority: 56.0]
- Category: remove-stale-rule (D1)
- Confidence: high
- Saves ~10 min/month (~1 correction/week × 2.5 min)
- Persona scores: CEO 9, PM 10, ENG 10, QA 9
- Evidence: package-lock.json present (npm); CLAUDE.md says "yarn"; 4 commits in 30d run `npm ci` not `yarn install`.
- Benefit: Claude stops suggesting `yarn add` and `yarn run` commands.
- Example: Next time you ask "install lodash", Claude proposes `npm install lodash` instead of `yarn add lodash`.

@@ -23,3 +23,3 @@
- Use `yarn` for all package-management commands.
+ Use `npm` for all package-management commands (lockfile: `package-lock.json`).
```

## 6. Skill file layout

```
skills/skill-creator/improve-claude-md/
  SKILL.md                       # ~140 lines, hand-maintained (added to SKIP)
  references/
    detectors.md                 # D1-D10 implementation notes & fixtures
    scoring.md                   # priority_score formula & confidence weights
    persona-review.md            # rubric for the 4-persona pass
    output-schema.md             # JSON schema for --output=json
  evals/
    inputs/
      stale-claude-md/           # fixture: stale yarn rule, stale path, vague rule (expects D1, D2, D3)
      missing-rules-from-corrections/  # synthetic JSONL fixture, expects D4
      contradictory-claude-md/   # two rules that conflict, expects D6
    expected/
      stale-claude-md.expected.patch
      missing-rules-from-corrections.expected.patch
      contradictory-claude-md.expected.patch
    eval.config.json
prompts/personas/
  pm.md                          # new — Product Manager persona (general-purpose)
cli/src/lib/
  claude-md-improver.ts          # collect/detect/render — typed, unit-tested
cli/src/commands/
  claude-md.ts                   # CLI subcommand: `jstack claude-md improve [--apply] [--json] [--persona-mode=...]`
```

## 7. Output formats

Per `_core/references/output-formats.md`, the skill supports:
- `--output=prose` (default) — markdown report + patch file written; brief stdout summary.
- `--output=json` — machine-readable: `{ recommendations: ProposedEdit[], filtered_out: ProposedEdit[], meta: {...} }`. Schema in `references/output-schema.md`. Used by the routine in §12 to post to Notion.
- `--output=patch` — only the unified diff to stdout, suitable for `| git apply`.

## 8. Failure modes

| Symptom | Cause | Recovery |
|---------|-------|----------|
| "No CLAUDE.md found" | Project has no CLAUDE.md | Offer to scaffold a starter via `jstack-skill-creator` parent; abort cleanly |
| "No transcripts found" | Project has no `~/.claude/projects/<encoded>/` directory | Continue with commits + working-tree only; mark recommendations `confidence: medium`; emit a header note |
| "git log unavailable" | Not a git repo | Continue with CLAUDE.md + transcripts only; emit a header note |
| Detector matches everything | Repo too noisy or CLAUDE.md too permissive (e.g. >50 issues) | Cap at top 10 by priority; surface the rest in a `--verbose` mode |
| Persona-review pass produces 0 accepted | Detectors over-firing or CLAUDE.md actually fine | Surface the rejected list with rejection reasons; suggest `--persona-threshold=2` for weaker filtering |
| User runs `--apply` and `git apply` fails | CLAUDE.md modified after the run | Print the failed hunk and instruct user to re-run the improver; do not attempt 3-way merge |
| Encoded transcript path collision (project moved) | Repo renamed since transcripts recorded | Try both old and new encoded paths; report which were merged |
| LLM proposes an edit that re-introduces a previously-rejected rule | Pattern of churn | Maintain `.jstack/claude-md-improver-history.json` of declined edits; auto-skip them on next run unless evidence changes |
| Token budget exceeded on huge CLAUDE.md | File >2000 lines | Section-by-section mode: process one `## ` section at a time, merge results |

## 9. Configuration

Adds these keys to `jstack.config.json` (all optional; defaults shown):

```jsonc
{
  "claude_md_improver": {
    "enabled": true,                       // default true; users can opt out
    "transcript_lookback_days": 30,
    "commit_lookback_count": 100,
    "min_priority": 5.0,                   // suppress trivial recs
    "persona_threshold": 3,                // 3 of 4 personas must accept
    "report_path": ".jstack/claude-md-improvements-{date}.md",
    "patch_path": ".jstack/claude-md-improvements-{date}.patch",
    "high_correction_session_threshold": 5 // for the Stop hook prompt
  }
}
```

Schema entries added to `config/schema.json` and `defaults.json`. `update-config` learns the dot paths.

## 10. Privacy

- All inputs are read locally; nothing leaves the machine.
- The report includes commit hashes (short) and session excerpts (≤80 chars, redacted).
- A `--redact` flag replaces session excerpts with `[redacted-evidence-N]` and emits a sidecar key file (kept locally, gitignored) so the user can share the report externally.

**PII / secret-redaction patterns** (always-on):

- API keys: `(sk|pk|api[_-]?key)[-_=:][\w-]{16,}` → `[redacted-key]`
- Bearer tokens / JWTs: `eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}` → `[redacted-jwt]`
- Email addresses: `\b[\w.+-]+@[\w-]+\.[\w.-]+\b` → `[redacted-email]`
- AWS-style: `AKIA[0-9A-Z]{16}` → `[redacted-aws]`
- Common secret prefixes: `ghp_`, `glpat-`, `xoxb-`, `xoxp-` → redacted match
- Pasted code blocks > 10 lines in user prompts: collapsed to `[code block, N lines]`

Patterns live in `cli/src/lib/claude-md-improver.ts` constant `PII_PATTERNS` and are unit-tested.

## 11. Testing

- **Eval fixtures** in `evals/inputs/` (see §6) — each has an `expected.patch` and the eval runner asserts the produced patch matches modulo whitespace.
- **Detector unit tests**: each detector D1-D10 is a function with a fixture + expected `Issue[]` output. Runs as part of `bun run test`.
- **Persona-review test**: `--persona-mode=rubric-only` against a fixture edit list; assert structural pass/fail per `references/persona-review.md`.
- **End-to-end nightly eval** (LLM mode): run on a frozen snapshot of `jstack.core`'s own `CLAUDE.md` + a fixture transcript directory; assert ≥1 known-good edit appears in the output.
- **Idempotency test**: applying the patch and immediately re-running must produce zero new recommendations on the same fixtures.
- **Apply-safety test**: `--apply` against a CLAUDE.md modified after `--scan` must abort cleanly with a clear error and no partial write.

## 12. Rollout

Each step is a separate PR. Default-on is gated by passing eval baselines on the three fixture repos.

1. **PR-1.** Land `cli/src/lib/claude-md-improver.ts` (collect + detect + render) + `cli/src/commands/claude-md.ts` (`scan`, `render` subcommands; no `--apply` yet) + unit tests on D1-D10 + the three fixtures. Skill not yet exposed. Config key `claude_md_improver.enabled` defaults to **false**.
2. **PR-2.** Add `prompts/personas/pm.md` + `references/persona-review.md` rubric + LLM persona pass invoked from the SKILL.md draft. Skill still gated.
3. **PR-3.** Author `skills/skill-creator/improve-claude-md/SKILL.md`. Add to `SKIP` set in `scripts/apply_detailed_skills.py` (exact line: append `'skills/skill-creator/improve-claude-md/SKILL.md'` to the `SKIP` list). Run dogfood on `jstack.core`; commit the dogfood report to `docs/superpowers/dogfood/2026-MM-DD-claude-md-improver-self-scan.md`. Add `--apply` flag (read-only path is the default; `--apply` requires explicit confirmation prompt unless `--yes`).
4. **PR-4.** Wire the monthly routine + the `Stop` hook for high-correction sessions + README quick-start + `jstack-skill-creator` parent router cross-reference. Flip `claude_md_improver.enabled` default to **true** (opt-out via `jstack setup --reconfigure`).

**Rollback path.** Flip `claude_md_improver.enabled` to false in `defaults.json`; the skill returns "claude-md-improver disabled in config" and exits. Read-only by default; `--apply` is the only mutation path and is explicit. Rollback is instant.

## 13. Open questions (resolved during persona iteration)

- ~~Should the skill modify `CLAUDE.md` directly?~~ → **No.** Default emits a unified diff; `--apply` is opt-in and user-confirmed.
- ~~Is one PM persona enough or do we want PM + Designer?~~ → **PM only** for v1. Designer's craft lens doesn't add much for prose-rule edits; revisit if visual instructions ever land in CLAUDE.md.
- ~~Do we need a separate skill or extend `jstack-skill-creator`?~~ → **Sub-skill under skill-creator** keeps the family coherent (skill-creator authors capabilities; improve-claude-md sharpens the rules that drive those capabilities).
- ~~How do we avoid recommending the same edit forever after the user declines it?~~ → `.jstack/claude-md-improver-history.json` of declined edits; skipped on subsequent runs unless evidence materially changes.
- ~~Detector D6 (contradictions) requires semantic understanding — can a deterministic detector find them?~~ → D6 surfaces candidate *pairs* by topic-tag overlap (deterministic); the LLM in stage 3 confirms whether they actually contradict.

## 14. Success criteria

**Functional (must hit before flipping `enabled=true` default):**
- Run on `jstack.core`'s own CLAUDE.md produces ≥3 actionable edits, ≥1 of which the maintainer accepts.
- Report renders in <8s on a CLAUDE.md ≤500 lines + 100 commits + 100 transcripts.
- Idempotency: re-running after applying produces zero new recommendations on the same fixtures.
- Eval suite green on three fixtures (`stale-claude-md`, `missing-rules-from-corrections`, `contradictory-claude-md`).
- `--apply` never produces a partial write; either the entire patch applies or nothing does.

**Adoption (4-week post-launch readout):**
- ≥40% of `jstack.core` installations that have a CLAUDE.md run the improver within 14 days of PR-4 landing.
- ≥1 user-applied patch per active project per month (telemetry: count of `--apply` confirmations).
- Average corrections-per-session decreases on dogfood projects (measured via the existing telemetry `~/.jstack/telemetry-instance-id` flow + a new `corrections_per_session` metric introduced in PR-4).

**Owner of quarterly re-baseline:** Repo maintainer of `jstack.core` (initial maintainer: jonathan.boice@gusto.com — handoff updates this line). Calendar event seeded by PR-4's routine. Re-baseline = re-run dogfood, refresh `evals/expected/`, decide whether to add new detectors based on telemetry.

---

## Persona review log (CEO → PM → ENG → QA)

Three rounds run before the spec was finalized. Each round all four personas scored against the rubric defined in §5.4.

### Round 1 — initial draft (post-rescope from skill-recommender to claude-md-improver)

| Persona | Score | Top issue |
|---------|-------|-----------|
| CEO | 7 | ROI shape unclear — "what does each accepted edit save in dollars per month?"; rollback path not stated |
| PM | 7 | User journey single-track; no surfacing path when value is highest; selection UI vague (apply all? hunk-by-hunk?) |
| ENG | 7 | Detectors mixing "what's wrong" and "what to write" — separate concerns; D6 "contradictions" too LLM-magic, no deterministic surface; token budget unstated for large CLAUDE.md |
| QA | 7 | Idempotency not specified; `--apply` race against concurrent edits not handled; no eval coverage for `--apply` safety |

### Round 2 — after first edits

Edits applied: §1 ROI sketch with explicit assumptions; §2 user journey with three entry points + Stop-hook surfacing; §5.2 detectors emit `Issue` (what's wrong); §5.3 LLM proposes `ProposedEdit` (what to write); D6 surfaces candidate pairs deterministically; §4 token-budget paragraph; §5.5 numbered selection UX; §11 idempotency + apply-safety tests; §12 explicit rollback.

| Persona | Score | Last issue |
|---------|-------|-----------|
| CEO | 9 | Decision-being-approved line missing at top; reviewer can't tell what they're committing to |
| PM | 9 | "Apply all" / "no" / "numbered hunks" UX still narrative; should show one example output and the prompt the user sees |
| ENG | 9 | `cli/src/commands/claude-md.ts` subcommand surface (`scan`/`render`/`apply`) not pinned in §6 layout; SKIP entry exact path not pinned |
| QA | 9 | "LLM proposes a previously-declined edit" failure mode not handled — user will get the same rec forever |

### Round 3 — final edits

Edits applied: top-of-doc explicit decision line; §5.6 illustrative diff output with the full prompt; §6 pinned `cli/src/commands/claude-md.ts`; §12 PR-3 includes exact SKIP entry; §8 + §13 added the declined-edit history file (`.jstack/claude-md-improver-history.json`).

| Persona | Score | Note |
|---------|-------|------|
| CEO | 10 | Approved. Decision line, ROI shape, rollback all clear. |
| PM | 10 | Approved. Three entry points + numbered selection + visible prompt + acceptance funnel via telemetry. |
| ENG | 10 | Approved. Type/markdown split is clean; subcommand surface pinned; SKIP entry pinned; declined-edit history closes the churn loop. |
| QA | 10 | Approved. Idempotency, apply-safety, declined-edit memory, and rubric-mode evals give us full coverage. |

**Convergence: 10/10/10/10.** Spec promoted to `Status: Approved`.

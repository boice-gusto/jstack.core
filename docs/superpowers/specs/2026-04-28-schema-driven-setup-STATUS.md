# Schema-Driven Setup &mdash; Status & Handoff

**Last updated:** 2026-04-29 (post-merge)
**Branch state:** **Merged to local `main`** (most-recent commit on main, NOT pushed to origin; verify with `git log -1 --oneline`)
**Plan review status:** Unanimous **10/10** on Round 2 (PLAN/CEO/PM/DESIGN/ENG/QA)
**Tests:** 128 pass / 0 fail in `cli/src`; full `bun run check` green
**Owner of this doc:** if you (Jonathan) drop the conversation, the next Claude session can read this file plus the spec and pick up exactly where we left off.

> **Note about this commit:** initial `git commit` accidentally swept up six unrelated `docs/superpowers/{plans,specs}/2026-04-2{8,9}-overlay-*` files that were sitting `??` in the working tree from a separate work track. Amended via `git commit --amend` after `git restore --staged --source=HEAD~ -- <overlay files>`. They are now back in the working tree as untracked, untouched, ready for whoever owns that track. The final commit `d12e13a` contains exactly 24 files, all part of this schema-driven-setup work.

---

## TL;DR &mdash; What we're building

A **schema-driven setup wizard** for the `jstack` CLI that walks every config field with five per-question actions (**Default / Custom / Skip / Example / Discuss**), plus a **dynamic dependency resolver** shared by the new wizard and `jstack doctor --fix`. Bundled with **5 critical bug fixes** in the existing wizard / doctor / config layer.

**Why this matters:** Today's `jstack setup` only prompts for ~3 of 18 schema sections. Users hand-edit `jstack.config.json` for everything else. Empty-string and "skipped" are conflated. Doctor passes even when external dependencies are missing. New users hit a wall.

**Shipping shape:** Behind a `--schema` flag for one minor release; promoted to default in the next minor; legacy wizard removed in the minor after that. Detailed in spec §14.

---

## Where we are right now

### Done (in working tree, not committed)

| Layer | Status |
|-------|--------|
| Spec document (15 sections incl. risk register, rollback, success metrics, migration, a11y) | ✅ Written, locked |
| 5 critical bug fixes (B1&ndash;B5) | ✅ Implemented, tested |
| Schema-questions catalog (37 entries, 9 sections) | ✅ Implemented |
| Prompt engine with Default/Custom/Skip/Example/Discuss | ✅ Implemented |
| Dependency resolver (pure, 7 check kinds) | ✅ Implemented, tested |
| `setup-schema.ts` command + flag wiring | ✅ Implemented, smoke-tested |
| `doctor --fix [--apply]` with consent gates | ✅ Implemented, smoke-tested |
| Concurrency lockfile (`setup-lock.ts`) with stale-pid steal | ✅ Implemented, 7 unit tests |
| Catalog &harr; defaults.json drift test | ✅ Implemented, 5 unit tests |
| Symbol leak guard test | ✅ Added to `schema-prompt.test.ts` |
| Idempotency test (twice non-interactive &rarr; equal patch) | ✅ Added to `schema-prompt.test.ts` |
| Recovery file lifecycle (delete-on-success) | ✅ Implemented |
| README.md updates | ✅ Done |
| CHANGELOG.md updates | ✅ Done |
| 9 visual mockups + 2 mockup-deck scorecards (R1, R2) + 2 plan-review scorecards (R1, R2) | ✅ Pushed to brainstorm browser |
| Full typecheck | ✅ Clean (only pre-existing zod error in unrelated script) |
| Multi-persona plan review &mdash; **unanimous 10/10** | ✅ Round 2 |

### Done (this session, after STATUS first written)

| Item | Result |
|------|--------|
| Resolved leftover `git stash pop` conflict on `CHANGELOG.md` | Both sets of entries kept; mine on top |
| Added `.superpowers/` and `.jstack/` to `.gitignore` | Prevents committing brainstorm dir + setup state files |
| Wrote `2026-04-28-schema-driven-setup-CHATLOG.md` | Full conversation log with intent + decisions |
| Ran `bun run check` (full CI pipeline per `CLAUDE.md`) | EXIT=0; 131 pass / 0 fail across cli/src + evals/assert.test.ts |
| Single bundled commit on `main` (not pushed) | `d12e13a` &mdash; 24 files, 3529 insertions |

### Not done (awaiting user OK)

| Item | Why blocked |
|------|-------------|
| `git push origin main` | Requires explicit user OK &mdash; affects shared state |
| `bun run verify` (the broader CI gate that wraps `check`) | Optional; user can request anytime |
| Dogfood against real `jstack.config.json` | User opt-in (no destructive action) |
| Stop the brainstorm visual companion server | User opt-in |

### Not done (out-of-scope follow-ups, deferred to v1.1+)

- Telemetry events `setup.wizard.start` / `setup.wizard.complete` to measure success metrics from spec §13.
- LLM-backed "Discuss" mode &mdash; explicitly deferred per CEO review.
- TUI (full-screen) renderer &mdash; clack line-by-line is fine for v1.
- `--resume` flag that rehydrates `.jstack/setup-recovery.json` &mdash; recovery file is written today; rehydration is later.
- Auto-detection of installed `claude`/`cursor`/`codex` CLIs.

---

## File-level inventory

### New files (8)

| Path | Purpose | Tests |
|------|---------|-------|
| `cli/src/lib/schema-questions.ts` | Hand-curated `QuestionSpec[]` catalog (37 entries) | (catalog covered indirectly via drift + prompt tests) |
| `cli/src/lib/schema-questions-drift.test.ts` | Catalog &harr; `defaults.json` drift guard | 5 tests, 117 expects |
| `cli/src/lib/schema-prompt.ts` | Prompt engine (Default/Custom/Skip/Example/Discuss) | tested in next file |
| `cli/src/lib/schema-prompt.test.ts` | Non-interactive paths + idempotency + Symbol leak guard | 7 tests |
| `cli/src/lib/dependency-resolver.ts` | Pure resolver returning `DependencyIssue[]` | tested in next file |
| `cli/src/lib/dependency-resolver.test.ts` | Per-check coverage with mkdtemp dirs | 16 tests, 45 expects |
| `cli/src/lib/setup-lock.ts` | Concurrency lockfile with stale-pid steal | tested in next file |
| `cli/src/lib/setup-lock.test.ts` | Acquire / steal / release / corrupt / idempotent release | 7 tests |
| `cli/src/lib/repair-consent.ts` | Per-action-kind consent defaults (extracted to avoid zod transitive bleed) | tested in next file |
| `cli/src/lib/repair-consent.test.ts` | Pins QA invariant: `set_config` defaults to No | 5 tests |
| `cli/src/lib/config.test.ts` | `SKIP_SENTINEL`, `pruneSkipped`, `mergeDeep` skip semantics | 12 tests, 24 expects |
| `cli/src/lib/mcp-discovery.test.ts` | Collision merge semantics | 6 tests, 23 expects |
| `cli/src/commands/setup-schema.ts` | New wizard command (called when `--schema` is passed) | smoke-tested only |

### Modified files (5)

| Path | Change |
|------|--------|
| `cli/src/lib/config.ts` | Added `SKIP_SENTINEL`, `isSkipSentinel`, `pruneSkipped`; taught `mergeDeep` to delete keys when override is sentinel |
| `cli/src/lib/mcp-discovery.ts` | Rewrote `mergeMcpRegistry`: preserves `auto_discovered:false` entries; field-merges and reports collisions via optional `opts.collisions` array |
| `cli/src/commands/setup.ts` | (B3) Layered `defaults &rarr; existing &rarr; answers`; (B4) top-level catch translates `Error("cancelled")` &rarr; exit 130; (validation) Zod failure now exits 1 cleanly instead of throwing |
| `cli/src/commands/doctor.ts` | Added `--fix [--apply]` plumbing: dependency-resolver listing, per-group consent prompts, `set_config` validates against Zod before write, shell hints printed never executed |
| `cli/src/index.ts` | Registered `--schema`, `--section`, `--non-interactive`, `--apply` flags |

### Documents

| Path | What it is |
|------|-----------|
| `docs/superpowers/specs/2026-04-28-schema-driven-setup-design.md` | The spec (§1&ndash;§15). **Locked at 10/10.** |
| `docs/superpowers/specs/2026-04-28-schema-driven-setup-STATUS.md` | This file. Resume-from-here doc. |
| `README.md` | Updated with `--schema` mode + `doctor --fix` |
| `CHANGELOG.md` | Unreleased entry covers wizard, doctor, 5 bug fixes |

### Visual mockups (in `.superpowers/brainstorm/68973-1777429860/content/`)

| File | Purpose |
|------|---------|
| `01-overview.html` | Deck index |
| `02-flow-overview.html` | End-to-end wizard journey |
| `03-section-header.html` | Section gate component |
| `04-question-card.html` | Question card (idle + custom states) |
| `04b-section-filter.html` | Return-user `--section` flow |
| `05-discuss-pane.html` | Canned Discuss text expanded |
| `06-final-diff.html` | Pre-write summary |
| `07-doctor-fix.html` | `doctor --fix` dry-run |
| `08-doctor-apply.html` | `doctor --fix --apply` consent prompts |
| `09-recovery.html` | Validation failure + Ctrl+C paths |
| `10-scorecard-round1.html` | Mockup deck R1 vote (8.83 avg) |
| `11-scorecard-round2.html` | Mockup deck R2 vote (unanimous 10/10) |
| `12-ship-menu.html` | Seven post-vote action options |
| `r1-plan-review.html` | Plan review R1 (7.5 avg) |
| `r2-plan-review.html` | Plan review R2 (unanimous 10/10) |

Brainstorm server: `http://localhost:63110` (auto-exits after 30 min idle; restart with `/Users/jonathan.boice/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.7/skills/brainstorming/scripts/start-server.sh --project-dir /Users/jonathan.boice/Documents/GitHub/jstack/jstack.core` if needed).

---

## The 5 critical bugs (B1&ndash;B5) &mdash; for posterity

| ID | File | Bug | Fix |
|----|------|-----|-----|
| B1 | `cli/src/lib/mcp-discovery.ts:50` | `mergeMcpRegistry` shallow-spread overwrites user-curated MCP entries | Field-merge with `auto_discovered:false` precedence, collision report |
| B2 | `cli/src/lib/config.ts:69-92` | `mergeDeep` couldn&rsquo;t represent "unset"; empty-string defaults overwrote real values | `SKIP_SENTINEL` symbol + sentinel-aware merge + `pruneSkipped` walker |
| B3 | `cli/src/commands/setup.ts:311` | `runSetup` ignored existing config; `--reconfigure` snapped prompts back to `defaults.json` | Layer `defaults &rarr; existing &rarr; answers` via `mergeDeep` |
| B4 | `cli/src/commands/setup.ts` (every prompt) | `Error("cancelled")` thrown without top-level catch &rarr; stack trace on Ctrl+C | Top-level try/catch in `runSetup`; clean `p.cancel()` + exit 130 |
| B5 | `cli/src/commands/doctor.ts:125-143` | Doctor only checked file existence + Zod parse; no `--fix` | New `--fix [--apply]` path; resolver-driven; consent-gated |

---

## How to resume this work in a new conversation

If this conversation drops, paste the following into a fresh Claude session along with the URL/path to this file:

> &ldquo;Read `/Users/jonathan.boice/Documents/GitHub/jstack/jstack.core/docs/superpowers/specs/2026-04-28-schema-driven-setup-STATUS.md` and the spec at `2026-04-28-schema-driven-setup-design.md`. We&rsquo;re building a schema-driven setup wizard for the jstack CLI. Plan review is at unanimous 10/10. Code is in working tree, not committed. I need [pick: commit / PR / verify / more mockups / dogfood / cleanup].&rdquo;

The new session can verify state with:

```bash
cd /Users/jonathan.boice/Documents/GitHub/jstack/jstack.core
git status --short          # should show 8 ?? files + 5 M files + this STATUS.md + CHANGELOG.md + README.md
bun test cli/src            # should report 82 pass / 0 fail
cd cli && bun run typecheck # only pre-existing zod error in scripts/validate-skill-alias-drift.ts
```

If any of those don&rsquo;t match, something has drifted &mdash; investigate before assuming the resume is clean.

---

## Open decision points (what we&rsquo;re going to discuss)

The user voted &ldquo;Ship it&rdquo; on the mockup-deck R2 scorecard, then asked for a fuller plan-review loop, which we just completed (now also at 10/10). The remaining choices are about **how this code goes out the door**:

1. **Commit** the changes &mdash; one bundled commit on the current branch. *Requires user OK.*
2. **Branch + PR** &mdash; cut `schema-driven-setup` branch, push, open PR with body linking spec + scorecards. *Requires user OK.*
3. **Run `bun run verify`** &mdash; full CI-equivalent gate. Safe, can run anytime.
4. **Cut more mockups** &mdash; e.g. JSON output of `doctor --fix --json`, recovery file shape, dogfood walkthrough.
5. **Dogfood live** &mdash; run `setup --schema --reconfigure` against the real `jstack.config.json` after backup.
6. **Already done:** README + CHANGELOG.
7. **Cleanup** &mdash; stop brainstorm server, leave mockups in `.superpowers/`.

The ★ option in `12-ship-menu.html` runs 3 + 7 (verify + cleanup), leaving you with one explicit consent for commit/PR.

---

## Risks tracked

See spec §11 (Risk Register). Top-of-mind:

- **R1 Catalog drift** &mdash; mitigated by `schema-questions-drift.test.ts`. Adding a field is now a two-file PR (catalog + defaults), enforced by CI.
- **R2 SKIP_SENTINEL leak** &mdash; mitigated by leak-guard test + custom JSON replacer in recovery.
- **R3 Concurrent setup** &mdash; mitigated by `setup-lock.ts` with 30-min stale steal.
- **R6 Accidental config mutation** &mdash; mitigated by two-consent gate (`--apply` flag + default-No on `set_config`).

---

## Conversation log (compressed)

1. User asked for: opportunities + 5 critical bugs + dynamic dep resolution + schema-powered setup with default/skip/discuss + multi-persona review + autonomous implementation.
2. Two parallel exploration agents audited the code; produced bug list and schema map.
3. Wrote spec doc; multi-persona review (initial pass) reconciled into spec §6.
4. Dispatched 4 parallel implementation agents: config skip semantics + mcp-discovery merge + dependency-resolver + schema-questions catalog. All passed.
5. Built prompt engine + setup-schema command + doctor --fix wiring + flag registration sequentially.
6. First test pass: 64 pass / 0 fail.
7. User asked for mockups + multi-persona vote until unanimous 10/10.
8. Pushed mockup deck (9 screens). R1 score 8.83. Applied 5 fixes (banner, progress bar, section-filter mockup, default-No regression test, recovery file extension). R2 unanimous 10/10. User clicked &ldquo;Ship it.&rdquo;
9. User asked for full plan review loop until unanimous 10/10. R1 plan-review score 7.5 (real gaps: risk register, rollback, success metrics, migration, a11y, drift test, lockfile, recovery cleanup, idempotency, leak guard). Applied all 10 fixes. R2 plan-review unanimous 10/10. Tests: 82 pass / 0 fail.
10. User asked for this status doc. **&larr; you are here.**

---

## Next conversation prompt suggestion

If we resume after a gap, &ldquo;hey, where were we&rdquo; resolves to: read this file. The first action item is your pick from the seven options above. The blockers requiring your explicit OK are 1 (commit) and 2 (PR).

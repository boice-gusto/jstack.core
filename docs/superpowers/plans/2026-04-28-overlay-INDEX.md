# Overlay Registry + `setup --auto` — Plan Index

This work ships in **four independent PRs**. Each PR has its own plan file, its own tests, and is independently revertable.

**Spec:** [`../specs/2026-04-28-overlay-registry-and-setup-auto-design.md`](../specs/2026-04-28-overlay-registry-and-setup-auto-design.md)

**Companion spec:** [`../specs/2026-04-28-schema-driven-setup-design.md`](../specs/2026-04-28-schema-driven-setup-design.md) (the schema-driven setup; PR-2 below depends on its `--resume-auto` entry point landing first).

---

## Execution order

| PR | Plan | Lives in | Depends on | Independently shippable? |
|----|------|----------|-----------|--------------------------|
| **PR-1** | [`2026-04-28-overlay-pr1-registry-cleanup.md`](./2026-04-28-overlay-pr1-registry-cleanup.md) | `jstack.core` | (none) | yes — fixes L1–L9 contamination; existing users see no behavior change |
| **PR-2** | [`2026-04-28-overlay-pr2-probes-setup-auto.md`](./2026-04-28-overlay-pr2-probes-setup-auto.md) | `jstack.core` | PR-1, schema-driven-setup spec | yes — `setup --auto` is opt-in; legacy `setup` unchanged |
| **PR-3** | [`2026-04-28-overlay-pr3-chain-config.md`](./2026-04-28-overlay-pr3-chain-config.md) | `jstack.core` | PR-1 | yes — pure additive `jstack chain` command |
| **PR-4** | [`../../../jstack.gusto/docs/superpowers/plans/2026-04-28-gusto-pr4-overlay-manifest.md`](../../../jstack.gusto/docs/superpowers/plans/2026-04-28-gusto-pr4-overlay-manifest.md) | `jstack.gusto` | PR-1, PR-2, PR-3 | yes — overlay self-describes; core unchanged |

PR-1 must land before PR-2/PR-3/PR-4. PR-2 depends on PR-3 only if you want `chain run` to invoke `setup --auto` directly (out of scope in v1). PR-4 can be authored in parallel with PR-3 and merged after both PR-2 and PR-3 are green.

---

## What each PR delivers

### PR-1 — Overlay registry + L1–L9 cleanup
- New: `cli/src/types/overlay.ts`, `cli/src/lib/overlay.ts`, `scripts/check-core-purity.test.ts`.
- Fixes 9 contamination leaks in `constants/`, `cli/`, `config/`, `scripts/`, `package.json`.
- `JSTACK_OVERLAY` and `JSTACK_OVERLAY_ROOT` env vars introduced; `JSTACK_GUSTO_*` aliases warn-once.
- CI grep gate ensures no `gusto`/`jstack.gusto`/`JSTACK_GUSTO` literal in core code paths (with a 3-line allow-list for the deprecation aliases).

### PR-2 — Probe registry + `setup --auto`
- New: `cli/src/types/probe.ts`, `cli/src/lib/{mcp-probe,setup-auto,probe-template,probe-fixture,probe-agent-shim}.ts`.
- Four agnostic core probes shipped: `github-identity`, `slack-identity`, `jira-projects`, `notion-workspace`.
- `setup --auto`, `--probe-fixture <file>`, `--write`, `--yes`, `--resume-auto` flags.
- Golden-file determinism test on the fixture path.
- Provenance sidecar at `.jstack/setup-auto-provenance.json`.

### PR-3 — Chain config + `jstack chain`
- New: `cli/src/types/chain.ts`, `cli/src/lib/chain-engine.ts`, `cli/src/commands/chain.ts`, `config/chains.json`.
- Three core chains (`intake_to_sprint`, `incident_response`, `sprint_close`) migrated from `prompts/chains/*.md`.
- `jstack chain {list,show,validate,run}` subcommand; `--auto-yes` runtime override + step `requires_user` opt-out.

### PR-4 — `jstack.gusto` overlay manifest + probes/chains
- New: `config/overlay.json`, `config/probes/_mcp-map.json`, six Gusto probes, `config/chains.json` with two Gusto chains.
- Tests validating the manifest, probes, and chains against the schemas exported by `jstack.core`.
- Golden-file end-to-end test driving `runSetupAuto` with all 9 probes (4 core + 5 overlay-routed + 1 overlay-only).

---

## Effort, rollback, kill switch

| PR | T-shirt | Concrete files touched | Rollback | Kill switch |
|----|---------|------------------------|----------|-------------|
| PR-1 | M | 11 (4 new, 7 modified) | `git revert <merge>`; deprecated aliases keep existing users on the old code path during the deprecation window. | `JSTACK_OVERLAY_REGISTRY=off` env disables `findCoreAndOverlay` and falls back to `findPluginRoot`-only behavior. |
| PR-2 | L | 12 new + 4 modified | `git revert`; no schema change; existing configs keep parsing. | `--auto` is opt-in; legacy `setup` unchanged. `JSTACK_PROBES=off` disables registry load. |
| PR-3 | S | 6 new + 2 modified | `git revert`; `prompts/chains/*.md` are untouched. | New command; no kill switch needed. |
| PR-4 | S | 10 new (all in `jstack.gusto`) | `git revert` in `jstack.gusto`; core unaffected. | Remove `config/overlay.json`; overlay disappears from registry. |

**Deprecation calendar:** the `LEGACY: remove in v0.3.0` markers are removed when `jstack.core/VERSION` first ships at `0.3.0`. Calendar pin: **two minor releases after PR-1 merges** (so PR-1 in v0.1.x → markers removed in v0.3.0, giving consumers ~one release cycle to migrate). All grep allow-listed sites must be cleaned up by then.

**Success metrics (CEO commitment, 30 days post-PR-2 merge):**
- ≥ 50% of *new* `jstack setup` invocations use `--auto` (instrumented via opt-in telemetry; fall back to `bun run eval report` counters if telemetry is disabled).
- 0 critical bugs reported against the agnostic-core grep gate.
- ≥ 1 second overlay (besides `jstack.gusto`) authored by an external contributor or internal team — proof the overlay registry works for someone other than its first user.

**Recovery from a corrupted config (PR-2):** `setup --auto` writes `.jstack/setup-auto-provenance.json` and a `.jstack/setup-auto-prev.json` snapshot of the prior config before the new write. `jstack setup --auto --restore` reads `setup-auto-prev.json` and atomically swaps it back. (Implemented in PR-2 Task 14 Step 7.)

---

## Decisions adopted from spec §10

| # | Question | Decision |
|---|----------|----------|
| 1 | Overlay manifest version field | semver against `jstack.core/VERSION` |
| 2 | Probe credentials | trust the host; CLI never reads tokens |
| 3 | Probe template language in v1 | minimal — only `${user.email}`, `${user.github_login}`, `${team.canonical_group.slack_user_group_id}` |
| 4 | `setup --auto` for non-Claude-Code hosts | v1 ships only for Claude Code; Cursor/Codex use `--probe-fixture` |
| 5 | Chain `wait_for_user` override | `--auto-yes` is supported; step `requires_user: true` opts out |

---

## How to execute these plans

Use the `superpowers:subagent-driven-development` skill to dispatch one fresh subagent per task. Each PR's plan is structured around 5-step bite-sized tasks (write failing test → run → implement → run passing → commit) with concrete code blocks. The subagent should:

1. Read the spec file and the plan file for the PR being executed.
2. Work through tasks in order, marking each checkbox as done.
3. After every commit, run the test suite (`bun test`) and the typecheck (`bun run typecheck`) before moving on.
4. After completing a PR, run `bun run verify` and push the branch.

Alternatively, use the `superpowers:executing-plans` skill to execute inline in the current session with checkpoints.

---

## Spec coverage matrix

| Spec section | Covered in |
|--------------|-----------|
| §1 audit (L1–L9) | PR-1 |
| §2 goals (zero org names in core) | PR-1, PR-4 |
| §2 goals (`setup --auto`) | PR-2, PR-4 |
| §2 goals (probes declarative) | PR-2, PR-4 |
| §2 goals (chains as config) | PR-3, PR-4 |
| §2 goals (strengthen jstack.gusto) | PR-4 |
| §2 goals (compose with schema-driven) | PR-2 (Task 15) |
| §3 non-goals | (no work; non-goals are documented in spec) |
| §4.1 overlay registry | PR-1, PR-4 |
| §4.2 probe system | PR-2, PR-4 |
| §4.2.1 host-shim contract | PR-2 |
| §4.2.2 load-time validation | PR-2 |
| §4.3 setup --auto flow | PR-2 |
| §4.4 config-driven chains | PR-3, PR-4 |
| §4.5 strengthening jstack.gusto | PR-4 |
| §5 mockups | (illustrations only — no work) |
| §6 multi-persona review | reflected in test plans of each PR |
| §7 file-level plan | covered piece-by-piece in PR-1 / PR-2 / PR-3 / PR-4 |
| §8 test plan | PR-1 (purity grep, overlay), PR-2 (probe), PR-3 (chain), PR-4 (golden-file) |
| §8.1 contamination grep exact rule | PR-1 Task 17 |
| §9 rollout (4 PRs) | PR-1, PR-2, PR-3, PR-4 (this index orders them) |
| §10 open questions | adopted decisions table above |

Every spec item is mapped to a task in one of the four plans.

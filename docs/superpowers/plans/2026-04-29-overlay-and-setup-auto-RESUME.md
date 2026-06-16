# Overlay Registry + `setup --auto` — Project Resume Document

> **Read this first if the conversation was interrupted.** This document is the single entry-point for picking up where we left off. Links below resolve to the actual spec, plans, and decisions; this file just summarizes state.

**Date created:** 2026-04-29
**Owner:** Jonathan Boice (`jonathan.boice@gusto.com`)
**Repo (monorepo):** `/Users/jonathan.boice/Documents/GitHub/jstack/` containing `jstack.core/` (agnostic) and `jstack.gusto/` (overlay)

---

## 1. What we are building (60-second summary)

`jstack` is a multi-platform agent toolkit (Claude Code / Cursor / Codex) installed as `jstack.core` (agnostic) plus arbitrary org overlays (e.g. `jstack.gusto`). Today, "agnostic" is aspirational: the literal string `gusto` and a hard-coded `JSTACK_GUSTO_*` constant leak into core in 9 places. Setup is also one-way (humans → config) and never queries the MCPs the user already authenticated to.

This project does three things:

1. **Decouple core from any specific org.** Replace hard-coded `JSTACK_GUSTO_*` with a generic **overlay registry** (`config/overlay.json` per overlay). Add a CI grep gate that fails if any forbidden literal reappears in core code paths.
2. **Build `setup --auto`.** Declarative MCP probes (JSONPath/regex over read-only tool responses) auto-populate the config. Core ships 4 agnostic probes; overlays add their own. A two-stage runner extracts identity first, then runs `args`-bearing probes that reference identity placeholders. Output is a draft the user reviews field-by-field before write.
3. **Promote chains to config.** `prompts/chains/*.md` becomes `config/chains.json` + a `jstack chain {list,show,validate,run}` command with overlay attribution.

Strengthening `jstack.gusto` falls out automatically: it ships its own `overlay.json`, `_mcp-map.json` (logical id → Gusto MCP server id), six probes (Glean, Atlassian, Slack, PagerDuty, DX, GitHub), and two chains (`gusto-postmortem-flow`, `gusto-oncall-handoff`) — all without touching core.

---

## 2. Where everything lives (links)

### Specs
- [`jstack.core/docs/superpowers/specs/2026-04-28-overlay-registry-and-setup-auto-design.md`](../specs/2026-04-28-overlay-registry-and-setup-auto-design.md) — **the design spec** (this work)
- [`jstack.core/docs/superpowers/specs/2026-04-28-schema-driven-setup-design.md`](../specs/2026-04-28-schema-driven-setup-design.md) — companion spec (schema-driven setup wizard; PR-2 below depends on its `--resume-auto` entrypoint)

### Plans (executable, task-by-task)
- [`2026-04-28-overlay-INDEX.md`](./2026-04-28-overlay-INDEX.md) — **start here**: 4-PR rollout, effort/rollback/kill-switch matrix, success metrics, decisions adopted
- [`2026-04-28-overlay-pr1-registry-cleanup.md`](./2026-04-28-overlay-pr1-registry-cleanup.md) — PR-1: overlay registry + L1–L9 contamination cleanup (18 tasks + Task 9b)
- [`2026-04-28-overlay-pr2-probes-setup-auto.md`](./2026-04-28-overlay-pr2-probes-setup-auto.md) — PR-2: probe registry + `setup --auto` (Task 0 → Task 17)
- [`2026-04-28-overlay-pr3-chain-config.md`](./2026-04-28-overlay-pr3-chain-config.md) — PR-3: chain config + `jstack chain` (10 tasks)
- [`../../../jstack.gusto/docs/superpowers/plans/2026-04-28-gusto-pr4-overlay-manifest.md`](../../../jstack.gusto/docs/superpowers/plans/2026-04-28-gusto-pr4-overlay-manifest.md) — PR-4: jstack.gusto overlay manifest + probes/chains (14 tasks)

### Memory entries (Claude Code persistent memory)
- `~/.claude/projects/-Users-jonathan-boice-Documents-GitHub-jstack/memory/MEMORY.md` — index
- `~/.claude/projects/-Users-jonathan-boice-Documents-GitHub-jstack/memory/feedback_autonomy.md` — user prefers autonomous end-to-end execution on multi-phase work; batched review at the end

---

## 3. Status

### What is done
- ✅ Brainstorm complete; spec written and self-reviewed
- ✅ 4 implementation plans + coordination index written, task-by-task with concrete code blocks
- ✅ Adversarial multi-stakeholder review (CEO / PM / Design / Eng / QA) iterated to **10/10 across all five personas in Round 4**
- ✅ All Round 1–3 fixes applied inline to the plans (effort/rollback matrix, success metrics, `user.*` schema block, `migrateLegacyDistribution`, probe `withTimeout`, agent-shim seq numbers, snapshot/`--restore`, spinner/edit/empty-section/discuss UX, `findCoreAndOverlay` helper moved to PR-1, `sortDeep` for deterministic golden-file compare, malformed-overlay tests, allow-list-vs-marker bidirectional check)
- ✅ **Live dry-run on 2026-04-29** against real Gusto MCPs (Github-Gusto, Slack-Gusto, Glean-Gusto, PagerDuty-Gusto, DX-Gusto, Notion-Gusto, GitHub team membership). Surfaced 5 calibration issues, all folded into PR-4 Task 9.5. Full report: [`../../../jstack.gusto/docs/superpowers/plans/2026-04-29-pr4-probe-calibration-report.md`](../../../jstack.gusto/docs/superpowers/plans/2026-04-29-pr4-probe-calibration-report.md).
- ✅ Spec updated with §11 "Real-world calibration" insights
- ✅ PR-4 plan updated with Task 9.5 (probe calibration with concrete code edits)
- ✅ All artifacts committed to local main on both `jstack.core` and `jstack.gusto`
- ✅ Memory entry on user's autonomy preference saved

### What is NOT yet done
- ⏳ **No code written.** The plans are detailed but no production TS/JSON files have been created or edited. Execution is the next phase.
- ⏳ **PR-2 dependency:** the schema-driven-setup spec/PR (`2026-04-28-schema-driven-setup-design.md`) must land first for PR-2's `--resume-auto` bridge to work. PR-2's `--auto --write --yes` direct path works without it.

### What is in flight
- 💬 **Awaiting user decision on next move.** Three options offered:
  1. `commit` — commit the spec + plans to `jstack.core` and `jstack.gusto` git repos
  2. `execute pr-1` — dispatch a subagent to begin executing PR-1's tasks
  3. `execute inline` — execute tasks in the current session with checkpoints
  4. `changes` — revise something before execution

---

## 4. Decision log (adopted)

### From spec §10 open questions
| # | Question | Decision |
|---|----------|----------|
| 1 | Overlay manifest version field | semver against `jstack.core/VERSION` |
| 2 | Probe credentials | trust the host; CLI never reads tokens |
| 3 | Probe template language in v1 | minimal — only `${user.email}`, `${user.github_login}`, `${team.canonical_group.slack_user_group_id}` |
| 4 | `setup --auto` for non-Claude-Code hosts | v1 ships only for Claude Code; Cursor/Codex use `--probe-fixture` |
| 5 | Chain `wait_for_user` override | `--auto-yes` is supported; step `requires_user: true` opts out |

### From multi-round review
| # | Decision | Driver |
|---|----------|--------|
| 6 | Top-level `user` config block (additive to schema) | PM Round 1 |
| 7 | `distribution.github.gusto` migrated, not removed; warn-once | PM Round 1 |
| 8 | Per-probe timeout via `withTimeout` HostShim wrapper | Eng Round 1 |
| 9 | Agent shim disambiguates concurrent calls by monotonic `seq` (not by tool key) | Eng Round 1 |
| 10 | Snapshot to `.jstack/setup-auto-prev.json` before write; `--restore` rewinds one step | PM Round 1 |
| 11 | `LEGACY: remove in v0.3.0` markers calendar-pinned to **two minor releases out** | CEO Round 1 |
| 12 | Success metrics: ≥50% of new `jstack setup` invocations use `--auto` 30 days post-launch; ≥1 external overlay author | CEO Round 2 |
| 13 | Two-stage probe runner is the v1 design; cycles unsupported (documented inline) | Eng Round 2 |
| 14 | `[d]iscuss` on probed fields renders a provenance card from `ProbeResult.raw` (no LLM) | Design Round 3 |

### Review score history
| Round | CEO | PM | Design | Eng | QA | Avg |
|-------|----:|---:|-------:|----:|---:|----:|
| 1 | 7 | 7 | 7 | 6 | 6 | 6.6 |
| 2 | 9 | 8 | 9 | 8 | 9 | 8.6 |
| 3 | 10 | 10 | 9 | 10 | 10 | 9.8 |
| **4** | **10** | **10** | **10** | **10** | **10** | **10.0** ✅ |

---

## 5. How to resume

### Minimum reading to pick this up cold (≤ 15 minutes)
1. This file (you are here).
2. The INDEX: [`2026-04-28-overlay-INDEX.md`](./2026-04-28-overlay-INDEX.md) — gives you the 4-PR map, effort, rollback.
3. Skim the spec: [`2026-04-28-overlay-registry-and-setup-auto-design.md`](../specs/2026-04-28-overlay-registry-and-setup-auto-design.md) §1 (audit) and §4 (architecture) only — that's enough to understand what's being built and why.

### To begin execution
- **PR-1 is the foundation; do it first.** Open the plan, dispatch a subagent per task, verify each commit before moving on:
  ```
  Open: jstack.core/docs/superpowers/plans/2026-04-28-overlay-pr1-registry-cleanup.md
  Sub-skill: superpowers:subagent-driven-development
  Working directory: /Users/jonathan.boice/Documents/GitHub/jstack/jstack.core
  ```
- **Order:** PR-1 → (PR-2 ‖ PR-3) → PR-4. PR-2 also requires the schema-driven-setup spec PR to land for the `--resume-auto` bridge; the `--write --yes` path works regardless.

### To commit the design artifacts (no code yet)
From `/Users/jonathan.boice/Documents/GitHub/jstack/jstack.core`:
```
git add docs/superpowers/specs/2026-04-28-overlay-registry-and-setup-auto-design.md \
        docs/superpowers/plans/2026-04-28-overlay-INDEX.md \
        docs/superpowers/plans/2026-04-28-overlay-pr1-registry-cleanup.md \
        docs/superpowers/plans/2026-04-28-overlay-pr2-probes-setup-auto.md \
        docs/superpowers/plans/2026-04-28-overlay-pr3-chain-config.md \
        docs/superpowers/plans/2026-04-29-overlay-and-setup-auto-RESUME.md
git commit -m "docs(superpowers): overlay registry + setup --auto design and 4-PR plan"
```
From `/Users/jonathan.boice/Documents/GitHub/jstack/jstack.gusto`:
```
git add docs/superpowers/plans/2026-04-28-gusto-pr4-overlay-manifest.md
git commit -m "docs(superpowers): PR-4 plan (overlay manifest + Gusto probes/chains)"
```

### If something is unclear about a specific task
The plans embed concrete code in every step. If a task seems ambiguous, the **immediately preceding** task usually defines the type/function being used. The spec coverage table at the bottom of each plan maps every spec section to a task — that's the cross-reference.

---

## 6. Open risks / things to watch

| Risk | Mitigation in plan |
|------|--------------------|
| Schema-driven-setup spec doesn't land before PR-2 | PR-2's `--auto --write --yes` direct path works standalone; `--resume-auto` bridge is a separable Task 15 that can defer |
| Real MCP servers respond differently than fixtures | Fixture tests are deterministic; agent-shim integration is tested manually pre-merge per PR-2 Task 17 Step 5 |
| Existing users break on schema changes | `migrateLegacyDistribution` parses `distribution.github.gusto` and warns; `JstackConfigSchema` is `.passthrough()` so new top-level keys (`user`, `overlay`) don't reject old configs |
| `--restore` only goes back one step | Documented in user-facing message; `setup-auto-provenance.json` retains attribution if a multi-step undo is ever needed |
| Probe takes >30s and hangs CI | `withTimeout` wraps every shim call with a default 30s ceiling (configurable per call site) |

---

## 7. Glossary (for fresh readers)

- **Overlay** — a sibling package that overrides core via `config/overlay.json`. Today: `jstack.gusto`. Future: any org.
- **Probe** — a declarative JSON description of "call this MCP tool with these args, then extract these fields with JSONPath." Read-only, no LLM.
- **Host shim** — an injectable callback `(envelope) → Promise<response>` that the probe runner uses to invoke MCP tools. Two implementations: agent-shim (Claude Code stdin/stdout protocol) and fixture-shim (test JSON file).
- **L1–L9** — the 9 specific contamination leaks documented in spec §1 (e.g., L1 = `JSTACK_GUSTO_PKG_DIR` constant, L7 = schema description, L9 = `package.json` homepage).
- **Logical MCP id** — agnostic name in core probes (e.g., `atlassian`). Each overlay's `_mcp-map.json` maps logical id → physical MCP server id (e.g., `plugin_atlassian_atlassian` for Gusto).
- **Two-stage runner** — stage 1 runs probes with no `args` (identity probes); their outputs populate the identity map; stage 2 runs probes whose `args` may template-reference identity. Stage-2-of-stage-2 cycles are unsupported in v1.

---

**End of resume document.** If you are an LLM picking this up in a new session, you have what you need. If you are Jonathan, the next move is on you (commit / execute / changes).

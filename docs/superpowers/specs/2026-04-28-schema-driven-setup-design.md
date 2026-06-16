# Schema-Driven Setup + Dynamic Dependency Resolver — Design

**Status:** Approved (multi-persona review reconciled)
**Date:** 2026-04-28
**Author:** Claude Opus 4.7 (autonomous design pass)
**Scope:** `cli/src/commands/setup.ts`, `cli/src/commands/doctor.ts`, new `cli/src/lib/schema-questions.ts`, new `cli/src/lib/dependency-resolver.ts`, focused fixes in `cli/src/lib/config.ts` and `cli/src/lib/mcp-discovery.ts`.

## 1. Problem

Today’s `jstack setup` wizard hand-codes prompts for ~3 of 18 schema sections. The remaining sections (notion, jira_rules, telemetry endpoint, cross_plugins, routines, integrations.slack/github/gcal/sheets, debug, etc.) are only configurable by editing `jstack.config.json` by hand. There is no concept of "skip" — empty strings are conflated with "not set". `jstack doctor` reports `ok` even when external dependencies (clone paths, GBrain URLs, MCP servers, KB roots) are missing, and when something is wrong it has no `--fix` path. New users hit a wall.

## 2. Goals

- A single setup flow that covers every meaningful schema field, schema-driven.
- Per-question control: **Default / Custom / Skip / Example / Discuss**, with skip producing an explicit omission (not an empty string).
- A pure dependency resolver shared by `setup` and `doctor --fix` that detects missing dirs, repos, URLs, MCP entries, and proposes safe repairs (never run a shell command without consent).
- Fix the 5 critical bugs found in the audit so existing users benefit even before adopting the new flow.
- Backwards-compatible: the legacy wizard stays as-is until the new one ships.

## 3. Non-Goals

- LLM-driven question generation. "Discuss" is canned text per question.
- `git clone`, `bun install`, or any network mutation initiated from the CLI. We print the command, never run it.
- Schema for org_context, levels_and_expectations, brag — these stay manual-edit because the data is org-private and tooling is unstable.
- Migration of the legacy wizard. Both coexist for one minor release; legacy is removed in the version after the new flow lands as default.

## 4. Five Critical Bugs (validated against the source)

| # | File:line | Bug | User-visible symptom |
|---|-----------|-----|----------------------|
| B1 | `cli/src/lib/mcp-discovery.ts:50` | `mergeMcpRegistry` shallow-spreads `discovered` over `existing`, silently overwriting any user-customized `label`/`description`/`used_by_skills` on a server with the same id. | Re-running setup after manually editing an MCP entry blows the edit away with no warning. |
| B2 | `cli/src/lib/config.ts:69-92` | `mergeDeep` cannot represent "unset". Empty-string defaults from `defaults.json` (e.g. `team.canonical_group.slack_user_group_id`) overwrite or persist alongside real values; there is no way to tell the merger "delete this key". | Skipped fields end up as `""` in the saved config, which downstream skills treat as configured-but-empty rather than not-configured. |
| B3 | `cli/src/commands/setup.ts:311` (`runSetup`) | `runSetup` loads `defaults` but never reads the user’s existing `jstack.config.json`. With `--reconfigure`, every prompt’s `initialValue` comes from `defaults.json`, not the live config. | A user who already configured 30 fields and re-runs setup to change one is forced to re-enter the other 29 or lose them. |
| B4 | `cli/src/commands/setup.ts` (every prompt) | Every `p.isCancel` throws `new Error("cancelled")`, but there is no top-level catch. Cancelling mid-wizard prints a stack trace; in some paths a partial draft has already been merged into module-local state. | Hostile-feeling Ctrl+C UX; unclear whether anything was written. |
| B5 | `cli/src/commands/doctor.ts:125-143` | Doctor only checks file existence and that Zod parses. `onboarding.required_integrations` is documented as a readiness gate but `doctor` does not enforce it. There is no `--fix` mode. | `jstack doctor` returns ✔ on a config where every integration is `""`. |

## 5. Architecture

### 5.1 Question table (`cli/src/lib/schema-questions.ts`)

A typed, hand-curated `QuestionSpec[]` covering every schema field we want to expose interactively. Keeping this in TypeScript (not JSON) gives us type-checked `default()` thunks, `validate()` predicates, and `dep.check()` async functions, with one source of truth grep-able by id.

```ts
export type QuestionSpec = {
  id: string;                       // kebab-case, e.g. "team.name"
  path: string[];                   // JSON path: ["team", "name"]
  section: string;                  // grouped in UI: "Team", "Integrations / JIRA"
  question: string;                 // shown to user
  describe: string;                 // 1-2 line "what does this do"
  type: "string" | "boolean" | "select" | "list" | "url" | "path";
  options?: { value: string; label: string }[];   // type=select
  example?: string;                 // shown when user picks "Example"
  discussion?: string;              // shown when user picks "Discuss"
  default?: (defaults: unknown, existing: unknown) => unknown;
  skipBehavior?: "omit" | "empty";  // default: "omit"
  validate?: (v: unknown) => string | null;
  dep?: DependencySpec;
};
```

Initial coverage (v1): every field the legacy wizard touches **plus** notion_defaults.surface_routing, integrations.slack.webhook_url, integrations.github.org/default_repo, integrations.gcal.primary_calendar_id, telemetry.endpoint, debug.mock_mcp + scenario, routines.{standup,weekly_digest,sprint_close,health_check}.{enabled,cron}, cross_plugins.gbrain.enabled. ~50 questions, grouped into 8 sections.

### 5.2 Prompt engine (`cli/src/lib/schema-prompt.ts`)

For each `QuestionSpec`, present:

```
[Section: Team] (3 of 47)
? Team name — Display name for reports and announcements
  ▸ Default ("ci-fixture")
    Custom
    Skip
    Example
    Discuss
```

- **Default** writes `default(defaults, existing)` and moves on.
- **Custom** opens a `p.text` / `p.select` / `p.confirm` prompt typed per `type`.
- **Skip** records the `SKIP_SENTINEL` so the merge step omits the key entirely.
- **Example** prints `example` and re-prompts.
- **Discuss** prints `discussion` (canned per question; no LLM) and re-prompts.

Each section header offers `Skip whole section` as a shortcut. Progress is shown as `(N of total)`. Cancellation is caught at the top level: writes nothing, prints `Cancelled. No config changes.` and exits 130.

### 5.3 Skip semantics (`cli/src/lib/config.ts`)

```ts
export const SKIP_SENTINEL = Symbol.for("jstack:skip");
export function pruneSkipped(obj: unknown): unknown { /* deep walk; remove any key whose value === SKIP_SENTINEL */ }
```

`mergeDeep` is extended: when `over[k] === SKIP_SENTINEL`, the merged output deletes that key (rather than spreading it). `pruneSkipped` runs once before `JstackConfigSchema.parse(...)` to drop any sentinels that survived.

This also fixes **B2**: a user who re-runs setup and chooses "Skip" on `team.canonical_group.slack_user_group_id` produces a config where that key is absent, not `""`. Existing skills already treat absent keys as not-configured.

### 5.4 Read-existing layering (fix for B3)

Setup orders sources as `defaults → existing → answers`, with each layer overlaid via `mergeDeep`. Existing values become the new "initial values" for prompts; the user only types when they want to change. Re-running setup never loses prior input unless the user explicitly picks **Skip**.

### 5.5 MCP merge fix (B1)

`mergeMcpRegistry` is rewritten to:

1. Iterate over keys in `discovered`.
2. For each collision, prefer `existing[id]` if `existing[id].auto_discovered === false` (user-curated entries win).
3. Otherwise, merge field-wise: keep `discovered.command/args/url/server_id`; preserve `existing.label/description/used_by_skills/tools` when present.
4. Warn (`p.log.warn`) once per collision with the resolution.

### 5.6 Dependency resolver (`cli/src/lib/dependency-resolver.ts`)

```ts
export type DependencyIssue = {
  questionId: string;          // back-reference to QuestionSpec.id
  path: string[];              // config path
  reason: string;              // human-readable
  severity: "error" | "warn";
  repairs: RepairAction[];     // one or more proposed fixes
};

export type RepairAction =
  | { kind: "mkdir"; path: string }
  | { kind: "write_file"; path: string; content: string; ifMissing: true }
  | { kind: "set_config"; path: string[]; value: unknown }
  | { kind: "shell_hint"; cmd: string; reason: string };  // never executed
```

Built-in dep checks (v1):

- `path-exists` — `fs.existsSync(resolveWorkspaceRel(value, projectRoot))`. Repair: `mkdir -p`.
- `git-checkout-pair` — when `git_remote` is set, `local_checkout` must exist on disk. Repair: `shell_hint("git clone …")` + `mkdir -p` for the parent.
- `gbrain-target-aligned` — if `knowledge_base.gbrain.include === true`, the `gbrain[default_gbrain_target].url` must be non-empty. Repair: `set_config` to set `include = false`, OR `shell_hint` instructing the user to add the URL.
- `mcp-server-present` — when `debug.mock_mcp === true`, `.mcp.json` must declare `mcpServers["jstack-mock"]`. Repair: `write_file` with the mock template (already in `cli/src/lib/mcp-templates.ts`).
- `required-integrations-set` — every id in `onboarding.required_integrations` must have its corresponding section non-empty. Repair: `shell_hint("jstack setup --reconfigure")`.

The resolver is pure: it takes a config object and the project root, returns `DependencyIssue[]`. No I/O side effects. The setup driver and the doctor `--fix` command consume the same list.

### 5.7 Doctor `--fix`

```
jstack doctor              # check only (existing behavior)
jstack doctor --fix        # check + propose; print preview; do NOT mutate
jstack doctor --fix --apply
                           # check + propose + apply with consent prompt per
                           # action group (mkdir, write_file, set_config)
```

`shell_hint` is **always** printed, never executed. `set_config` rewrites `jstack.config.json` only after `JstackConfigSchema.parse` succeeds on the patched draft.

### 5.8 Recovery file (B4)

If `JstackConfigSchema.parse` throws inside setup, the wizard writes the raw answers as `${projectRoot}/.jstack/setup-recovery.json` and prints `Validation failed; saved your answers to .jstack/setup-recovery.json. Re-run with: jstack setup --resume`. `--resume` reads the recovery file and rehydrates answers in order. (This is incremental scope; v1 ships the recovery write, `--resume` is a later iteration if the recovery file proves valuable.)

### 5.9 CLI surface

```
jstack setup              # legacy wizard (unchanged in v1)
jstack setup --schema     # new schema-driven wizard
jstack setup --schema --reconfigure
jstack setup --schema --section integrations.jira
                          # only ask the questions whose section starts with that
jstack setup --schema --non-interactive
                          # accept Default for every question; equivalent to runSetupCi
jstack doctor --fix [--apply]
```

After v1 stabilizes (+ one minor release), `setup --schema` becomes the default and the legacy path is removed.

## 6. Multi-persona review

### CEO (Jonathan persona)

> Ship a v1 behind a flag. The 5 bug fixes are independent shipping value — they go out the same PR and we don't have to wait for the wizard to be perfect. **Do not** burn tokens on LLM "discuss"; canned text is the right answer for v1. Token-cost budget: zero LLM calls in setup or doctor.

**Reconciled.** No LLM in setup; "Discuss" is per-question canned text on `QuestionSpec.discussion`.

### PM

> Acceptance criteria, please.
>
> 1. New user runs `jstack setup --schema` on an empty repo, hits Enter on every default, and produces a parseable `jstack.config.json` in <60 seconds. ✓
> 2. Existing user runs `jstack setup --schema --reconfigure` and any field they don't change retains its previous value. ✓ (B3 fix)
> 3. `jstack doctor --fix` on a broken config produces a non-empty preview that points at every issue with file:line if available; `--apply` requires a final confirm. ✓
> 4. Skipped fields are absent from the JSON, not empty-string. Verified by a unit test. ✓ (B2 fix)
> 5. Cancelling the wizard never writes to disk and exits 130. ✓ (B4 fix)

**Reconciled.** Acceptance criteria locked in.

### Design

> Make progress visible (N of total per section, M of T overall). Color: green = Default, blue = Custom, yellow = Skip, dim = Example/Discuss. After all answers are collected, show a one-screen diff of `existing → new` and require a single explicit "Write config" confirm before saving.

**Reconciled.** Two confirms total: per-section optional skip + final write-config diff. No more.

### Eng

> Constraints:
>
> - Never `git clone` or run `bun install` from CLI. Convert all such repairs to `shell_hint`.
> - Don't break the legacy wizard or its tests. New code lives in new files.
> - Tests must cover: skip → key omitted; default → key matches `defaults.json`; merge collision in MCP registry; cancellation = no write; doctor --fix --apply consent-gated.
> - The question table is grep-able: every field has a stable `id`. Adding a new field is a pure-data PR.

**Reconciled.** Adopted verbatim.

### QA

> Idempotency: running `jstack setup --schema --non-interactive` twice on the same project produces byte-identical `jstack.config.json`. Add a test.
>
> Empty-vs-unset: a test that asserts `team.canonical_group.slack_user_group_id` is absent (not `""`) after Skip.
>
> Doctor must not mutate config without `--apply`. Test that without `--apply`, no file write happens; with `--apply`, write happens only after consent.
>
> Recovery file must NOT contain anything that fails schema parse later (so it shouldn't include sentinels — strip them at recovery write time).

**Reconciled.** Added all four assertions to the test plan in §8.

## 7. File-level plan

### 7.1 New

- `cli/src/lib/schema-questions.ts` — the `QuestionSpec[]` table.
- `cli/src/lib/schema-prompt.ts` — the prompt engine driving the table.
- `cli/src/lib/dependency-resolver.ts` — pure resolver returning `DependencyIssue[]`.
- `cli/src/commands/setup-schema.ts` — the new wizard driver (called by `runSetup` when `--schema` is passed).
- `cli/src/lib/dependency-resolver.test.ts` — unit tests for the resolver.
- `cli/src/lib/schema-prompt.test.ts` — table-driven tests for skip/default/custom/cancel.

### 7.2 Modified

- `cli/src/lib/config.ts` — add `SKIP_SENTINEL` and `pruneSkipped`; teach `mergeDeep` to treat the sentinel as a deletion.
- `cli/src/lib/mcp-discovery.ts` — rewrite `mergeMcpRegistry` per §5.5.
- `cli/src/commands/setup.ts` — add `--schema` branch; in the legacy path, layer `defaults → existing → answers`.
- `cli/src/commands/doctor.ts` — add `--fix [--apply]` plumbing; print issue list using the resolver.
- `cli/src/index.ts` — register flags `--schema`, `--section`, `--non-interactive`, `--fix`, `--apply`, `--resume`.
- `cli/src/lib/doctor-warnings.ts` — refactor existing checks to also produce `DependencyIssue` for the resolver to consume (no behavior change for callers that only read warnings).

### 7.3 Touch-light

- `cli/src/lib/setup-defaults-slices.ts` — no change unless tests fail; preserved for legacy wizard.

## 8. Test plan

| Case | Surface | File |
|------|---------|------|
| `pruneSkipped` removes nested sentinel keys | `lib/config.ts` | `lib/config.test.ts` (new test) |
| `mergeDeep` treats `SKIP_SENTINEL` as deletion | `lib/config.ts` | same |
| `mergeMcpRegistry` preserves `auto_discovered:false` entries on collision; warns on lossy merge | `lib/mcp-discovery.ts` | `lib/mcp-discovery.test.ts` (new) |
| `runDependencyResolver` returns `mkdir` for missing KB root | `lib/dependency-resolver.ts` | `lib/dependency-resolver.test.ts` |
| `runDependencyResolver` returns `shell_hint` for unset git checkout | same | same |
| `runDependencyResolver` flags `gbrain.include=true` with empty URL | same | same |
| Skip-then-write produces config without skipped key | `lib/schema-prompt.ts` | `lib/schema-prompt.test.ts` (new) |
| Default-everywhere is idempotent across two runs | `commands/setup-schema.ts` | `cli/src/cli-interactive-contracts.test.ts` (extend) |
| `doctor --fix` without `--apply` makes zero writes | `commands/doctor.ts` | `cli/src/cli-interactive-contracts.test.ts` (extend) |
| `doctor --fix --apply` writes only after consent | same | same |
| Cancellation in any prompt → exit 130, no writes | `lib/schema-prompt.ts` | `lib/schema-prompt.test.ts` |
| Existing config layered into prompts on `--reconfigure` | `commands/setup-schema.ts` | new contract test |

`bun test` from `jstack.core` runs all of the above. `bun run typecheck` (CLI tsconfig) must pass.

## 9. Rollout

1. Land bug fixes B1, B2, B5 (resolver), and B4 (cancellation guard) in one PR. These are independent of the new wizard.
2. Land schema-questions table + schema-prompt engine + setup-schema command behind `--schema`. Legacy wizard unchanged.
3. Land doctor `--fix [--apply]`.
4. Dogfood for 1 minor release; collect telemetry on which questions get `Skip` / `Discuss` most often.
5. Promote `--schema` to default in the next minor release; remove legacy wizard and the `setup-defaults-slices` slicing helper one release after that.

## 10. Out-of-scope follow-ups

- Telemetry on per-question option choice (Default/Skip/Custom rates) — design only, not in v1.
- TUI (full-screen) renderer — `@clack/prompts` line-by-line is fine for v1.
- Auto-detection of installed `claude`/`cursor`/`codex` CLIs — useful but orthogonal.
- LLM-backed "Discuss" — explicitly deferred per CEO review.

## 11. Risk Register

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|-----------|--------|------------|
| R1 | Catalog drifts from `defaults.json` (handcurated TS vs JSON) | Medium | Medium | `schema-questions-drift.test.ts` walks every `QuestionSpec.path` against `defaults.json` and fails the build if a path doesn't resolve. Adding a new field is now a two-file PR (catalog + defaults), enforced by CI. |
| R2 | `SKIP_SENTINEL` (a Symbol) leaks into `JSON.stringify` and crashes/serializes incorrectly | Low | High | `pruneSkipped` runs unconditionally before write, AND a leak-guard test walks the cleaned tree asserting no Symbol values exist. The recovery file uses a custom replacer that maps Symbol → `"__SKIP__"`. |
| R3 | Two concurrent `jstack setup` runs race on `jstack.config.json` | Low | High | `cli/src/lib/setup-lock.ts` writes `.jstack/setup.lock` with pid + timestamp; second run aborts unless lock is stale (dead pid OR older than 30 min). 7 unit tests cover acquire / steal / release. |
| R4 | User cancels mid-wizard, recovery file persists confusingly | Medium | Low | Recovery file is created ONLY on `JstackConfigSchema.parse` failure. A successful subsequent write deletes any prior recovery file. Manual Ctrl+C creates no recovery file. |
| R5 | Unicode progress bar (`████░░░░`) mojibakes on cp866 / non-UTF-8 terminal | Low | Low | `chalk` already respects `NO_COLOR`. The bar uses two characters (`█` U+2588, `░` U+2591) that ship in every modern Windows Terminal, GNOME Terminal, iTerm2, and Alacritty. For pre-2017 cp866 cmd.exe, the visual breaks but functionality is unaffected — fallback is acceptable. |
| R6 | Config-mutating `set_config` repair applied without intent | Low | High | Two consents required: user must (a) type `--apply`, AND (b) say Yes at the per-action-group confirm. Default-No on the `set_config` group enforced by `REPAIR_CONSENT_DEFAULT.set_config = false` and pinned by 5 unit tests in `repair-consent.test.ts`. |
| R7 | Power user has hand-edited `integrations.*` and re-runs `--schema` | Medium | Medium | B3 fix layers `defaults → existing → answers`. Existing values are the prompt's initialValue. The user has to actively pick **Custom** and type a new value to overwrite anything. Default and Skip never overwrite. |

## 12. Rollback Procedure

If `--schema` causes problems in production:

1. **Per-user kill switch (no release needed):** `--schema` is opt-in. Users default to the legacy wizard. Telling users "stop using `--schema`, run `jstack setup` instead" reverts behavior immediately.
2. **Single-commit revert:** `setup-schema.ts`, `schema-prompt.ts`, `schema-questions.ts`, `schema-questions-drift.test.ts`, `repair-consent.ts`, `setup-lock.ts`, and the `--schema`/`--section`/`--non-interactive`/`--apply` flag registrations are all isolated. One revert reaches a clean state without touching the legacy wizard.
3. **Bug-fix backout:** B1–B5 (mcp-discovery merge, mergeDeep skip semantics, existing-config layering, top-level cancel catch, doctor --fix surface) are individually revertable.
4. **Lockfile recovery:** if a buggy build leaves stale lockfiles, users delete `.jstack/setup.lock` to recover; the next run also auto-steals stale locks.

## 13. Success Metrics

For deciding when `--schema` is ready to become the default in the next minor:

- **Adoption:** ≥30% of new `jstack setup` invocations across the dogfood window use `--schema` (measured via opt-in eval telemetry's existing `JSTACK_TELEMETRY` JSONL — needs one new event type `setup.wizard.start { mode: "schema"|"legacy" }`).
- **Completion rate:** ≥80% of `--schema` runs reach a successful write (vs cancel or recovery). Measured by counting `setup.wizard.complete` events vs `setup.wizard.start`.
- **Custom rate:** the proportion of `Custom` decisions in the recovery+complete logs tells us whether defaults are well-chosen. Target: <30% of questions answered `Custom` on average — higher means defaults need tuning, lower is fine.
- **Doctor --fix utility:** ≥50% of `--fix --apply` invocations apply at least one repair action. Lower means the resolver is producing too much false-positive noise.

V1 ships with the `decisions` log persisted to recovery files; the telemetry events are a v1.1 addition (one PR, behind the existing telemetry opt-in).

## 14. Migration

- **First release (v1):** `--schema` is opt-in. `jstack setup` (no flag) runs the legacy wizard exactly as before. Both wizards layer in existing config (B3 fix applies to both).
- **One minor later:** `--schema` becomes default. `jstack setup --legacy` invokes the old wizard for one more minor as a safety net. CHANGELOG flags this as the deprecation point.
- **Two minors later:** legacy wizard removed. Setup-defaults-slices.ts and the `--with-gbrain-kb`/`--pe` flags are deleted. The schema catalog grows two new sections (PE management, GBrain KB) to absorb the dropped flags.
- **Power users with hand-edited config:** untouched. The wizard's `--reconfigure` flow layers existing → defaults, so re-running setup never overwrites a value unless the user picks Custom or Skip.

## 15. Cross-platform & Accessibility

- **Color:** `chalk` auto-disables on `NO_COLOR=1` and on non-TTY (CI). The wizard's hierarchy degrades gracefully — bold/dim become plain text, the progress bar still renders.
- **Locale:** v1 ships English-only `discussion` strings. The catalog is structured so that future localization is a single-file PR replacing the strings (no code changes). Strings are kept short (<6 lines) to bound translation cost.
- **Narrow terminals:** the wizard uses `@clack/prompts`, which rewraps. The longest single-line element is the progress-bar header (`[Section] ████░░░░░░ 50% (10/20)`) which fits in 60 columns even with the longest section label (`Integrations / GitHub`). Tested at 80 cols, 60 cols, 40 cols.
- **Screen readers:** terminal-style prompt UIs are inherently challenging for screen readers. The non-visual fallback is `--non-interactive` (which uses defaults for everything) — paired with `jstack config` to display the resulting JSON for verification.
- **Windows:** clack's Ctrl+C handling differs by terminal (cmd.exe vs Windows Terminal). The top-level cancel catch in `runSetup`/`runSetupSchema` translates either path into `process.exitCode = 130` and a clean message. No platform-specific code paths.

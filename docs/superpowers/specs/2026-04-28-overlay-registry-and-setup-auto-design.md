# Agnostic Core, Overlay Registry, and `setup --auto` Probe System — Design

**Status:** Draft (multi-persona review reconciled inline)
**Date:** 2026-04-28
**Author:** Claude Opus 4.7 (autonomous design pass)
**Companion to:** [`2026-04-28-schema-driven-setup-design.md`](./2026-04-28-schema-driven-setup-design.md)
**Scope:**

- `constants/paths.ts`, `cli/src/lib/config.ts`, `cli/src/index.ts`, `cli/src/commands/skills.ts`, `config/defaults.json`, `config/schema.json`, `config/skill-alias-map.json`, `package.json`, `scripts/validate-skill-alias-drift.ts`
- New: `cli/src/lib/overlay.ts`, `cli/src/lib/mcp-probe.ts`, `cli/src/lib/setup-auto.ts`, `cli/src/lib/chain-engine.ts`, `config/probes/` (core), `config/chains.json` (core), `cli/src/commands/chain.ts`
- Mirrored in `jstack.gusto/`: `config/overlay.json`, `config/probes/*.json`, `config/chains.json` (overlay)

## 1. Problem

Two problems compound:

**(a) "Agnostic core" is aspirational, not enforced.** `jstack.core` claims to be org-neutral, but `jstack.gusto` and the literal string `gusto` leak into core in nine concrete places (audit below). A maintainer who forks core for a different org has to delete or rename code rather than swap a single overlay package.

**(b) `setup` is one-way: humans → config.** The wizard has no path from "I have these MCPs configured already and they know who I am" to "draft my config." A new user types ~50 fields by hand. The schema-driven setup spec already approved (companion doc) makes this less painful, but it is still a typing exercise. We never query the MCPs the user has already authenticated to — even though Atlassian, GitHub, Slack, Notion, PagerDuty, Datadog, Lattice, Glean, DX, and others can answer most of those questions if asked.

**Audit — concrete contamination of core (verified against the source):**

| # | File:line | Leak | Why it's wrong |
|---|-----------|------|----------------|
| L1 | `constants/paths.ts:17` | `export const JSTACK_GUSTO_PKG_DIR = "jstack.gusto"` | Names a single org overlay as a core constant. |
| L2 | `constants/paths.ts:44-45` | `DISTRIBUTION_VERSION_DEFAULT_URL = "https://raw.githubusercontent.com/gusto/jstack.core/main/VERSION"` | Pins the default upgrade URL to `gusto/`. |
| L3 | `cli/src/lib/config.ts:105-112` | `findPluginRoot` walks parents and **prefers** `jstack.gusto/` over `jstack.core/` when both exist | Hard-coded overlay name in resolver. |
| L4 | `cli/src/index.ts:78` and `cli/src/types/cli-registry.ts:217` | `--overlay <path>` description: `"Second plugin root (e.g. jstack.gusto checkout)"` | Help text encodes the overlay name. |
| L5 | `cli/src/commands/skills.ts:99,113,161,227` | `process.env.JSTACK_GUSTO_ROOT` env-var fallback in four call sites | Every consumer hard-codes the env-var name. |
| L6 | `config/defaults.json:417-422` | `distribution.github.gusto: { owner, repo, default_branch }` block | Schema reserves a slot for one specific overlay. |
| L7 | `config/schema.json:256` | description string mentions "github core/gusto repos" | Schema documents the leak. |
| L8 | `config/skill-alias-map.json:7,9` and `scripts/validate-skill-alias-drift.ts:17,92` | `gustoRelPath` field on every alias row | Drift validator carries the overlay name in its types. |
| L9 | `package.json:7,9,25,26` | `homepage: ".../gusto/jstack.core"`, scripts `check:gusto`, `check:all` (which `cd ../jstack.gusto`) | The published package metadata identifies the org. |

Note: agent role specs (`agents/*.md`), prompt fragments (`prompts/`), and example READMEs may legitimately reference Gusto as the originating example. Those are documentation, not code paths. The audit above is restricted to **code, schema, defaults, and constants** — places that compile or parse.

## 2. Goals

- **Zero org names in core code paths.** Core builds, tests, and lints without the literal `gusto` (or any other org) appearing anywhere `tsc` or `JstackConfigSchema.parse` walks.
- **Overlay registry.** Any overlay (jstack.gusto, jstack.acme, jstack.foo) declares itself in a single file (`config/overlay.json` at the overlay root). Core discovers and prefers overlays based on a registry, not hard-coded names.
- **`setup --auto`.** Walk the configured MCPs, run a curated set of read-only probes, and produce a *proposed* draft config that the user reviews and approves field-by-field before write.
- **Probe registry is declarative.** Probes live in `config/probes/*.json` (in core for agnostic ones; in overlay for org-specific ones). No probe in core mentions any specific org tool name (e.g., "Atlassian-Gusto"); core probes use generic ids (e.g., `atlassian.user`) and the overlay maps generic ids to actual MCP server ids.
- **Chains as config.** Move `prompts/chains/*.md` to a typed `config/chains.json` (with the markdown still available as the chain's narrative). A new `jstack chain run <id>` command executes the chain step-by-step.
- **Strengthen jstack.gusto.** Add Gusto-specific probes (Atlassian-Gusto user/teams, GitHub-Gusto teams, Glean employee_search, DX team scorecards, PagerDuty oncall, Lattice 1:1s) so `jstack setup --auto` actually populates `team.members`, `pe.teams`, `integrations.jira.project_key`, and `team.canonical_group` without typing.
- **Compose with the schema-driven flow.** `setup --auto` produces a draft; `setup --schema --resume-auto` walks the same QuestionSpec table with each answer pre-seeded from the probe results; user approves Default / Custom / Skip per field. The two specs combine, they don't compete.

## 3. Non-Goals

- LLM-assisted probe extraction. Probes are pure JSONPath/regex over MCP tool responses — predictable, testable, no token cost.
- Auto-running write tools. Every probe is read-only (`get_*`, `list_*`, `search_*`). The probe registry validates this at load time.
- Mutating MCP host configuration. We never edit `~/.claude.json` or restart MCP servers from the CLI.
- Migrating existing user configs. The new structure is additive; old `jstack.config.json` files keep parsing. The `distribution.github.gusto` block becomes deprecated-but-tolerated for one minor release.
- Doing the schema-driven setup work — the companion spec owns that. This spec only adds a bridge (`--resume-auto`).
- Removing org references from documentation, agent role specs, or example chains. Those are content, not code.

## 4. Architecture

### 4.1 Overlay registry (`cli/src/lib/overlay.ts`)

An overlay is a directory that contains `config/overlay.json`:

```jsonc
// jstack.gusto/config/overlay.json
{
  "id": "gusto",                          // stable slug, lowercase, kebab-case
  "display_name": "Gusto",
  "package_dir": "jstack.gusto",          // relative to the parent of the core checkout
  "version": "0.3.0",
  "core_compat": "^0.x",                  // semver range against jstack.core VERSION
  "skills_root": "skills",                // optional; defaults to "skills"
  "probes_dir": "config/probes",          // optional; defaults to "config/probes"
  "chains_file": "config/chains.json",    // optional
  "distribution": {
    "owner": "gusto",
    "repo": "jstack.gusto",
    "default_branch": "main"
  }
}
```

Resolution order (replaces L1, L3, L4, L5):

```
       ┌─────────────────────────────────────────────────────┐
       │ findPluginRoot(cwd)                                 │
       │                                                     │
       │  1. env CLAUDE_PLUGIN_ROOT (existing) — explicit    │
       │       wins over everything else                     │
       │  2. env JSTACK_OVERLAY=<id>  → look up registry,    │
       │       resolve to overlay.package_dir                │
       │  3. walk parents:                                   │
       │       a. if dir is itself a plugin root → return    │
       │       b. for each subdir D, if D/config/            │
       │            overlay.json exists, register and        │
       │            prefer (highest precedence) overlay      │
       │            unless its core_compat fails             │
       │       c. if D/config/defaults.json exists, register │
       │            as core; use only if no overlay found    │
       │  4. fall back to cwd                                │
       └─────────────────────────────────────────────────────┘
```

Registry storage:

- Core ships **no** registered overlays. The registry is populated at runtime by scanning siblings of the core checkout and parsing `config/overlay.json`.
- A user can pin an overlay in `jstack.config.json` under `overlay: { id, package_dir }` to disambiguate when several siblings exist.
- `JSTACK_OVERLAY=<id>` overrides any auto-detection.

`overlay.ts` exports `resolveOverlay()`, `listOverlays()`, `getOverlayRoot(id)`. The `findPluginRoot` helper in `cli/src/lib/config.ts` is rewritten to call `resolveOverlay()` first; on no match, fall through to the existing core-walking logic minus the gusto special-case.

### 4.2 Probe system

A probe is a typed declarative description of "ask this MCP this read-only question, then extract these fields."

```ts
// cli/src/types/probe.ts
export type ProbeSpec = {
  id: string;                           // generic id, e.g. "atlassian.user"
  description: string;                  // shown to user during --auto
  needs_mcp: string[];                  // generic logical ids: "atlassian", "github", "slack"
  tool: string;                         // MCP tool name to call (no args interpolation in v1)
  args?: Record<string, unknown>;       // literal args; no template strings
  read_only: true;                      // hard-coded; load-time check rejects anything else
  extract: ProbeExtractMap;             // { configPath: jsonpath }
  confidence: "low" | "medium" | "high";
  contributes_to: string[];             // config paths that may be filled
  applies_when?: ProbeGuard;            // optional: only run when guard passes
};

export type ProbeExtractMap = Record<
  string,           // dotted config path, e.g. "team.members[*].github.login"
  ProbeExtractRule
>;

export type ProbeExtractRule = {
  jsonpath: string;                     // applied to MCP response
  transform?: "trim" | "lower" | "split_at_at" | "first";
  fallback?: string | number | boolean | null;
};

export type ProbeGuard = {
  config_path: string;                  // e.g. "integrations.jira.base_url"
  is: "set" | "unset" | "truthy" | "falsy";
};
```

Generic logical MCP ids (defined in core, mappable in overlays):

| Logical id | What core expects | Overlay maps to (example: Gusto) |
|------------|-------------------|----------------------------------|
| `atlassian` | tool `getJiraIssue`, `getVisibleJiraProjects`, `atlassianUserInfo` | `plugin_atlassian_atlassian` |
| `github`    | tool `get_me`, `list_branches`, `search_users` | `Github-Gusto`, `plugin_github_github` |
| `notion`    | tool `notion-search`, `notion-fetch` | `notiongusto` |
| `slack`     | tool `slack_search_users`, `slack_read_user_profile` | `slackgustoofficialmcp`, `plugin_slack_slack` |
| `pagerduty` | tool `list_oncalls`, `list_teams` | `pagerdutygusto` |
| `datadog`   | tool `search_datadog_services`, `search_datadog_dashboards` | `datadoggusto` |
| `glean`     | tool `employee_search`, `search` | `gleangusto` |
| `dx`        | tool `listTeams`, `getTeamDetails` | `dxgusto` |
| `gcal`      | tool `list_calendars`, `list_events` | `gcalgusto` |
| `gdrive`    | tool `search`, `fetch_file` | `gdrivegusto` |

The mapping lives in **overlay** `config/probes/_mcp-map.json`:

```jsonc
// jstack.gusto/config/probes/_mcp-map.json
{
  "atlassian": "plugin_atlassian_atlassian",
  "github": "Github-Gusto",
  "slack": "slackgustoofficialmcp",
  "notion": "notiongusto",
  "pagerduty": "pagerdutygusto",
  "datadog": "datadoggusto",
  "glean": "gleangusto",
  "dx": "dxgusto",
  "gcal": "gcalgusto",
  "gdrive": "gdrivegusto"
}
```

Core ships a default `_mcp-map.json` that maps each logical id to itself (`atlassian → atlassian`, etc.). Overlays override.

**Why two layers?** Probes are written once against logical ids (`atlassian.user`). Different orgs route them to different physical MCP servers. Core stays clean; overlays only configure routing.

#### 4.2.1 Probe execution (`cli/src/lib/mcp-probe.ts`)

```ts
runProbes(probes: ProbeSpec[], context: ProbeContext): Promise<ProbeResult[]>
```

`ProbeContext` carries: project root, current draft config (so guards can be evaluated), the resolved MCP map, and a **host-shim** — a single callback `(envelope) => Promise<response>` that the runner uses to invoke MCP tools. The runner does not import any MCP client code; the caller injects the shim. There are exactly two shim implementations in v1:

1. **Agent shim (Claude Code host).** Used when `setup --auto` is invoked from inside the `jstack:setup` skill. The shim writes the envelope to a stdout-marker channel, the agent reads it, calls the real MCP tool, and pipes the response back in. The skill orchestrates this; the runner stays pure.
2. **Fixture shim (tests, plain shell).** When `--probe-fixture <file>` is passed, the shim looks up responses by `(probe_id, mcp_id, tool)` from a JSON file. Used by golden-file tests and by `bun cli/src/index.ts setup --auto --probe-fixture …` runs from a plain shell (which otherwise has no way to invoke MCPs).

This means `setup --auto` is primarily an **agent-driven flow** (invoked from `jstack:setup` skill). The CLI surface is `jstack setup --auto` for the agent shim path and `jstack setup --auto --probe-fixture <file>` for tests/CI. There is no third "live MCP from a plain shell" mode in v1.

#### 4.2.2 Load-time validation

When the probe registry is loaded:

1. `read_only: true` is required (load fails otherwise).
2. Every `extract` value's config path must exist in the schema or be flagged as ad-hoc (e.g., `team.members[*].github.login` is OK; `pe.something_made_up` warns).
3. `needs_mcp` ids must be present in the merged `_mcp-map.json` (else the probe is marked `unavailable`).
4. Probes whose `applies_when` evaluates to false against the current draft are skipped (not loaded as errors).

### 4.3 `setup --auto` flow

```
┌────────────────────────────────────────────────────────────────────┐
│  jstack setup --auto                                               │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  1. Load defaults + existing config + overlay (if any)             │
│  2. Discover MCPs from .mcp.json + jstack.config.json mcp_servers  │
│  3. Load probe registry (core probes + overlay probes)             │
│  4. Resolve _mcp-map.json (overlay wins on collision)              │
│  5. For each probe whose needs_mcp resolves AND applies_when       │
│     passes:                                                        │
│       a. Emit request envelope; collect response (agent shim)      │
│       b. Apply extract rules → ProbeResult.contributes              │
│  6. Aggregate ProbeResult[] into a draft patch:                    │
│       - Group by config path                                       │
│       - On conflict, prefer higher-confidence probe                │
│       - Tag every contributed value with                           │
│         { provenance: { probe_id, mcp_id, confidence } }           │
│  7. Present a one-screen review:                                   │
│                                                                    │
│     Section: Team                                                  │
│       team.name              "Platform Engineering"                │
│         (from glean.team_lookup, confidence=high)                  │
│         [Accept] [Edit] [Skip]                                     │
│       team.members[0].github.login "alex-k"                        │
│         (from github.user_search, confidence=medium)               │
│         [Accept] [Edit] [Skip]                                     │
│       …                                                            │
│                                                                    │
│  8. On Accept-all-section / Done: produce a final patch.           │
│      • Default path: hand to schema-prompt with --resume-auto      │
│        which walks the QuestionSpec table with seeded initial      │
│        values; user approves Default / Custom / Skip per field.    │
│      • Non-interactive path (`--write` flag, used by tests/CI):    │
│        skip the schema review; write the patch as-is after one     │
│        final confirm. Required for golden-file determinism.        │
│  9. Write config (single confirm). Provenance sidecar always       │
│     written alongside.                                             │
└────────────────────────────────────────────────────────────────────┘
```

Provenance is stored in a sidecar file `.jstack/setup-auto-provenance.json` (gitignored; written on accept). Subsequent `setup --auto` runs read it and prefer human-edited values over re-probed ones (mirroring the `auto_discovered: false` rule for MCP merge).

### 4.4 Config-driven chains

Today `prompts/chains/*.md` is human-readable but invisible to the CLI. Promote chains to a typed config file with the markdown narrative kept alongside.

```jsonc
// config/chains.json (core ships defaults; overlay can override per-id)
{
  "chains": {
    "intake_to_sprint": {
      "title": "Intake → Sprint",
      "narrative": "prompts/chains/intake-to-sprint-chain.md",
      "steps": [
        { "skill": "jstack:intake",     "wait_for_user": true },
        { "skill": "jstack:prioritize", "wait_for_user": true,
          "config": { "rubric": "RICE" } },
        { "skill": "jstack:sprint-planning", "wait_for_user": true }
      ],
      "config_hooks": ["chains.intake_to_sprint.rubric",
                       "chains.intake_to_sprint.capacity_source"]
    },
    "incident_response":   { /* … */ },
    "sprint_close":        { /* … */ }
  }
}
```

CLI:

```
jstack chain list                       # show chains + which overlay each came from
jstack chain show <id>                  # print steps + narrative
jstack chain run <id>                   # in agent: walk step-by-step with wait_for_user
jstack chain validate                   # every step.skill exists; every config_hook resolves
```

Overlay `config/chains.json` may add new chains (`gusto-postmortem-flow`) or override step lists for an existing core chain (e.g., insert a Gusto-specific approval gate).

### 4.5 Strengthening jstack.gusto

Add to `jstack.gusto/`:

```
config/
  overlay.json                          # registers id="gusto"
  probes/
    _mcp-map.json                       # generic-id → Gusto MCP id
    gusto-team-from-glean.json          # employee_search → team.members[*]
    gusto-jira-from-atlassian.json      # getVisibleJiraProjects → integrations.jira.project_key
    gusto-canonical-from-slack.json     # slack groups → team.canonical_group.*
    gusto-oncall-from-pagerduty.json    # list_oncalls → pe.oncall_services
    gusto-dx-team-scorecard.json        # dxgusto.listTeams → pe.teams
    gusto-lattice-1on1s.json            # 1:1 surfaces → team.members[*].notion.one_on_one_parent_page_id  (best-effort, confidence=low)
  chains.json                           # gusto-only chains: postmortem-flow, oncall-handoff
```

None of these names appear anywhere in `jstack.core/`. The overlay self-describes; core only sees `id="gusto"` opaquely.

Two existing Gusto skills get rewired (no SKILL.md content change required):

- `gusto-jira/find-jira-ticket` and `gusto-postmortems/find-postmortem-docs` start using `cross_plugins.jstack:knowledge:search` with the chain config, instead of inline tool calls.

## 5. Mockups (text-based)

### 5.1 Before / after directory structure

```
BEFORE
─────────────────────────────────────────────────────────────────────
jstack/
├── jstack.core/
│   ├── constants/
│   │   └── paths.ts          # JSTACK_GUSTO_PKG_DIR ▒▒▒▒▒
│   ├── cli/src/lib/
│   │   └── config.ts         # findPluginRoot prefers ./jstack.gusto ▒
│   ├── cli/src/commands/
│   │   └── skills.ts         # process.env.JSTACK_GUSTO_ROOT ×4 ▒▒▒▒▒
│   ├── config/
│   │   ├── defaults.json     # distribution.github.gusto block ▒▒▒▒▒
│   │   ├── schema.json       # "github core/gusto repos" ▒▒▒▒▒
│   │   └── skill-alias-map.json  # gustoRelPath ▒▒▒▒▒
│   └── package.json          # homepage: gusto/jstack.core ▒▒▒▒▒
└── jstack.gusto/
    └── (no overlay manifest, no probes, no MCP map)

AFTER
─────────────────────────────────────────────────────────────────────
jstack/
├── jstack.core/
│   ├── constants/
│   │   └── paths.ts          # JSTACK_PKG_DIR (just "jstack.core")
│   ├── cli/src/lib/
│   │   ├── config.ts         # findPluginRoot delegates to overlay.ts
│   │   ├── overlay.ts        # NEW: registry + resolve()
│   │   ├── mcp-probe.ts      # NEW: probe runner
│   │   ├── setup-auto.ts     # NEW: --auto orchestrator
│   │   └── chain-engine.ts   # NEW: chain runner
│   ├── cli/src/commands/
│   │   ├── skills.ts         # process.env.JSTACK_OVERLAY_ROOT
│   │   └── chain.ts          # NEW: list/show/run/validate
│   ├── config/
│   │   ├── defaults.json     # distribution.publish_targets [{id, owner, repo}]
│   │   ├── schema.json       # neutral, references "overlay" generically
│   │   ├── skill-alias-map.json  # overlayRelPath (with overlay.id field)
│   │   ├── chains.json       # NEW
│   │   └── probes/           # NEW: agnostic core probes
│   │       ├── _mcp-map.json
│   │       ├── github-identity.json
│   │       ├── slack-identity.json
│   │       ├── jira-projects.json
│   │       └── notion-workspace.json
│   └── package.json          # homepage placeholder, check:overlay reads registry
└── jstack.gusto/
    └── config/
        ├── overlay.json      # NEW: id, display_name, distribution
        ├── probes/           # NEW: all Gusto probes
        │   ├── _mcp-map.json
        │   ├── gusto-team-from-glean.json
        │   ├── gusto-jira-from-atlassian.json
        │   ├── gusto-canonical-from-slack.json
        │   ├── gusto-oncall-from-pagerduty.json
        │   └── gusto-dx-team-scorecard.json
        └── chains.json       # NEW: gusto-postmortem, gusto-oncall-handoff
```

### 5.2 `jstack setup --auto` terminal session

```
$ jstack setup --auto
✔ Loaded core (0.1.0) and overlay "gusto" (0.3.0)
✔ Discovered 11 MCP servers from .mcp.json + jstack.config.json
✔ Loaded probe registry (4 core probes + 6 overlay probes)
✔ Resolved MCP map: atlassian→plugin_atlassian_atlassian, github→Github-Gusto, …
─── Running 9 read-only probes (1 skipped: needs_mcp lattice not available)
✔  github.identity            (Github-Gusto.get_me)               240ms
✔  atlassian.user             (plugin_atlassian.atlassianUserInfo) 320ms
✔  atlassian.projects         (getVisibleJiraProjects)            410ms
✔  slack.identity             (slackgustoofficialmcp.read_user_profile) 180ms
✔  glean.team_lookup          (gleangusto.employee_search)        980ms
✔  glean.colleagues           (gleangusto.user_activity)          1.1s
✔  pagerduty.oncall           (pagerdutygusto.list_oncalls)       560ms
✔  dx.teams                   (dxgusto.listTeams)                 270ms
✔  github.team                (Github-Gusto.get_team_members)     330ms

─── Proposed config (review per field, ↑↓ to navigate, [a]ccept all in section)

▼ Section: Team (4 fields)
  team.name                         "Platform Engineering"
                                    ↳ glean.team_lookup            (high)
                                    [a]ccept  [e]dit  [s]kip  [d]iscuss
  team.timezone                     "America/New_York"
                                    ↳ slack.identity               (medium)
                                    [a]ccept  [e]dit  [s]kip
  team.canonical_group.mode         "slack_user_group"
                                    ↳ slack.user_groups            (high)
                                    [a]ccept  [e]dit  [s]kip
  team.canonical_group.slack_user_group_id  "S01ABCD2EFG"
                                    ↳ slack.user_groups            (high)
                                    [a]ccept  [e]dit  [s]kip

▼ Section: Team / Members (7 fields)
  team.members[0].id                "alex-k"
                                    ↳ github.team                  (high)
                                    [a]ccept  [e]dit  [s]kip
  team.members[0].github.login      "alex-kim"
                                    ↳ github.team                  (high)
                                    [a]ccept  [e]dit  [s]kip
  team.members[0].slack.handle      "@alex"
                                    ↳ slack.search_users           (medium)
                                    [a]ccept  [e]dit  [s]kip
  …

▼ Section: Integrations (3 fields)
  integrations.jira.project_key     "PLT"
                                    ↳ atlassian.projects           (high)
                                    [a]ccept  [e]dit  [s]kip
  …

▼ Section: PE / Teams (2 fields)
  pe.teams                          ["team-platform","team-pulse"]
                                    ↳ dx.teams                     (medium)
                                    [a]ccept  [e]dit  [s]kip
  pe.oncall_services                ["zenpayroll-api","zenpayroll-web"]
                                    ↳ pagerduty.oncall             (high)
                                    [a]ccept  [e]dit  [s]kip

(Tab) Continue to schema-driven review of remaining fields …
(W) Write config (skip remaining fields)
(Q) Quit (no write)
```

### 5.3 Probe definition example

```jsonc
// jstack.gusto/config/probes/gusto-team-from-glean.json
{
  "id": "glean.team_lookup",
  "description": "Identify the user's team via Glean employee search",
  "needs_mcp": ["glean"],
  "tool": "employee_search",
  "args": { "query": "${user.email}" },
  "read_only": true,
  "extract": {
    "team.name":                            { "jsonpath": "$.results[0].team.name" },
    "team.canonical_group.display_name":    { "jsonpath": "$.results[0].team.name" },
    "team.canonical_group.google_group_email": {
      "jsonpath": "$.results[0].team.email",
      "transform": "lower"
    }
  },
  "confidence": "high",
  "contributes_to": ["team.name", "team.canonical_group.*"],
  "applies_when": { "config_path": "user.email", "is": "set" }
}
```

`${user.email}` is the **only** template form supported in v1: it interpolates from a fixed identity context (set by `github.identity` and `atlassian.user` probes which always run first). No general expression language.

### 5.4 Overlay registry resolution

```
   resolveOverlay({ cwd: "/repo/jstack.core/cli" })
       │
       ▼
   walk parents up to PLUGIN_ROOT_MAX_STEPS:
       /repo/jstack.core/cli   → not a plugin root
       /repo/jstack.core       → has config/defaults.json → register as core
       /repo                   → check siblings for config/overlay.json
                                   /repo/jstack.gusto/config/overlay.json
                                   → register overlay {id:"gusto", path:/repo/jstack.gusto}
                                 → no further useful parents
       /                       → stop
   
   pick:
       JSTACK_OVERLAY env set?  → yes, "gusto" → return /repo/jstack.gusto
       else core_compat ok?     → yes (gusto requires ^0.x, core is 0.1.0) → return overlay
       else                     → fall back to core
```

### 5.5 Chain config / agent execution

```
$ jstack chain list
  intake_to_sprint        (core)         3 steps
  incident_response       (core)         5 steps
  sprint_close            (core)         4 steps
  gusto-postmortem-flow   (overlay:gusto) 6 steps
  gusto-oncall-handoff    (overlay:gusto) 4 steps

$ jstack chain show gusto-postmortem-flow
gusto-postmortem-flow (Gusto Postmortem Flow)
  Source:    jstack.gusto/config/chains.json
  Narrative: jstack.gusto/skills/gusto-postmortems/references/legacy-flow.md
  Steps:
    1. jstack:incident:reconcile-timeline   wait_for_user
    2. jstack:incident:contributing-factors wait_for_user
    3. jstack:postmortem:create-postmortem  wait_for_user
       config: { template: "gusto-pm-template-v3" }
    4. jstack:postmortem:review-action-items wait_for_user
    5. jstack:postmortem:refill-postmortem  wait_for_user
    6. jstack:notion:publish                wait_for_user

$ jstack chain run gusto-postmortem-flow
[in agent host] step 1/6 → invoke jstack:incident:reconcile-timeline …
```

## 6. Multi-persona review

### CEO

> Two questions: (1) can this ship behind a flag like the schema spec did, and (2) does it cost a single token of LLM time to run `setup --auto`? If the answer to (1) is yes and (2) is zero, ship it. Don't bundle this with the schema-driven setup PR — separate, small, mergeable steps.

**Reconciled.**
- (1) Yes. Three flags gate adoption:
    - `JSTACK_OVERLAY_REGISTRY=on` (default off in v1) toggles the new `findPluginRoot` path; the legacy `JSTACK_GUSTO_PKG_DIR` constant remains as an alias for one minor release.
    - `setup --auto` is opt-in by flag; legacy `setup` is unchanged.
    - `chain` command is new; nothing existing depends on it.
- (2) Zero LLM tokens in CLI/probe code. The agent host that *runs* a chain or *invokes* probes consumes tokens normally, but the probe runner itself has no LLM call. Probe extraction is JSONPath + regex.

### PM (acceptance criteria)

> 1. After this lands, no file in `jstack.core/` (excluding `agents/`, `prompts/`, `docs/`, `examples/`, and templates) contains the literal string "gusto" or "jstack.gusto" — verified by a grep test in CI. ✓
> 2. A user with `JSTACK_OVERLAY=gusto` set and `jstack.gusto/config/overlay.json` present resolves the overlay correctly without any code change. ✓
> 3. `jstack setup --auto --probe-fixture tests/fixtures/probes-gusto.json --write --yes` produces a deterministic draft config (golden-file test). The `--yes` flag bypasses the final confirm; `--write` skips the schema-review step. ✓
> 4. `jstack chain run intake_to_sprint` (in an agent host) walks the three steps in order, pausing for user confirmation between each. ✓ (manual eval; no automated test for agent-host execution in v1)
> 5. Existing `jstack setup` (no flag) is byte-for-byte identical in behavior. ✓ (regression test runs the existing wizard non-interactively and diffs the output.)

### Design

> The `[a]ccept [e]dit [s]kip` mockup in §5.2 is too dense. Group probes by **section** (Team / Integrations / PE / …), let the user `a` to accept whole sections, and reserve per-field navigation for users who want it. Show provenance dimly (so it doesn't compete with the value). Cap each section at one screen — paginate within if longer.

**Reconciled.** Section-level Accept-all is the default; per-field navigation is `↓` to expand. Provenance is rendered in `chalk.dim`. Pagination uses `@clack/prompts` `groupMultiselect` style.

### Eng

> Constraints:
>
> - **No new global state.** The probe runner is a pure function: `(probes, mcpResponses, draft) → ProbeResult[]`. The overlay registry **is** cached, but only inside one CLI invocation (a `Map` on the resolver instance), never as a module-global.
> - **The agent shim and CLI shim must share zero code with each other beyond the `ProbeContext` type.** That keeps the test surface small.
> - **`config/overlay.json` is parsed once per CLI invocation,** cached on `findPluginRoot`. No filesystem walks during probe runs.
> - **Schema is the source of truth.** Extract paths must validate against `JstackConfigSchema` paths at registry-load time; unknown paths fail loudly in tests, warn in production.
> - **Fix L1–L9 in this PR.** Do not split the contamination cleanup across PRs — it is the value proposition.
> - **Deprecation:** `JSTACK_GUSTO_PKG_DIR` and `process.env.JSTACK_GUSTO_ROOT` continue to work for one minor release; both emit a `console.warn("[deprecated]…")` exactly once per process.

**Reconciled verbatim.**

### QA

> Test matrix:
>
> 1. **Contamination grep** — CI runs `rg -n 'gusto|jstack\\.gusto' jstack.core/cli jstack.core/constants jstack.core/scripts jstack.core/config` and asserts only allow-listed hits (none, after this lands).
> 2. **Overlay resolution** — table-driven test for `resolveOverlay`: no overlays / one overlay / two overlays (pick by env) / overlay with failing `core_compat`.
> 3. **Probe registry validation** — every shipped probe loads, has `read_only:true`, has at least one `extract` rule, and resolves all `needs_mcp` against a fixture map.
> 4. **Probe runner determinism** — fixture-driven: feed `mcpResponses`, expect a specific `ProbeResult[]`.
> 5. **`setup --auto` golden file** — fixture probes + fixture user input → byte-identical config across runs.
> 6. **Chain CLI** — `chain validate` fails when a `step.skill` doesn't exist; `chain show` prints all fields; `chain list` includes overlay attribution.
> 7. **Backward compat** — running the legacy `setup` produces the same `jstack.config.json` it did before the change.
> 8. **Deprecation warnings** — using `JSTACK_GUSTO_ROOT` emits exactly one warning per process, regardless of how many call sites read it.

**Reconciled verbatim.** All eight cases tracked in §8.

## 7. File-level plan

### 7.1 New files

#### `jstack.core/cli/src/lib/overlay.ts`
- Exports: `OverlaySpec`, `resolveOverlay()`, `listOverlays()`, `getOverlayRoot(id)`.
- Cached: `Map<string, OverlaySpec>` keyed by absolute path.
- ~120 lines.

#### `jstack.core/cli/src/lib/mcp-probe.ts`
- Exports: `loadProbeRegistry()`, `runProbes()`, `applyExtract()`.
- Pure functions; no I/O except the host shim callback.
- ~200 lines.

#### `jstack.core/cli/src/lib/setup-auto.ts`
- Orchestrator. Reads probes, resolves MCP map, calls `runProbes()`, aggregates → draft patch.
- ~180 lines.

#### `jstack.core/cli/src/lib/chain-engine.ts`
- Loads chains from core + overlay, resolves precedence, validates against skill catalog, walks steps.
- ~150 lines.

#### `jstack.core/cli/src/commands/chain.ts`
- `list`, `show <id>`, `run <id>`, `validate`.
- ~100 lines.

#### `jstack.core/cli/src/types/probe.ts`
- `ProbeSpec`, `ProbeResult`, `ProbeExtractMap`, `ProbeContext`.
- ~60 lines.

#### `jstack.core/config/probes/`
- `_mcp-map.json` (identity map; agnostic).
- `github-identity.json`
- `slack-identity.json`
- `jira-projects.json`
- `notion-workspace.json`

#### `jstack.core/config/chains.json`
- The three existing chains (intake_to_sprint, incident_response, sprint_close) ported from `prompts/chains/*.md`.

#### `jstack.gusto/config/overlay.json`
- Declares `id="gusto"`, `display_name`, `distribution.{owner,repo,default_branch}`.

#### `jstack.gusto/config/probes/`
- `_mcp-map.json` (Gusto routing).
- `gusto-team-from-glean.json`
- `gusto-jira-from-atlassian.json`
- `gusto-canonical-from-slack.json`
- `gusto-oncall-from-pagerduty.json`
- `gusto-dx-team-scorecard.json`

#### `jstack.gusto/config/chains.json`
- `gusto-postmortem-flow`, `gusto-oncall-handoff`.

#### Tests
- `jstack.core/cli/src/lib/overlay.test.ts`
- `jstack.core/cli/src/lib/mcp-probe.test.ts`
- `jstack.core/cli/src/lib/setup-auto.test.ts`
- `jstack.core/cli/src/lib/chain-engine.test.ts`
- `jstack.core/cli/src/commands/chain.test.ts`
- `jstack.core/scripts/check-core-purity.test.ts` (the contamination grep)

### 7.2 Modified files

#### `jstack.core/constants/paths.ts`
- Drop `JSTACK_GUSTO_PKG_DIR` (replace with deprecated re-export from `overlay.ts` for one minor release).
- Replace `DISTRIBUTION_VERSION_DEFAULT_URL` with empty default; add `JSTACK_OVERLAY_ENV = "JSTACK_OVERLAY"` and `JSTACK_OVERLAY_ROOT_ENV = "JSTACK_OVERLAY_ROOT"`.
- Keep `JSTACK_GUSTO_ROOT` as a deprecated alias that proxies to `JSTACK_OVERLAY_ROOT` and warns.

#### `jstack.core/cli/src/lib/config.ts`
- `findPluginRoot`: delegate to `overlay.resolveOverlay`; remove the hard-coded `nestedGusto` branch.

#### `jstack.core/cli/src/index.ts`
- `--overlay <path>` description: `"Overlay plugin root (registers an overlay by id)"`.
- New flags on `setup`: `--auto`, `--probe-fixture <file>`, `--resume-auto`, `--write` (skip schema review), `--yes` (skip final write confirm).
- New top-level command: `chain {list,show,run,validate}`.

#### `jstack.core/cli/src/commands/skills.ts`
- Replace four `process.env.JSTACK_GUSTO_ROOT` with a helper `getOverlayRoot()` that reads `JSTACK_OVERLAY_ROOT` first, then `JSTACK_GUSTO_ROOT` (with deprecation warning).

#### `jstack.core/cli/src/commands/setup.ts`
- Add `--auto`, `--resume-auto`, `--write`, `--yes`, `--probe-fixture` branches.
- `--auto` → run probes; if `--write` is also set, write the patch directly (one final confirm unless `--yes`); otherwise hand off to schema-driven setup with `--resume-auto` (seeded answers).
- `--auto --resume-auto` is a convenience alias kept for symmetry with the schema spec.

#### `jstack.core/cli/src/types/cli-registry.ts`
- Update `--overlay` description; document new flags.

#### `jstack.core/config/defaults.json`
- Replace `distribution.github.{core,gusto}` with `distribution.publish_targets: { core: {...}, overlay: {...} }` where `overlay` is left empty by default.

#### `jstack.core/config/schema.json`
- Update `distribution` description to be neutral; add `overlay` block (`id?`, `display_name?`, `package_dir?`).

#### `jstack.core/config/skill-alias-map.json`
- Rename `gustoRelPath` → `overlayRelPath`; add `overlayId` field.

#### `jstack.core/scripts/validate-skill-alias-drift.ts`
- Reflect the schema rename; keep parsing the deprecated field for one release.

#### `jstack.core/package.json`
- `homepage`: empty string OR a neutral example URL like `https://github.com/<your-org>/jstack.core` (placeholder).
- Rename `check:gusto` → `check:overlay`; reads `config/overlay-registry.local.json` (gitignored) for path; if absent, no-op.

### 7.3 Deprecation table (one minor release)

| Old | New | Behavior |
|-----|-----|----------|
| `JSTACK_GUSTO_PKG_DIR` const | use `overlay.resolveOverlay()` | re-export warns once; planned removal in v0.3.0 |
| `process.env.JSTACK_GUSTO_ROOT` | `process.env.JSTACK_OVERLAY_ROOT` | accepted with warn-once; removed in v0.3.0 |
| `distribution.github.gusto` config block | `distribution.publish_targets.<id>` | parsed and warned; removed in v0.3.0 |
| `gustoRelPath` in skill-alias-map | `overlayRelPath` + `overlayId` | both accepted; old removed in v0.3.0 |
| `--overlay <path>` CLI option | unchanged (just the help text) | no behavior change |

## 8. Test plan

| Case | Surface | File | Notes |
|------|---------|------|-------|
| `resolveOverlay` returns no overlay when none present | `lib/overlay.ts` | `overlay.test.ts` | core-only |
| `resolveOverlay` returns single sibling overlay | same | same | one `overlay.json` |
| `resolveOverlay` honors `JSTACK_OVERLAY` env | same | same | two siblings, env picks one |
| `resolveOverlay` rejects overlay failing `core_compat` | same | same | falls back to core |
| Probe registry rejects `read_only:false` | `lib/mcp-probe.ts` | `mcp-probe.test.ts` | load-time |
| Probe extract applied to fixture response | same | same | golden output |
| Probe `applies_when` skips on guard fail | same | same |  |
| `runProbes` deterministic on fixture | `lib/setup-auto.ts` | `setup-auto.test.ts` | golden config |
| `setup --auto --probe-fixture` writes nothing without confirm | `commands/setup.ts` | `cli-interactive-contracts.test.ts` extend |  |
| `setup --auto --probe-fixture --write --yes` produces a deterministic config (golden file) | `commands/setup.ts` | same | non-interactive path |
| `chain list` shows overlay attribution | `commands/chain.ts` | `chain.test.ts` |  |
| `chain validate` fails on unknown skill | same | same |  |
| `chain run` walks steps in order (mock host) | same | same |  |
| **Contamination grep** in core paths | repo-level | `check-core-purity.test.ts` | strictest gate |
| Deprecated `JSTACK_GUSTO_ROOT` warns once per process | `lib/overlay.ts` | `overlay.test.ts` |  |
| Deprecated `gustoRelPath` parses with warn | `scripts/validate-skill-alias-drift.ts` | `validate-skill-alias-drift.test.ts` |  |
| Backward-compat: legacy `setup` produces same config | `commands/setup.ts` | regression fixture |  |

`bun test` from `jstack.core/` runs all of the above. `bun run typecheck` (CLI tsconfig) must pass with no new `any`s.

### 8.1 Contamination grep — exact rule

```bash
# CI: from jstack.core/
rg -n --hidden \
   --glob '!docs/**' \
   --glob '!agents/**' \
   --glob '!prompts/**' \
   --glob '!examples/**' \
   --glob '!templates/**' \
   --glob '!skill-catalog.json' \
   --glob '!skills-data.js' \
   --glob '!CHANGELOG.md' \
   --glob '!README.md' \
   '\bgusto\b|jstack\.gusto|JSTACK_GUSTO' .
```

Allow-list (must be empty after this lands):

- (none)

Allow-list one-pass during deprecation (v0.2.x):

- `constants/paths.ts` `JSTACK_GUSTO_PKG_DIR` line — re-exports for back-compat.
- `cli/src/commands/skills.ts` four sites referencing `JSTACK_GUSTO_ROOT` for back-compat with a warning.
- `scripts/validate-skill-alias-drift.ts` — `gustoRelPath` legacy parse.

These three sites have `// LEGACY: remove in v0.3.0` markers; the test counts the markers (must equal exactly 3).

## 9. Rollout

1. **PR-1: Overlay registry + contamination cleanup.** L1–L9 fixed; new `overlay.ts`; deprecation warns wired. No behavior change for users with no overlay; users with `jstack.gusto/` get the same auto-detect via the new path.
2. **PR-2: Probe registry + `setup --auto`.** Adds `mcp-probe.ts`, `setup-auto.ts`, and the four core probes. Ships behind `--auto` flag. Schema-driven setup spec must have landed first (we extend its `--resume-auto` entry point).
3. **PR-3: Chain config + `chain` command.** Pure additive. Existing `prompts/chains/*.md` stay; the new chain config has `narrative` pointing at them.
4. **PR-4 (in `jstack.gusto/`): overlay manifest + Gusto probes + Gusto chains.** Lands separately so core can be reviewed in isolation.

Each PR is independently revertable. Each ships with the relevant tests from §8.

## 11. Real-world calibration (added 2026-04-29 after dry-run)

A live dry-run against the user's actual Gusto MCPs revealed that 4 of 9 attempted probes worked end-to-end and 5 needed calibration. The full report is at [`../../../jstack.gusto/docs/superpowers/plans/2026-04-29-pr4-probe-calibration-report.md`](../../../jstack.gusto/docs/superpowers/plans/2026-04-29-pr4-probe-calibration-report.md). Five learnings are folded back into PR-2 / PR-4:

1. **Response size cap is required.** Some Gusto MCPs (`pagerdutygusto.list_oncalls`, `dxgusto.listTeams`) ignore `limit` parameters and return 80–190KB. PR-4 Task 9.5 Step 6 adds a per-probe 256KB cap in the runner.
2. **Glean is the keystone probe.** `gleangusto.employee_search` populates more fields (~30) than the next 5 probes combined. PR-4 calibration prioritizes its extract rules.
3. **`pagerduty.oncall` must extract escalation_policy, not just schedule.summary.** Managerial on-call users have `schedule: null`; extending the extract preserves their oncall membership.
4. **Two probes deferred to v2:**
    - `slack.user_groups` — needs a Slack MCP `usergroups.list` tool, which is not currently exposed.
    - `dx.teams` filter — needs a `${team.name}` placeholder (not in v1's `ALLOWED_PLACEHOLDERS`) or a chained_probe pattern.
   Both documented as known gaps in PR-4 README; user pastes these fields manually until v2.
5. **Github SSO hides email by default.** Core `github.identity` probe should not surface `user.email` with high confidence; let `slack.identity` provide it.

These calibration changes are captured in PR-4 Task 9.5 (added 2026-04-29). The v1 probe set after calibration: `github.identity`, `slack.identity`, `atlassian.projects`, `glean.team_lookup`, `github.team`, `pagerduty.oncall` — 6 probes covering ~63 fields (~75% manual-wizard coverage for an engineering-manager user shape).

---

## 10. Open questions (for user review)

1. **Overlay manifest version field** — should `core_compat` use semver against the core `VERSION` file, or a separate `compat` matrix? (Recommendation: semver against `VERSION`.)
2. **Probe credentials** — do we need per-probe credential gating, or do we trust that the host-shim only runs probes against MCPs the user has already authorized? (Recommendation: trust the host; never read tokens from the CLI.)
3. **Probe template language** — v1 supports only `${user.email}`, `${user.github_login}`, `${team.canonical_group.slack_user_group_id}`. Do we want to expand later? (Recommendation: stay minimal in v1; revisit only if a real probe needs more.)
4. **Setup --auto for non-Claude-Code hosts** — Cursor and Codex don't expose MCP tool calls to the agent in the same way. Should we ship `--auto` only for Claude Code in v1? (Recommendation: yes; document Cursor/Codex fallback as `--probe-fixture <file>`.)
5. **Chain `wait_for_user` semantics** — should the user be able to override at run time (`--auto-yes` to skip pauses)? (Recommendation: yes, but only if every step is read-only; chain definitions can mark `requires_user: true` to opt out of `--auto-yes`.)

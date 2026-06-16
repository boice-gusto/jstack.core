# PR-2: Probe Registry + `setup --auto` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a declarative MCP probe system to `jstack.core` that can be invoked via `jstack setup --auto`. Probes are read-only JSONPath/regex extractors over MCP tool responses; results aggregate into a draft config the user reviews field-by-field before write.

**Architecture:** Three new pure-ish modules — `cli/src/types/probe.ts` (types), `cli/src/lib/mcp-probe.ts` (load + run probes via an injected host-shim), `cli/src/lib/setup-auto.ts` (orchestrator that wires probes into the existing `setup` flow and bridges to the schema-driven setup wizard). Core ships four agnostic probes (`github-identity`, `slack-identity`, `jira-projects`, `notion-workspace`); overlays add their own (PR-4). The host-shim pattern keeps the runner testable: tests inject a fixture shim, the agent host injects a real one.

**Tech Stack:** TypeScript, Bun, Zod, `jsonpath-plus`, `@clack/prompts`, `vitest`. No LLM calls in this PR.

**Spec:** [`../specs/2026-04-28-overlay-registry-and-setup-auto-design.md`](../specs/2026-04-28-overlay-registry-and-setup-auto-design.md) §4.2, §4.3, §7.1–§7.3, §8.

**Working directory:** `/Users/jonathan.boice/Documents/GitHub/jstack/jstack.core`.

**Depends on:** PR-1 (`cli/src/lib/overlay.ts`) and the schema-driven-setup spec PR (the `setup --schema --resume-auto` entrypoint). If schema-driven setup has not landed, swap the bridge in Task 14 for a direct write path; the runner is independent.

**Adopted decisions from spec §10:** template language is minimal (3 placeholders); CLI never reads tokens; v1 ships only for the Claude Code host (other hosts use `--probe-fixture`).

---

## File Structure

### New files

| Path | Responsibility |
|------|----------------|
| `cli/src/types/probe.ts` | `ProbeSpec`, `ProbeExtractRule`, `ProbeContext`, `ProbeResult`, `ProbeEnvelope`, `HostShim` types and zod schemas. |
| `cli/src/lib/mcp-probe.ts` | `loadProbeRegistry()`, `applyExtract()`, `runProbes()` (injected host shim). Pure functions; no I/O except via the shim callback. |
| `cli/src/lib/setup-auto.ts` | Orchestrator: gathers probes, evaluates guards, calls `runProbes()`, aggregates `ProbeResult[]` into a draft patch, writes provenance sidecar. |
| `cli/src/lib/probe-template.ts` | Minimal `${user.email}`-style placeholder resolution. |
| `cli/src/lib/probe-fixture.ts` | `loadProbeFixture()` — reads JSON file, returns a fixture host-shim. |
| `cli/src/lib/probe-agent-shim.ts` | Stub for the Claude Code agent shim (writes envelopes to a stdout channel; the agent reads them and replies via stdin). v1 implementation; full integration tested manually. |
| `cli/src/types/probe.test.ts` | Schema parse tests. |
| `cli/src/lib/mcp-probe.test.ts` | Registry load + extract + run determinism. |
| `cli/src/lib/setup-auto.test.ts` | Orchestrator golden-file test (uses `--probe-fixture`). |
| `cli/src/lib/probe-template.test.ts` | Placeholder resolver. |
| `tests/fixtures/probes/` | Fixture probe responses for golden tests. |
| `config/probes/_mcp-map.json` | Identity map (logical id → logical id) for core. |
| `config/probes/github-identity.json` | Probe: `github.get_me` → `user.github_login`, `user.email`. |
| `config/probes/slack-identity.json` | Probe: `slack.read_user_profile` → `user.slack_user_id`, `team.timezone`. |
| `config/probes/jira-projects.json` | Probe: `atlassian.getVisibleJiraProjects` → `integrations.jira.project_key`, `integrations.jira.base_url`. |
| `config/probes/notion-workspace.json` | Probe: `notion.notion-search` (top page) → `integrations.notion.workspace_id`. |

### Modified files

| Path | Why |
|------|-----|
| `cli/src/commands/setup.ts` | Add `--auto`, `--probe-fixture <file>`, `--write`, `--yes`, `--resume-auto` branches; route to `setup-auto.ts`. |
| `cli/src/index.ts` | Register the new flags on the `setup` subcommand. |
| `cli/src/types/cli-registry.ts` | Reflect the new flags in the registry. |
| `cli/src/lib/config.ts` | Add helpers `readProvenance(projectRoot)` / `writeProvenance(projectRoot, sidecar)` for the `.jstack/setup-auto-provenance.json` sidecar. |
| `cli/package.json` | Add `jsonpath-plus` dep. |

### Touch-light

- `config/schema.json` — no change in PR-2; the schema already accepts unknown keys via `loose` records.
- `cli/src/lib/setup-defaults-slices.ts` — no change.

---

## Task 0: Add top-level `user` schema block + migration parser

Probes contribute to `user.github_login`, `user.email`, `user.slack_user_id`, etc. The current `JstackConfigSchema` is `.passthrough()` so unknown keys parse, but they're invisible to consumers. Decision: add an explicit top-level `user` block. Also: read the **deprecated** `distribution.github.gusto` if present in an existing config and emit a one-time migration warning that suggests `distribution.publish_targets.overlay`.

**Files:**
- Modify: `cli/src/types/config.ts`
- Modify: `config/defaults.json`
- Modify: `config/schema.json`
- Modify: `cli/src/lib/config.ts` (add `migrateLegacyDistribution`)
- Test: `cli/src/lib/config.test.ts`

- [ ] **Step 1: Add `user` to `JstackConfigSchema`**

In `cli/src/types/config.ts`, before `JstackConfigSchema`, define:

```ts
const UserSchema = z
  .object({
    email: z.string().optional(),
    github_login: z.string().optional(),
    slack_user_id: z.string().optional(),
  })
  .passthrough();
```

Add `user: UserSchema.optional()` inside `JstackConfigSchema.object({...})`.

- [ ] **Step 2: Reflect in `config/defaults.json`**

Insert at the top, after `version`:

```json
"user": {
  "email": "",
  "github_login": "",
  "slack_user_id": ""
},
```

- [ ] **Step 3: Reflect in `config/schema.json`**

Add a `user` property block alongside the existing top-level properties:

```json
"user": {
  "type": "object",
  "additionalProperties": true,
  "description": "Identity of the user running jstack — populated by setup --auto from MCP probes (github.identity, slack.identity, etc.).",
  "properties": {
    "email":         { "type": "string" },
    "github_login":  { "type": "string" },
    "slack_user_id": { "type": "string" }
  }
}
```

- [ ] **Step 4: Add `migrateLegacyDistribution`**

In `cli/src/lib/config.ts`:

```ts
let warnedLegacyDistGusto = false;

/** @internal — for tests only. Resets warn-once so tests can re-trigger the warning. */
export function _resetMigrationStateForTest(): void {
  warnedLegacyDistGusto = false;
}

export function migrateLegacyDistribution(cfg: Record<string, unknown>): Record<string, unknown> {
  const dist = cfg.distribution as Record<string, unknown> | undefined;
  if (!dist) return cfg;
  const github = dist.github as Record<string, unknown> | undefined;
  const legacy = github?.gusto as Record<string, unknown> | undefined;
  if (!legacy || (!legacy.owner && !legacy.repo)) return cfg;
  if (!warnedLegacyDistGusto) {
    warnedLegacyDistGusto = true;
    console.warn(
      "[deprecated] distribution.github.gusto is deprecated; the value will be migrated to " +
        "distribution.publish_targets.overlay (removed in v0.3.0).",
    );
  }
  const publish_targets =
    (dist.publish_targets as Record<string, unknown> | undefined) ?? {};
  const overlay =
    (publish_targets.overlay as Record<string, unknown> | undefined) ?? {};
  const next: Record<string, unknown> = {
    ...cfg,
    distribution: {
      ...dist,
      publish_targets: {
        ...publish_targets,
        overlay: { ...overlay, ...legacy },
      },
    },
  };
  return next;
}
```

Wire it into `readConfig` and `readConfigOptional` so every consumer benefits.

- [ ] **Step 5: Test**

Append to `cli/src/lib/config.test.ts`:

```ts
import { migrateLegacyDistribution } from "./config.js";

describe("migrateLegacyDistribution", () => {
  it("copies distribution.github.gusto into distribution.publish_targets.overlay", () => {
    const before = {
      distribution: {
        github: { gusto: { owner: "gusto", repo: "jstack.gusto", default_branch: "main" } },
      },
    };
    const after = migrateLegacyDistribution(before);
    expect(after).toMatchObject({
      distribution: {
        publish_targets: {
          overlay: { owner: "gusto", repo: "jstack.gusto", default_branch: "main" },
        },
      },
    });
  });

  it("is a no-op when distribution.github.gusto is empty or absent", () => {
    expect(migrateLegacyDistribution({})).toEqual({});
    expect(migrateLegacyDistribution({ distribution: {} })).toEqual({ distribution: {} });
    expect(migrateLegacyDistribution({ distribution: { github: { gusto: {} } } }))
      .toEqual({ distribution: { github: { gusto: {} } } });
  });
});
```

Run: `bun test cli/src/lib/config.test.ts`
Expected: 2 new pass.

- [ ] **Step 6: Commit**

```bash
git add cli/src/types/config.ts config/defaults.json config/schema.json cli/src/lib/config.ts cli/src/lib/config.test.ts
git commit -m "feat(schema): add top-level user block; migrate distribution.github.gusto with warn-once"
```

---

## Task 1: Add `jsonpath-plus` dependency

**Files:**
- Modify: `cli/package.json`, `cli/bun.lock`.

- [ ] **Step 1: Install**

```bash
cd cli && bun add jsonpath-plus
cd cli && bun add -d @types/jsonpath-plus
```

- [ ] **Step 2: Verify resolution**

Create a temp file `cli/_jsonpath_check.ts`:

```ts
import { JSONPath } from "jsonpath-plus";
const r = JSONPath({ path: "$.a", json: { a: 1 } });
console.log(r);
```

Run: `bun cli/_jsonpath_check.ts`
Expected: `[ 1 ]`.

Delete the temp file:

```bash
rm cli/_jsonpath_check.ts
```

- [ ] **Step 3: Commit**

```bash
git add cli/package.json cli/bun.lock
git commit -m "chore(deps): add jsonpath-plus for probe extract evaluation"
```

---

## Task 2: Define probe types and zod schemas

**Files:**
- Create: `cli/src/types/probe.ts`
- Test: `cli/src/types/probe.test.ts`

- [ ] **Step 1: Write the failing test**

Create `cli/src/types/probe.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ProbeSpecSchema } from "./probe.js";

const minimal = {
  id: "github.identity",
  description: "Read the current GitHub user",
  needs_mcp: ["github"],
  tool: "get_me",
  read_only: true,
  extract: {
    "user.github_login": { jsonpath: "$.login" },
    "user.email": { jsonpath: "$.email", transform: "lower" },
  },
  confidence: "high",
  contributes_to: ["user.github_login", "user.email"],
};

describe("ProbeSpecSchema", () => {
  it("parses a minimal probe", () => {
    const parsed = ProbeSpecSchema.parse(minimal);
    expect(parsed.id).toBe("github.identity");
    expect(parsed.read_only).toBe(true);
  });

  it("rejects probes with read_only=false", () => {
    expect(() =>
      ProbeSpecSchema.parse({ ...minimal, read_only: false }),
    ).toThrow();
  });

  it("requires at least one extract rule", () => {
    expect(() =>
      ProbeSpecSchema.parse({ ...minimal, extract: {} }),
    ).toThrow();
  });

  it("rejects unknown transforms", () => {
    expect(() =>
      ProbeSpecSchema.parse({
        ...minimal,
        extract: { "user.email": { jsonpath: "$.email", transform: "uppercase" } },
      }),
    ).toThrow();
  });

  it("accepts an optional applies_when guard", () => {
    const parsed = ProbeSpecSchema.parse({
      ...minimal,
      applies_when: { config_path: "user.email", is: "set" },
    });
    expect(parsed.applies_when?.is).toBe("set");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test cli/src/types/probe.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `cli/src/types/probe.ts`:

```ts
import { z } from "zod";

export const ProbeTransformSchema = z.enum(["trim", "lower", "split_at_at", "first"]);

export const ProbeExtractRuleSchema = z
  .object({
    jsonpath: z.string().min(1),
    transform: ProbeTransformSchema.optional(),
    fallback: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  })
  .strict();

export const ProbeGuardSchema = z
  .object({
    config_path: z.string().min(1),
    is: z.enum(["set", "unset", "truthy", "falsy"]),
  })
  .strict();

export const ProbeConfidenceSchema = z.enum(["low", "medium", "high"]);

export const ProbeSpecSchema = z
  .object({
    id: z.string().min(1),
    description: z.string().min(1),
    needs_mcp: z.array(z.string().min(1)).min(1),
    tool: z.string().min(1),
    args: z.record(z.unknown()).optional(),
    read_only: z.literal(true),
    extract: z.record(ProbeExtractRuleSchema).refine(
      (m) => Object.keys(m).length >= 1,
      "extract must contain at least one rule",
    ),
    confidence: ProbeConfidenceSchema,
    contributes_to: z.array(z.string().min(1)).min(1),
    applies_when: ProbeGuardSchema.optional(),
  })
  .strict();

export type ProbeSpec = z.infer<typeof ProbeSpecSchema>;
export type ProbeExtractRule = z.infer<typeof ProbeExtractRuleSchema>;
export type ProbeGuard = z.infer<typeof ProbeGuardSchema>;

export type ProbeEnvelope = {
  probe_id: string;
  mcp_id: string;
  tool: string;
  args: Record<string, unknown>;
};

export type ProbeResponse = { ok: true; body: unknown } | { ok: false; error: string };

export type HostShim = (env: ProbeEnvelope) => Promise<ProbeResponse>;

export type ProbeContext = {
  projectRoot: string;
  draftConfig: Record<string, unknown>;
  mcpMap: Record<string, string>;
  identity: Record<string, string>;
  shim: HostShim;
};

export type ProbeContribution = {
  config_path: string;
  value: unknown;
  confidence: "low" | "medium" | "high";
  probe_id: string;
  mcp_id: string;
};

export type ProbeResult =
  | { probe_id: string; mcp_id: string; status: "ok"; contributions: ProbeContribution[]; raw: unknown }
  | { probe_id: string; mcp_id: string; status: "skipped"; reason: string }
  | { probe_id: string; mcp_id: string; status: "error"; error: string };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test cli/src/types/probe.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add cli/src/types/probe.ts cli/src/types/probe.test.ts
git commit -m "feat(probe): add ProbeSpec/ProbeContext/HostShim type system"
```

---

## Task 3: Implement the placeholder resolver

**Files:**
- Create: `cli/src/lib/probe-template.ts`
- Test: `cli/src/lib/probe-template.test.ts`

- [ ] **Step 1: Write the failing test**

Create `cli/src/lib/probe-template.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveProbeTemplate, ALLOWED_PLACEHOLDERS } from "./probe-template.js";

describe("resolveProbeTemplate", () => {
  it("substitutes ${user.email} from identity", () => {
    expect(
      resolveProbeTemplate("${user.email}", {
        identity: { "user.email": "alex@acme.com" },
      }),
    ).toBe("alex@acme.com");
  });

  it("returns unchanged when no placeholder", () => {
    expect(resolveProbeTemplate("plain string", { identity: {} })).toBe("plain string");
  });

  it("throws on unknown placeholder", () => {
    expect(() =>
      resolveProbeTemplate("${user.password}", { identity: {} }),
    ).toThrow(/not allowed/);
  });

  it("throws on missing identity for known placeholder", () => {
    expect(() =>
      resolveProbeTemplate("${user.email}", { identity: {} }),
    ).toThrow(/missing identity/);
  });

  it("ALLOWED_PLACEHOLDERS list is exactly three entries", () => {
    expect(ALLOWED_PLACEHOLDERS).toEqual([
      "user.email",
      "user.github_login",
      "team.canonical_group.slack_user_group_id",
    ]);
  });

  it("resolves args object recursively", () => {
    expect(
      resolveProbeTemplate(
        { query: "${user.email}", limit: 10 },
        { identity: { "user.email": "x@y.z" } },
      ),
    ).toEqual({ query: "x@y.z", limit: 10 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test cli/src/lib/probe-template.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `cli/src/lib/probe-template.ts`:

```ts
export const ALLOWED_PLACEHOLDERS = [
  "user.email",
  "user.github_login",
  "team.canonical_group.slack_user_group_id",
] as const;

export type AllowedPlaceholder = (typeof ALLOWED_PLACEHOLDERS)[number];

const PLACEHOLDER_RE = /\$\{([^}]+)\}/g;

export function resolveProbeTemplate<T>(
  input: T,
  ctx: { identity: Record<string, string> },
): T {
  if (typeof input === "string") return resolveString(input, ctx) as unknown as T;
  if (Array.isArray(input)) {
    return input.map((v) => resolveProbeTemplate(v, ctx)) as unknown as T;
  }
  if (input && typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k] = resolveProbeTemplate(v, ctx);
    }
    return out as unknown as T;
  }
  return input;
}

function resolveString(s: string, ctx: { identity: Record<string, string> }): string {
  return s.replace(PLACEHOLDER_RE, (_, key: string) => {
    if (!(ALLOWED_PLACEHOLDERS as readonly string[]).includes(key)) {
      throw new Error(
        `placeholder \${${key}} is not allowed (allowed: ${ALLOWED_PLACEHOLDERS.join(", ")})`,
      );
    }
    const v = ctx.identity[key];
    if (v === undefined || v === "") {
      throw new Error(`missing identity value for placeholder \${${key}}`);
    }
    return v;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test cli/src/lib/probe-template.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add cli/src/lib/probe-template.ts cli/src/lib/probe-template.test.ts
git commit -m "feat(probe): minimal placeholder resolver (3 allowed identity keys)"
```

---

## Task 4: Implement `applyExtract`

**Files:**
- Create: `cli/src/lib/mcp-probe.ts`
- Test: `cli/src/lib/mcp-probe.test.ts`

- [ ] **Step 1: Write the failing test**

Create `cli/src/lib/mcp-probe.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyExtract } from "./mcp-probe.js";

const githubResponse = {
  login: "alex-kim",
  email: "Alex@Acme.com",
  name: "Alex Kim",
};

describe("applyExtract", () => {
  it("extracts a single field via jsonpath", () => {
    const out = applyExtract(
      { "user.github_login": { jsonpath: "$.login" } },
      githubResponse,
    );
    expect(out).toEqual([{ config_path: "user.github_login", value: "alex-kim" }]);
  });

  it("applies the lower transform", () => {
    const out = applyExtract(
      { "user.email": { jsonpath: "$.email", transform: "lower" } },
      githubResponse,
    );
    expect(out).toEqual([{ config_path: "user.email", value: "alex@acme.com" }]);
  });

  it("applies the trim transform", () => {
    const out = applyExtract(
      { "user.name": { jsonpath: "$.name", transform: "trim" } },
      { name: "  spaced  " },
    );
    expect(out).toEqual([{ config_path: "user.name", value: "spaced" }]);
  });

  it("applies the split_at_at transform (returns local-part)", () => {
    const out = applyExtract(
      { "user.local": { jsonpath: "$.email", transform: "split_at_at" } },
      { email: "alex@acme.com" },
    );
    expect(out).toEqual([{ config_path: "user.local", value: "alex" }]);
  });

  it("uses fallback when jsonpath returns nothing", () => {
    const out = applyExtract(
      {
        "team.timezone": { jsonpath: "$.tz", fallback: "UTC" },
      },
      {},
    );
    expect(out).toEqual([{ config_path: "team.timezone", value: "UTC" }]);
  });

  it("emits no contribution when neither jsonpath nor fallback yields a value", () => {
    const out = applyExtract(
      { "team.timezone": { jsonpath: "$.tz" } },
      {},
    );
    expect(out).toEqual([]);
  });

  it("returns multiple contributions for multiple rules", () => {
    const out = applyExtract(
      {
        "user.github_login": { jsonpath: "$.login" },
        "user.email": { jsonpath: "$.email", transform: "lower" },
      },
      githubResponse,
    );
    expect(out).toEqual([
      { config_path: "user.github_login", value: "alex-kim" },
      { config_path: "user.email", value: "alex@acme.com" },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test cli/src/lib/mcp-probe.test.ts -t "applyExtract"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `applyExtract`**

Create `cli/src/lib/mcp-probe.ts`:

```ts
import { JSONPath } from "jsonpath-plus";
import type { ProbeExtractRule } from "../types/probe.js";

export type AppliedExtraction = { config_path: string; value: unknown };

export function applyExtract(
  rules: Record<string, ProbeExtractRule>,
  response: unknown,
): AppliedExtraction[] {
  const out: AppliedExtraction[] = [];
  for (const [config_path, rule] of Object.entries(rules)) {
    const matches = JSONPath({ path: rule.jsonpath, json: response, wrap: true }) as unknown[];
    let value: unknown = matches.length ? matches[0] : undefined;
    if (value === undefined) {
      if (rule.fallback === undefined) continue;
      value = rule.fallback;
    } else {
      value = applyTransform(value, rule.transform);
    }
    out.push({ config_path, value });
  }
  return out;
}

function applyTransform(value: unknown, transform: ProbeExtractRule["transform"]): unknown {
  if (!transform) return value;
  if (typeof value !== "string") return value;
  switch (transform) {
    case "trim":
      return value.trim();
    case "lower":
      return value.toLowerCase();
    case "split_at_at":
      return value.split("@")[0] ?? value;
    case "first":
      return value;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test cli/src/lib/mcp-probe.test.ts -t "applyExtract"`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add cli/src/lib/mcp-probe.ts cli/src/lib/mcp-probe.test.ts
git commit -m "feat(probe): applyExtract evaluates jsonpath + transforms; returns contributions"
```

---

## Task 5: Implement `loadProbeRegistry`

**Files:**
- Modify: `cli/src/lib/mcp-probe.ts`
- Modify: `cli/src/lib/mcp-probe.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `cli/src/lib/mcp-probe.test.ts`:

```ts
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadProbeRegistry } from "./mcp-probe.js";

function makeProbeDir(): string {
  return mkdtempSync(join(tmpdir(), "probes-"));
}

const ghIdentity = {
  id: "github.identity",
  description: "GitHub user",
  needs_mcp: ["github"],
  tool: "get_me",
  read_only: true,
  extract: { "user.github_login": { jsonpath: "$.login" } },
  confidence: "high",
  contributes_to: ["user.github_login"],
};

describe("loadProbeRegistry", () => {
  it("loads valid probes from a directory", () => {
    const dir = makeProbeDir();
    try {
      writeFileSync(join(dir, "github.json"), JSON.stringify(ghIdentity), "utf8");
      const reg = loadProbeRegistry([dir]);
      expect(reg.probes).toHaveLength(1);
      expect(reg.probes[0].id).toBe("github.identity");
      expect(reg.errors).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects probes with read_only=false at load time", () => {
    const dir = makeProbeDir();
    try {
      writeFileSync(
        join(dir, "bad.json"),
        JSON.stringify({ ...ghIdentity, read_only: false }),
        "utf8",
      );
      const reg = loadProbeRegistry([dir]);
      expect(reg.probes).toHaveLength(0);
      expect(reg.errors).toHaveLength(1);
      expect(reg.errors[0]).toMatch(/read_only/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("merges probes from multiple dirs (overlay overrides core by id)", () => {
    const coreDir = makeProbeDir();
    const overlayDir = makeProbeDir();
    try {
      writeFileSync(
        join(coreDir, "gh.json"),
        JSON.stringify({ ...ghIdentity, description: "core ver" }),
        "utf8",
      );
      writeFileSync(
        join(overlayDir, "gh.json"),
        JSON.stringify({ ...ghIdentity, description: "overlay ver" }),
        "utf8",
      );
      const reg = loadProbeRegistry([coreDir, overlayDir]);
      expect(reg.probes).toHaveLength(1);
      expect(reg.probes[0].description).toBe("overlay ver");
    } finally {
      rmSync(coreDir, { recursive: true, force: true });
      rmSync(overlayDir, { recursive: true, force: true });
    }
  });

  it("ignores files starting with underscore", () => {
    const dir = makeProbeDir();
    try {
      writeFileSync(join(dir, "_mcp-map.json"), JSON.stringify({}), "utf8");
      writeFileSync(join(dir, "gh.json"), JSON.stringify(ghIdentity), "utf8");
      const reg = loadProbeRegistry([dir]);
      expect(reg.probes).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test cli/src/lib/mcp-probe.test.ts -t "loadProbeRegistry"`
Expected: FAIL — `loadProbeRegistry` not exported.

- [ ] **Step 3: Implement**

Append to `cli/src/lib/mcp-probe.ts`:

```ts
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ProbeSpecSchema, type ProbeSpec } from "../types/probe.js";

export type ProbeRegistry = { probes: ProbeSpec[]; errors: string[] };

export function loadProbeRegistry(dirs: string[]): ProbeRegistry {
  const byId = new Map<string, ProbeSpec>();
  const errors: string[] = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (!name.endsWith(".json")) continue;
      if (name.startsWith("_")) continue;
      const path = join(dir, name);
      let raw: unknown;
      try {
        raw = JSON.parse(readFileSync(path, "utf8"));
      } catch (e) {
        errors.push(`${path}: invalid JSON (${(e as Error).message})`);
        continue;
      }
      const parsed = ProbeSpecSchema.safeParse(raw);
      if (!parsed.success) {
        errors.push(`${path}: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
        continue;
      }
      // Last write wins → overlay (passed last) overrides core.
      byId.set(parsed.data.id, parsed.data);
    }
  }
  return { probes: Array.from(byId.values()), errors };
}

export function loadMcpMap(dirs: string[]): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const dir of dirs) {
    const file = join(dir, "_mcp-map.json");
    if (!existsSync(file)) continue;
    try {
      const raw = JSON.parse(readFileSync(file, "utf8")) as Record<string, string>;
      Object.assign(merged, raw);
    } catch {
      // ignore — overlay map errors are not fatal in v1
    }
  }
  return merged;
}
```

- [ ] **Step 4: Run tests**

Run: `bun test cli/src/lib/mcp-probe.test.ts`
Expected: 11 passed (4 new + 7 from Task 4).

- [ ] **Step 5: Commit**

```bash
git add cli/src/lib/mcp-probe.ts cli/src/lib/mcp-probe.test.ts
git commit -m "feat(probe): loadProbeRegistry merges core+overlay dirs; rejects read_only=false"
```

---

## Task 6: Implement `runProbes` with guard evaluation

**Files:**
- Modify: `cli/src/lib/mcp-probe.ts`
- Modify: `cli/src/lib/mcp-probe.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `cli/src/lib/mcp-probe.test.ts`:

```ts
import { runProbes } from "./mcp-probe.js";
import type { ProbeContext, ProbeSpec } from "../types/probe.js";

const ghProbe: ProbeSpec = {
  id: "github.identity",
  description: "GitHub user",
  needs_mcp: ["github"],
  tool: "get_me",
  read_only: true,
  extract: { "user.github_login": { jsonpath: "$.login" } },
  confidence: "high",
  contributes_to: ["user.github_login"],
};

const guardedProbe: ProbeSpec = {
  ...ghProbe,
  id: "guarded.thing",
  applies_when: { config_path: "user.email", is: "set" },
};

function makeCtx(overrides: Partial<ProbeContext> = {}): ProbeContext {
  return {
    projectRoot: "/tmp/p",
    draftConfig: {},
    mcpMap: { github: "github" },
    identity: {},
    shim: async () => ({ ok: true, body: { login: "alex-kim" } }),
    ...overrides,
  };
}

describe("runProbes", () => {
  it("invokes the shim and returns ok contributions", async () => {
    const out = await runProbes([ghProbe], makeCtx());
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe("ok");
    if (out[0].status === "ok") {
      expect(out[0].contributions).toEqual([
        {
          config_path: "user.github_login",
          value: "alex-kim",
          confidence: "high",
          probe_id: "github.identity",
          mcp_id: "github",
        },
      ]);
    }
  });

  it("skips probes whose needs_mcp is not in mcpMap", async () => {
    const out = await runProbes([ghProbe], makeCtx({ mcpMap: {} }));
    expect(out[0].status).toBe("skipped");
  });

  it("skips probes whose applies_when guard fails", async () => {
    const out = await runProbes([guardedProbe], makeCtx({ draftConfig: {} }));
    expect(out[0].status).toBe("skipped");
    if (out[0].status === "skipped") expect(out[0].reason).toMatch(/guard/);
  });

  it("runs probes whose applies_when guard passes", async () => {
    const out = await runProbes(
      [guardedProbe],
      makeCtx({ draftConfig: { user: { email: "a@b.c" } } }),
    );
    expect(out[0].status).toBe("ok");
  });

  it("captures shim errors as status=error", async () => {
    const out = await runProbes(
      [ghProbe],
      makeCtx({ shim: async () => ({ ok: false, error: "auth" }) }),
    );
    expect(out[0].status).toBe("error");
  });

  it("rewrites mcp_id from logical to physical via mcpMap", async () => {
    let receivedMcp = "";
    const out = await runProbes(
      [ghProbe],
      makeCtx({
        mcpMap: { github: "Github-Acme" },
        shim: async (env) => {
          receivedMcp = env.mcp_id;
          return { ok: true, body: { login: "x" } };
        },
      }),
    );
    expect(receivedMcp).toBe("Github-Acme");
    expect(out[0].status).toBe("ok");
  });

  it("resolves args templates against identity", async () => {
    let receivedArgs: Record<string, unknown> = {};
    const probe: ProbeSpec = {
      ...ghProbe,
      id: "glean.team_lookup",
      tool: "employee_search",
      args: { query: "${user.email}" },
    };
    await runProbes(
      [probe],
      makeCtx({
        mcpMap: { github: "github" },
        identity: { "user.email": "alex@acme.com" },
        shim: async (env) => {
          receivedArgs = env.args;
          return { ok: true, body: {} };
        },
      }),
    );
    expect(receivedArgs.query).toBe("alex@acme.com");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test cli/src/lib/mcp-probe.test.ts -t "runProbes"`
Expected: 7 failures.

- [ ] **Step 3: Implement `runProbes` and the guard evaluator**

Append to `cli/src/lib/mcp-probe.ts`:

```ts
import { resolveProbeTemplate } from "./probe-template.js";
import type {
  ProbeContext,
  ProbeGuard,
  ProbeResult,
  ProbeSpec,
} from "../types/probe.js";

function getAtPath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const k of parts) {
    if (cur && typeof cur === "object" && k in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[k];
    } else {
      return undefined;
    }
  }
  return cur;
}

function evaluateGuard(guard: ProbeGuard, draft: Record<string, unknown>): boolean {
  const v = getAtPath(draft, guard.config_path);
  switch (guard.is) {
    case "set":
      return v !== undefined && v !== null && v !== "";
    case "unset":
      return v === undefined || v === null || v === "";
    case "truthy":
      return Boolean(v);
    case "falsy":
      return !v;
  }
}

export async function runProbes(
  probes: ProbeSpec[],
  ctx: ProbeContext,
): Promise<ProbeResult[]> {
  const out: ProbeResult[] = [];
  for (const probe of probes) {
    const logicalMcp = probe.needs_mcp[0];
    const mcp_id = ctx.mcpMap[logicalMcp];
    if (!mcp_id) {
      out.push({
        probe_id: probe.id,
        mcp_id: logicalMcp,
        status: "skipped",
        reason: `mcp ${logicalMcp} not in mcpMap`,
      });
      continue;
    }
    if (probe.applies_when && !evaluateGuard(probe.applies_when, ctx.draftConfig)) {
      out.push({
        probe_id: probe.id,
        mcp_id,
        status: "skipped",
        reason: `guard ${probe.applies_when.config_path} ${probe.applies_when.is} failed`,
      });
      continue;
    }
    let resolvedArgs: Record<string, unknown> = {};
    try {
      resolvedArgs = resolveProbeTemplate(probe.args ?? {}, { identity: ctx.identity });
    } catch (e) {
      out.push({ probe_id: probe.id, mcp_id, status: "error", error: (e as Error).message });
      continue;
    }
    let response;
    try {
      response = await ctx.shim({
        probe_id: probe.id,
        mcp_id,
        tool: probe.tool,
        args: resolvedArgs,
      });
    } catch (e) {
      out.push({ probe_id: probe.id, mcp_id, status: "error", error: (e as Error).message });
      continue;
    }
    if (!response.ok) {
      out.push({ probe_id: probe.id, mcp_id, status: "error", error: response.error });
      continue;
    }
    const contribs = applyExtract(probe.extract, response.body).map((a) => ({
      ...a,
      confidence: probe.confidence,
      probe_id: probe.id,
      mcp_id,
    }));
    out.push({
      probe_id: probe.id,
      mcp_id,
      status: "ok",
      contributions: contribs,
      raw: response.body,
    });
  }
  return out;
}
```

- [ ] **Step 4: Run tests**

Run: `bun test cli/src/lib/mcp-probe.test.ts`
Expected: 18 passed (7 + 4 + 7).

- [ ] **Step 5: Commit**

```bash
git add cli/src/lib/mcp-probe.ts cli/src/lib/mcp-probe.test.ts
git commit -m "feat(probe): runProbes with guard eval, args templating, shim invocation"
```

---

## Task 7: Implement the fixture host-shim

**Files:**
- Create: `cli/src/lib/probe-fixture.ts`
- Test: `cli/src/lib/probe-fixture.test.ts`

- [ ] **Step 1: Write the failing test**

Create `cli/src/lib/probe-fixture.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadProbeFixture } from "./probe-fixture.js";

describe("loadProbeFixture", () => {
  it("returns a shim that looks up by (probe_id, mcp_id, tool)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fixture-"));
    const fixturePath = join(dir, "fixture.json");
    writeFileSync(
      fixturePath,
      JSON.stringify({
        responses: [
          {
            probe_id: "github.identity",
            mcp_id: "github",
            tool: "get_me",
            ok: true,
            body: { login: "alex-kim" },
          },
        ],
      }),
      "utf8",
    );
    const shim = loadProbeFixture(fixturePath);
    const r = await shim({ probe_id: "github.identity", mcp_id: "github", tool: "get_me", args: {} });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.body).toEqual({ login: "alex-kim" });
  });

  it("returns ok:false with error when no fixture matches", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fixture-"));
    const fixturePath = join(dir, "fixture.json");
    writeFileSync(fixturePath, JSON.stringify({ responses: [] }), "utf8");
    const shim = loadProbeFixture(fixturePath);
    const r = await shim({ probe_id: "x", mcp_id: "y", tool: "z", args: {} });
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test cli/src/lib/probe-fixture.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `cli/src/lib/probe-fixture.ts`:

```ts
import { readFileSync } from "node:fs";
import type { HostShim } from "../types/probe.js";

type FixtureResponse =
  | { probe_id: string; mcp_id: string; tool: string; ok: true; body: unknown }
  | { probe_id: string; mcp_id: string; tool: string; ok: false; error: string };

type FixtureFile = { responses: FixtureResponse[] };

export function loadProbeFixture(path: string): HostShim {
  const raw = JSON.parse(readFileSync(path, "utf8")) as FixtureFile;
  const byKey = new Map<string, FixtureResponse>();
  for (const r of raw.responses) {
    byKey.set(`${r.probe_id}::${r.mcp_id}::${r.tool}`, r);
  }
  return async (env) => {
    const r = byKey.get(`${env.probe_id}::${env.mcp_id}::${env.tool}`);
    if (!r) {
      return {
        ok: false,
        error: `no fixture for ${env.probe_id}/${env.mcp_id}/${env.tool}`,
      };
    }
    if (!r.ok) return { ok: false, error: r.error };
    return { ok: true, body: r.body };
  };
}

// withTimeout lives in mcp-probe.ts (it wraps any HostShim, not just the fixture). See that file.
```

- [ ] **Step 4: Add `withTimeout` to `mcp-probe.ts`**

Append to `cli/src/lib/mcp-probe.ts`:

```ts
import type { HostShim } from "../types/probe.js";

/** Wrap a host-shim with a per-call timeout. ms<=0 disables the timeout. */
export function withTimeout(shim: HostShim, ms: number): HostShim {
  if (ms <= 0) return shim;
  return async (env) => {
    let to: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        shim(env),
        new Promise<{ ok: false; error: string }>((res) => {
          to = setTimeout(
            () => res({ ok: false, error: `probe ${env.probe_id} timed out after ${ms}ms` }),
            ms,
          );
        }),
      ]);
    } finally {
      if (to) clearTimeout(to);
    }
  };
}
```

(`HostShim` is already imported above for `runProbes`; the duplicate import is harmless if collapsed.)

Append to `cli/src/lib/mcp-probe.test.ts`:

```ts
import { withTimeout } from "./mcp-probe.js";

describe("withTimeout", () => {
  it("resolves the inner shim's value when it returns in time", async () => {
    const shim = withTimeout(async () => ({ ok: true, body: { fast: true } }), 1000);
    const r = await shim({ probe_id: "p", mcp_id: "m", tool: "t", args: {} });
    expect(r.ok).toBe(true);
  });

  it("returns ok:false with timeout error after ms elapse", async () => {
    const shim = withTimeout(
      () => new Promise((resolve) => setTimeout(() => resolve({ ok: true, body: {} }), 200)),
      50,
    );
    const r = await shim({ probe_id: "p", mcp_id: "m", tool: "t", args: {} });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/timed out/);
  });
});
```

- [ ] **Step 5: Run tests**

Run: `bun test cli/src/lib/probe-fixture.test.ts cli/src/lib/mcp-probe.test.ts`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add cli/src/lib/probe-fixture.ts cli/src/lib/probe-fixture.test.ts cli/src/lib/mcp-probe.ts cli/src/lib/mcp-probe.test.ts
git commit -m "feat(probe): loadProbeFixture + withTimeout (timeout lives in mcp-probe.ts)"
```

---

## Task 8: Stub the agent host-shim (Claude Code)

**Files:**
- Create: `cli/src/lib/probe-agent-shim.ts`

The agent shim's contract: write the envelope to `process.stdout` as a marked line; the calling agent is expected to read it, invoke the MCP tool, and pipe the response back as a marked stdin line.

- [ ] **Step 1: Implement**

Create `cli/src/lib/probe-agent-shim.ts`:

```ts
import { createInterface } from "node:readline";
import type { HostShim, ProbeEnvelope, ProbeResponse } from "../types/probe.js";

const REQ_PREFIX = "::PROBE_REQUEST::";
const RES_PREFIX = "::PROBE_RESPONSE::";

/**
 * Agent host-shim: emit a request line to stdout; wait for a matching response on stdin.
 * The caller (an agent loop running this CLI as a subprocess, e.g. from the
 * jstack:setup skill) is responsible for reading the request, calling the real
 * MCP tool, and writing back a response line.
 *
 * Each envelope carries a monotonic sequence number; responses match by `seq`,
 * so two probes with the same (probe_id, mcp_id, tool) triple don't collide.
 *
 * v1 ships only the Claude Code path. Cursor/Codex use --probe-fixture.
 */
export function makeAgentShim(): HostShim {
  const rl = createInterface({ input: process.stdin, terminal: false });
  const pending = new Map<number, (r: ProbeResponse) => void>();
  let nextSeq = 1;
  rl.on("line", (line) => {
    if (!line.startsWith(RES_PREFIX)) return;
    const payload = line.slice(RES_PREFIX.length).trim();
    let parsed: { seq: number } & ProbeResponse;
    try {
      parsed = JSON.parse(payload);
    } catch {
      return;
    }
    if (typeof parsed.seq !== "number") return;
    const resolver = pending.get(parsed.seq);
    if (!resolver) return;
    pending.delete(parsed.seq);
    if ("ok" in parsed && parsed.ok) {
      resolver({ ok: true, body: (parsed as { body: unknown }).body });
    } else {
      resolver({ ok: false, error: (parsed as { error: string }).error ?? "unknown error" });
    }
  });
  return (env: ProbeEnvelope) =>
    new Promise<ProbeResponse>((resolve) => {
      const seq = nextSeq++;
      pending.set(seq, resolve);
      process.stdout.write(REQ_PREFIX + JSON.stringify({ ...env, seq }) + "\n");
    });
}
```

- [ ] **Step 2: Round-trip test using a child-process subprocess**

Create `cli/src/lib/probe-agent-shim.test.ts`. We can't safely re-shim `process.stdin`/`process.stdout` in the parent test process, so spawn a tiny inline child that imports the shim, sends one request, and we feed it a response.

```ts
import { describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { join } from "node:path";

const HARNESS = `
import { makeAgentShim } from "${join(__dirname, "probe-agent-shim.ts")}";
const shim = makeAgentShim();
shim({ probe_id: "p", mcp_id: "m", tool: "t", args: { q: "x" } })
  .then((r) => process.stdout.write("DONE:" + JSON.stringify(r) + "\\n"));
`;

describe("makeAgentShim (round-trip)", () => {
  it("matches request seq → response on stdin and resolves the promise", async () => {
    const child = spawn("bun", ["-e", HARNESS], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
    // Wait for the request line.
    await new Promise<void>((resolve) => {
      const t = setInterval(() => {
        if (stdout.includes("::PROBE_REQUEST::")) {
          clearInterval(t);
          resolve();
        }
      }, 20);
    });
    const reqLine = stdout.split("\n").find((l) => l.includes("::PROBE_REQUEST::"))!;
    const payload = JSON.parse(reqLine.slice(reqLine.indexOf("::PROBE_REQUEST::") + 17));
    expect(payload.probe_id).toBe("p");
    expect(typeof payload.seq).toBe("number");
    // Send the response with the same seq.
    child.stdin.write(
      "::PROBE_RESPONSE::" + JSON.stringify({ seq: payload.seq, ok: true, body: { hello: "world" } }) + "\n",
    );
    // Wait for DONE line.
    await new Promise<void>((resolve) => {
      const t = setInterval(() => {
        if (stdout.includes("DONE:")) {
          clearInterval(t);
          resolve();
        }
      }, 20);
    });
    child.kill();
    const doneLine = stdout.split("\n").find((l) => l.startsWith("DONE:"))!;
    const result = JSON.parse(doneLine.slice("DONE:".length));
    expect(result).toEqual({ ok: true, body: { hello: "world" } });
  }, 10_000);

  it("two concurrent requests with the same key resolve to their own responses (seq disambiguates)", async () => {
    const HARNESS_TWO = `
import { makeAgentShim } from "${join(__dirname, "probe-agent-shim.ts")}";
const shim = makeAgentShim();
const p1 = shim({ probe_id: "x", mcp_id: "m", tool: "t", args: {} });
const p2 = shim({ probe_id: "x", mcp_id: "m", tool: "t", args: {} });
Promise.all([p1, p2]).then((rs) => process.stdout.write("DONE:" + JSON.stringify(rs) + "\\n"));
`;
    const child = spawn("bun", ["-e", HARNESS_TWO], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
    await new Promise<void>((resolve) => {
      const t = setInterval(() => {
        const seqs = stdout.split("\n").filter((l) => l.includes("::PROBE_REQUEST::")).length;
        if (seqs >= 2) {
          clearInterval(t);
          resolve();
        }
      }, 20);
    });
    const reqLines = stdout.split("\n").filter((l) => l.includes("::PROBE_REQUEST::"));
    const payloads = reqLines.map((l) =>
      JSON.parse(l.slice(l.indexOf("::PROBE_REQUEST::") + 17)),
    );
    // Reply in REVERSE order to prove seq, not arrival, drives matching.
    child.stdin.write(
      "::PROBE_RESPONSE::" + JSON.stringify({ seq: payloads[1].seq, ok: true, body: { which: 2 } }) + "\n",
    );
    child.stdin.write(
      "::PROBE_RESPONSE::" + JSON.stringify({ seq: payloads[0].seq, ok: true, body: { which: 1 } }) + "\n",
    );
    await new Promise<void>((resolve) => {
      const t = setInterval(() => {
        if (stdout.includes("DONE:")) {
          clearInterval(t);
          resolve();
        }
      }, 20);
    });
    child.kill();
    const result = JSON.parse(
      stdout.split("\n").find((l) => l.startsWith("DONE:"))!.slice("DONE:".length),
    );
    expect(result).toEqual([{ ok: true, body: { which: 1 } }, { ok: true, body: { which: 2 } }]);
  }, 10_000);
});
```

Run: `bun test cli/src/lib/probe-agent-shim.test.ts`
Expected: 2 passed.

- [ ] **Step 3: Commit**

```bash
git add cli/src/lib/probe-agent-shim.ts cli/src/lib/probe-agent-shim.test.ts
git commit -m "feat(probe): agent host-shim — stdin/stdout envelope protocol (Claude Code)"
```

---

## Task 9: Implement `setup-auto.ts` orchestrator (aggregation)

**Files:**
- Create: `cli/src/lib/setup-auto.ts`
- Test: `cli/src/lib/setup-auto.test.ts`

- [ ] **Step 1: Write the failing test**

Create `cli/src/lib/setup-auto.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { aggregateContributions } from "./setup-auto.js";
import type { ProbeResult } from "../types/probe.js";

const okResult = (
  id: string,
  contributions: { config_path: string; value: unknown; confidence: "low" | "medium" | "high" }[],
): ProbeResult => ({
  probe_id: id,
  mcp_id: "x",
  status: "ok",
  contributions: contributions.map((c) => ({
    ...c,
    probe_id: id,
    mcp_id: "x",
  })),
  raw: {},
});

describe("aggregateContributions", () => {
  it("groups contributions by config path", () => {
    const out = aggregateContributions([
      okResult("a", [{ config_path: "team.name", value: "Platform", confidence: "high" }]),
      okResult("b", [
        { config_path: "user.email", value: "x@y.z", confidence: "high" },
      ]),
    ]);
    expect(out["team.name"]?.value).toBe("Platform");
    expect(out["user.email"]?.value).toBe("x@y.z");
  });

  it("on conflict, prefers higher confidence", () => {
    const out = aggregateContributions([
      okResult("low-prober", [
        { config_path: "team.name", value: "Wrong", confidence: "low" },
      ]),
      okResult("high-prober", [
        { config_path: "team.name", value: "Right", confidence: "high" },
      ]),
    ]);
    expect(out["team.name"]?.value).toBe("Right");
  });

  it("on conflict with same confidence, first wins (deterministic)", () => {
    const out = aggregateContributions([
      okResult("first", [
        { config_path: "team.name", value: "First", confidence: "medium" },
      ]),
      okResult("second", [
        { config_path: "team.name", value: "Second", confidence: "medium" },
      ]),
    ]);
    expect(out["team.name"]?.value).toBe("First");
  });

  it("ignores non-ok results", () => {
    const out = aggregateContributions([
      { probe_id: "x", mcp_id: "y", status: "skipped", reason: "guard" } as ProbeResult,
      { probe_id: "z", mcp_id: "y", status: "error", error: "boom" } as ProbeResult,
    ]);
    expect(out).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test cli/src/lib/setup-auto.test.ts -t "aggregateContributions"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `cli/src/lib/setup-auto.ts`:

```ts
import type { ProbeContribution, ProbeResult } from "../types/probe.js";

export type AggregatedConfig = Record<string, ProbeContribution>;

const CONFIDENCE_RANK: Record<ProbeContribution["confidence"], number> = {
  low: 0,
  medium: 1,
  high: 2,
};

export function aggregateContributions(results: ProbeResult[]): AggregatedConfig {
  const out: AggregatedConfig = {};
  for (const r of results) {
    if (r.status !== "ok") continue;
    for (const c of r.contributions) {
      const existing = out[c.config_path];
      if (!existing) {
        out[c.config_path] = c;
        continue;
      }
      if (CONFIDENCE_RANK[c.confidence] > CONFIDENCE_RANK[existing.confidence]) {
        out[c.config_path] = c;
      }
      // else: keep existing (first wins on tie → deterministic across runs)
    }
  }
  return out;
}
```

- [ ] **Step 4: Run tests**

Run: `bun test cli/src/lib/setup-auto.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add cli/src/lib/setup-auto.ts cli/src/lib/setup-auto.test.ts
git commit -m "feat(setup-auto): aggregate contributions by path with confidence-then-first ordering"
```

---

## Task 10: Implement `applyAggregatedToConfig` patch builder

**Files:**
- Modify: `cli/src/lib/setup-auto.ts`
- Modify: `cli/src/lib/setup-auto.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `cli/src/lib/setup-auto.test.ts`:

```ts
import { applyAggregatedToConfig } from "./setup-auto.js";

describe("applyAggregatedToConfig", () => {
  it("writes flat path values into a nested config", () => {
    const draft = {};
    const aggregated = {
      "team.name": { config_path: "team.name", value: "Platform", confidence: "high" as const, probe_id: "x", mcp_id: "y" },
      "user.email": { config_path: "user.email", value: "a@b.c", confidence: "high" as const, probe_id: "x", mcp_id: "y" },
    };
    const out = applyAggregatedToConfig(draft, aggregated);
    expect(out).toEqual({
      team: { name: "Platform" },
      user: { email: "a@b.c" },
    });
  });

  it("does not overwrite existing populated values (existing wins)", () => {
    const draft = { team: { name: "Existing" } };
    const aggregated = {
      "team.name": { config_path: "team.name", value: "FromProbe", confidence: "high" as const, probe_id: "x", mcp_id: "y" },
    };
    const out = applyAggregatedToConfig(draft, aggregated);
    expect(out).toEqual({ team: { name: "Existing" } });
  });

  it("array-index notation writes into arrays", () => {
    const aggregated = {
      "team.members[0].id": { config_path: "team.members[0].id", value: "alex-k", confidence: "high" as const, probe_id: "x", mcp_id: "y" },
      "team.members[0].github.login": { config_path: "team.members[0].github.login", value: "alex-kim", confidence: "high" as const, probe_id: "x", mcp_id: "y" },
    };
    const out = applyAggregatedToConfig({}, aggregated);
    expect(out).toEqual({
      team: { members: [{ id: "alex-k", github: { login: "alex-kim" } }] },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test cli/src/lib/setup-auto.test.ts -t "applyAggregatedToConfig"`
Expected: FAIL.

- [ ] **Step 3: Implement**

Append to `cli/src/lib/setup-auto.ts`:

```ts
const PATH_TOKEN_RE = /([^.\[\]]+)(?:\[(\d+)\])?/g;

type PathToken = { key: string; index?: number };

function parseConfigPath(path: string): PathToken[] {
  const tokens: PathToken[] = [];
  for (const m of path.matchAll(PATH_TOKEN_RE)) {
    const key = m[1];
    const idx = m[2];
    if (key) {
      tokens.push({ key, ...(idx !== undefined ? { index: Number(idx) } : {}) });
    }
  }
  return tokens;
}

function getAtTokens(obj: unknown, tokens: PathToken[]): unknown {
  let cur: unknown = obj;
  for (const t of tokens) {
    if (cur === undefined || cur === null) return undefined;
    cur = (cur as Record<string, unknown>)[t.key];
    if (t.index !== undefined) {
      cur = Array.isArray(cur) ? cur[t.index] : undefined;
    }
  }
  return cur;
}

function setAtTokens(
  obj: Record<string, unknown>,
  tokens: PathToken[],
  value: unknown,
): void {
  let cur: Record<string, unknown> | unknown[] = obj;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const isLast = i === tokens.length - 1;
    const owner = cur as Record<string, unknown>;
    if (!(t.key in owner)) {
      owner[t.key] = t.index !== undefined ? [] : isLast ? undefined : {};
    }
    let next = owner[t.key];
    if (t.index !== undefined) {
      if (!Array.isArray(next)) {
        next = [];
        owner[t.key] = next;
      }
      const arr = next as unknown[];
      while (arr.length <= t.index) arr.push({});
      if (isLast) {
        arr[t.index] = value;
        return;
      }
      cur = arr[t.index] as Record<string, unknown>;
      continue;
    }
    if (isLast) {
      owner[t.key] = value;
      return;
    }
    if (typeof next !== "object" || next === null || Array.isArray(next)) {
      next = {};
      owner[t.key] = next;
    }
    cur = next as Record<string, unknown>;
  }
}

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === "";
}

export function applyAggregatedToConfig(
  draft: Record<string, unknown>,
  aggregated: AggregatedConfig,
): Record<string, unknown> {
  const out: Record<string, unknown> = JSON.parse(JSON.stringify(draft));
  for (const [path, contrib] of Object.entries(aggregated)) {
    const tokens = parseConfigPath(path);
    const existing = getAtTokens(out, tokens);
    if (!isEmpty(existing)) continue;
    setAtTokens(out, tokens, contrib.value);
  }
  return out;
}
```

- [ ] **Step 4: Run tests**

Run: `bun test cli/src/lib/setup-auto.test.ts`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add cli/src/lib/setup-auto.ts cli/src/lib/setup-auto.test.ts
git commit -m "feat(setup-auto): applyAggregatedToConfig writes flat paths into nested draft"
```

---

## Task 11: Provenance sidecar reader/writer

**Files:**
- Modify: `cli/src/lib/config.ts`
- Modify: `cli/src/lib/setup-auto.ts`
- Test: `cli/src/lib/config.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `cli/src/lib/config.test.ts`:

```ts
import { writeProvenance, readProvenance } from "./config.js";

describe("provenance sidecar", () => {
  it("writes and reads .jstack/setup-auto-provenance.json", () => {
    const root = mkdtempSync(join(tmpdir(), "prov-"));
    try {
      writeProvenance(root, {
        version: 1,
        captured_at: "2026-04-28T00:00:00Z",
        contributions: [
          {
            config_path: "team.name",
            probe_id: "glean.team_lookup",
            mcp_id: "gleangusto",
            confidence: "high",
            human_edited: false,
          },
        ],
      });
      const read = readProvenance(root);
      expect(read?.contributions[0].config_path).toBe("team.name");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("readProvenance returns null when file is absent", () => {
    const root = mkdtempSync(join(tmpdir(), "prov-empty-"));
    try {
      expect(readProvenance(root)).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test cli/src/lib/config.test.ts -t "provenance"`
Expected: FAIL.

- [ ] **Step 3: Implement**

Append to `cli/src/lib/config.ts`:

```ts
import { mkdirSync as nodeMkdirSync } from "node:fs";

export type ProvenanceContribution = {
  config_path: string;
  probe_id: string;
  mcp_id: string;
  confidence: "low" | "medium" | "high";
  human_edited: boolean;
};

export type ProvenanceFile = {
  version: 1;
  captured_at: string;
  contributions: ProvenanceContribution[];
};

const PROVENANCE_REL = ".jstack/setup-auto-provenance.json";

export function readProvenance(projectRoot: string): ProvenanceFile | null {
  const path = join(projectRoot, PROVENANCE_REL);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as ProvenanceFile;
  } catch {
    return null;
  }
}

export function writeProvenance(projectRoot: string, data: ProvenanceFile): void {
  const path = join(projectRoot, PROVENANCE_REL);
  nodeMkdirSync(join(projectRoot, ".jstack"), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}
```

- [ ] **Step 4: Run tests**

Run: `bun test cli/src/lib/config.test.ts`
Expected: existing tests + 2 new pass.

- [ ] **Step 5: Commit**

```bash
git add cli/src/lib/config.ts cli/src/lib/config.test.ts
git commit -m "feat(setup-auto): provenance sidecar at .jstack/setup-auto-provenance.json"
```

---

## Task 12: Ship core probes

**Files:**
- Create: `config/probes/_mcp-map.json`
- Create: `config/probes/github-identity.json`
- Create: `config/probes/slack-identity.json`
- Create: `config/probes/jira-projects.json`
- Create: `config/probes/notion-workspace.json`

- [ ] **Step 1: Write the identity MCP map**

Create `config/probes/_mcp-map.json`:

```json
{
  "atlassian": "atlassian",
  "github": "github",
  "notion": "notion",
  "slack": "slack",
  "pagerduty": "pagerduty",
  "datadog": "datadog",
  "glean": "glean",
  "dx": "dx",
  "gcal": "gcal",
  "gdrive": "gdrive"
}
```

- [ ] **Step 2: Write the four core probes**

Create `config/probes/github-identity.json`:

```json
{
  "id": "github.identity",
  "description": "Read the current GitHub user identity (login + email)",
  "needs_mcp": ["github"],
  "tool": "get_me",
  "read_only": true,
  "extract": {
    "user.github_login": { "jsonpath": "$.login" },
    "user.email": { "jsonpath": "$.email", "transform": "lower" }
  },
  "confidence": "high",
  "contributes_to": ["user.github_login", "user.email"]
}
```

Create `config/probes/slack-identity.json`:

```json
{
  "id": "slack.identity",
  "description": "Read the current Slack user profile",
  "needs_mcp": ["slack"],
  "tool": "slack_read_user_profile",
  "read_only": true,
  "extract": {
    "user.slack_user_id": { "jsonpath": "$.profile.user_id" },
    "team.timezone": { "jsonpath": "$.profile.tz" }
  },
  "confidence": "medium",
  "contributes_to": ["user.slack_user_id", "team.timezone"]
}
```

Create `config/probes/jira-projects.json`:

```json
{
  "id": "atlassian.projects",
  "description": "List visible Jira projects to seed integrations.jira",
  "needs_mcp": ["atlassian"],
  "tool": "getVisibleJiraProjects",
  "read_only": true,
  "extract": {
    "integrations.jira.project_key": { "jsonpath": "$.values[0].key" },
    "integrations.jira.base_url": { "jsonpath": "$.cloud_url" }
  },
  "confidence": "medium",
  "contributes_to": ["integrations.jira.project_key", "integrations.jira.base_url"]
}
```

Create `config/probes/notion-workspace.json`:

```json
{
  "id": "notion.workspace",
  "description": "Find a top-level Notion page to identify the workspace",
  "needs_mcp": ["notion"],
  "tool": "notion-search",
  "args": { "query": "" },
  "read_only": true,
  "extract": {
    "integrations.notion.workspace_id": { "jsonpath": "$.results[0].workspace_id" }
  },
  "confidence": "low",
  "contributes_to": ["integrations.notion.workspace_id"]
}
```

- [ ] **Step 3: Add a load-time test**

Append to `cli/src/lib/mcp-probe.test.ts`:

```ts
import { join as joinPath } from "node:path";

it("loads the four core probes shipped in jstack.core/config/probes", () => {
  const dir = joinPath(__dirname, "..", "..", "..", "config", "probes");
  const reg = loadProbeRegistry([dir]);
  expect(reg.errors).toEqual([]);
  const ids = reg.probes.map((p) => p.id).sort();
  expect(ids).toEqual([
    "atlassian.projects",
    "github.identity",
    "notion.workspace",
    "slack.identity",
  ]);
});
```

- [ ] **Step 4: Run tests**

Run: `bun test cli/src/lib/mcp-probe.test.ts`
Expected: 19 passed.

- [ ] **Step 5: Commit**

```bash
git add config/probes/
git commit -m "feat(probes): ship 4 agnostic core probes (github/slack/jira/notion identity)"
```

---

## Task 13: `runSetupAuto` driver — end-to-end

**Files:**
- Modify: `cli/src/lib/setup-auto.ts`
- Modify: `cli/src/lib/setup-auto.test.ts`
- Create: `tests/fixtures/probes/golden-core.json`
- Create: `tests/fixtures/probes/golden-core.expected.json`

- [ ] **Step 1: Create the fixture**

Create `tests/fixtures/probes/golden-core.json`:

```json
{
  "responses": [
    {
      "probe_id": "github.identity",
      "mcp_id": "github",
      "tool": "get_me",
      "ok": true,
      "body": { "login": "alex-kim", "email": "Alex@Acme.com" }
    },
    {
      "probe_id": "slack.identity",
      "mcp_id": "slack",
      "tool": "slack_read_user_profile",
      "ok": true,
      "body": { "profile": { "user_id": "U12345", "tz": "America/Los_Angeles" } }
    },
    {
      "probe_id": "atlassian.projects",
      "mcp_id": "atlassian",
      "tool": "getVisibleJiraProjects",
      "ok": true,
      "body": { "values": [{ "key": "PLT", "name": "Platform" }], "cloud_url": "https://acme.atlassian.net" }
    },
    {
      "probe_id": "notion.workspace",
      "mcp_id": "notion",
      "tool": "notion-search",
      "ok": true,
      "body": { "results": [{ "workspace_id": "ws-1234" }] }
    }
  ]
}
```

Create `tests/fixtures/probes/golden-core.expected.json`:

```json
{
  "user": { "github_login": "alex-kim", "email": "alex@acme.com", "slack_user_id": "U12345" },
  "team": { "timezone": "America/Los_Angeles" },
  "integrations": {
    "jira": { "project_key": "PLT", "base_url": "https://acme.atlassian.net" },
    "notion": { "workspace_id": "ws-1234" }
  }
}
```

- [ ] **Step 2: Write the failing end-to-end test**

Append to `cli/src/lib/setup-auto.test.ts`:

```ts
import { join as joinPath } from "node:path";
import { readFileSync } from "node:fs";
import { runSetupAuto } from "./setup-auto.js";
import { loadProbeFixture } from "./probe-fixture.js";

function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) {
    return v.map(sortDeep).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v).sort()) {
      out[k] = sortDeep((v as Record<string, unknown>)[k]);
    }
    return out;
  }
  return v;
}

describe("runSetupAuto (golden file)", () => {
  it("produces the expected merged config from a fixture", async () => {
    const probesDir = joinPath(__dirname, "..", "..", "..", "config", "probes");
    const shim = loadProbeFixture(
      joinPath(__dirname, "..", "..", "..", "tests", "fixtures", "probes", "golden-core.json"),
    );
    const out = await runSetupAuto({
      probeDirs: [probesDir],
      mcpMapDirs: [probesDir],
      draft: {},
      shim,
    });
    const expected = JSON.parse(
      readFileSync(
        joinPath(__dirname, "..", "..", "..", "tests", "fixtures", "probes", "golden-core.expected.json"),
        "utf8",
      ),
    );
    expect(sortDeep(out.config)).toEqual(sortDeep(expected));
    expect(out.results.every((r) => r.status !== "error")).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test cli/src/lib/setup-auto.test.ts -t "golden file"`
Expected: FAIL — `runSetupAuto` not yet implemented.

- [ ] **Step 4: Implement `runSetupAuto`**

Append to `cli/src/lib/setup-auto.ts`:

```ts
import { loadMcpMap, loadProbeRegistry, runProbes } from "./mcp-probe.js";
import type { HostShim, ProbeResult } from "../types/probe.js";

export type RunSetupAutoOptions = {
  probeDirs: string[];
  mcpMapDirs: string[];
  draft: Record<string, unknown>;
  shim: HostShim;
};

export type RunSetupAutoOutput = {
  config: Record<string, unknown>;
  aggregated: AggregatedConfig;
  results: ProbeResult[];
};

const IDENTITY_KEYS = [
  "user.email",
  "user.github_login",
  "team.canonical_group.slack_user_group_id",
] as const;

function buildIdentityFromDraft(draft: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of IDENTITY_KEYS) {
    const tokens = parseConfigPath(key);
    const v = getAtTokens(draft, tokens);
    if (typeof v === "string" && v.length > 0) out[key] = v;
  }
  return out;
}

/**
 * Two-stage runner. Stage 1: probes with no `args` (identity probes — github.identity,
 * slack.identity, atlassian.projects, etc.). Their contributions populate the identity
 * map (`user.email`, `user.github_login`, `team.canonical_group.slack_user_group_id`).
 * Stage 2: probes with `args` (which can reference identity placeholders).
 *
 * Limitation: a stage-2 probe cannot consume the *output* of another stage-2 probe.
 * If a future probe needs that, add a third stage or refactor to a topological-sort
 * runner. v1 doesn't need it.
 */
export async function runSetupAuto(opts: RunSetupAutoOptions): Promise<RunSetupAutoOutput> {
  const { probes, errors } = loadProbeRegistry(opts.probeDirs);
  if (errors.length) {
    throw new Error(`probe registry errors:\n${errors.join("\n")}`);
  }
  const mcpMap = loadMcpMap(opts.mcpMapDirs);

  // Stage 1: identity probes (no args templating).
  const identityProbes = probes.filter((p) => !p.args || Object.keys(p.args).length === 0);
  const stage1 = await runProbes(identityProbes, {
    projectRoot: "",
    draftConfig: opts.draft,
    mcpMap,
    identity: {},
    shim: opts.shim,
  });
  const stage1Aggregated = aggregateContributions(stage1);
  let merged = applyAggregatedToConfig(opts.draft, stage1Aggregated);
  const identity = buildIdentityFromDraft(merged);

  // Stage 2: probes with args (need identity).
  const argProbes = probes.filter((p) => p.args && Object.keys(p.args).length > 0);
  const stage2 = await runProbes(argProbes, {
    projectRoot: "",
    draftConfig: merged,
    mcpMap,
    identity,
    shim: opts.shim,
  });
  const stage2Aggregated = aggregateContributions(stage2);
  merged = applyAggregatedToConfig(merged, stage2Aggregated);

  const allAggregated: AggregatedConfig = { ...stage1Aggregated, ...stage2Aggregated };
  return { config: merged, aggregated: allAggregated, results: [...stage1, ...stage2] };
}
```

- [ ] **Step 5: Run tests**

Run: `bun test cli/src/lib/setup-auto.test.ts`
Expected: 8 passed including the golden-file case.

- [ ] **Step 6: Commit**

```bash
git add cli/src/lib/setup-auto.ts cli/src/lib/setup-auto.test.ts tests/fixtures/probes/
git commit -m "feat(setup-auto): runSetupAuto two-stage runner with identity then args probes"
```

---

## Task 14: Wire `setup --auto` into the CLI

> **Note:** uses `findCoreAndOverlay` from PR-1 Task 9b — not added separately here.

### UX requirements (resolved during Round 1 design review)

- **Spinner during probe execution.** Each probe takes 200ms–1.1s; with 9 probes that's up to ~9s of dead air. Use `@clack/prompts` `spinner()` API: one spinner per probe, message includes `probe.id` and the resolved MCP id. The spinner reports `done` (✔) on success, `info` (○) on skip, `error` (✗) on error.
- **Edit path semantics.** When the user picks `[e]dit` on a contributed field, `@clack/prompts.text()` is invoked with `initialValue` set to the contributed value and the field's display name as the message. The user types and confirms; the new value replaces the contribution. Skip records the field for omission. Accept passes through. The implementation lives inline in the review loop; no separate file.
- **`@clack/prompts` capability check.** Section-level "Accept all" and ↑↓ navigation are NOT native to `@clack/prompts`. v1 implementation: render each section as a `groupMultiselect` whose options are `Accept` / `Edit` / `Skip` per field; user navigates with default `j/k` or `↑/↓` per multiselect, and the `Accept all in section` shortcut is a special first option in each group. If a future iteration needs richer UI, swap to `enquirer` or `inquirer` then.
- **Snapshot/restore.** Before `writeConfig` succeeds, the existing `jstack.config.json` (if any) is copied to `.jstack/setup-auto-prev.json`. A `--restore` flag swaps it back atomically. **One-step depth only**: a second `setup --auto --write` overwrites the snapshot, so `--restore` always recovers the most recent prior state. Documented in the Task 14 README update; user surface message says "Restored your previous config (one step back)."
- **Empty-section UX.** When every probe in a section was skipped or errored, the review screen prints `(no contributions for this section — all probes skipped or errored. Re-run with --probe-debug to see why.)` instead of an empty list, and the section is not navigable. Implementation is one early-return in the section-render loop.
- **`[d]iscuss` semantics in the auto review.** Unlike the schema-driven setup wizard, probed fields have no canned `discussion` text. Pressing `d` in the auto review prints a structured provenance card and re-prompts:
  ```
  Source:    probe glean.team_lookup
  MCP:       gleangusto.employee_search
  Args:      {"query": "alex@gusto.com"}
  Confidence: high
  Raw match: $.results[0].team.name → "Platform Engineering"
  ```
  No LLM call. The card is rendered from `ProbeResult.raw` and the matching `extract` rule. If the user wants a long-form explanation, they re-run `setup --schema --resume-auto` and use that wizard's `[d]iscuss` (which is the schema spec's responsibility, not this PR's).

**Files:**
- Modify: `cli/src/commands/setup.ts`
- Modify: `cli/src/index.ts`
- Modify: `cli/src/types/cli-registry.ts`

- [ ] **Step 1: Add CLI flags**

In `cli/src/index.ts`, locate the `setup` command registration and add:

```ts
.option("--auto", "MCP-driven probe-based draft (Claude Code host or --probe-fixture)")
.option("--probe-fixture <file>", "JSON fixture file of MCP responses (for tests/CI)")
.option("--write", "Skip schema-driven review; write probed config directly (with confirm)")
.option("--yes", "Skip the final write confirmation prompt")
.option("--resume-auto", "Bridge into setup --schema with seeded answers from prior --auto run")
.option("--restore", "Atomically restore the previous jstack.config.json from .jstack/setup-auto-prev.json")
```

In `cli/src/types/cli-registry.ts`, mirror these options on the `setup` row.

- [ ] **Step 2: Wire `runSetupAutoCommand` in `cli/src/commands/setup.ts`**

Add a new exported function below `runSetup`:

```ts
import { join } from "node:path";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { findPluginRoot, findProjectRoot, readConfigOptional, writeConfig, writeProvenance } from "../lib/config.js";
import { runSetupAuto } from "../lib/setup-auto.js";
import { loadProbeFixture } from "../lib/probe-fixture.js";
import { makeAgentShim } from "../lib/probe-agent-shim.js";
import { findCoreAndOverlay } from "../lib/overlay.js";
import { JstackConfigSchema } from "../types/config.js";

export async function runSetupAutoCommand(opts: {
  probeFixture?: string;
  write?: boolean;
  yes?: boolean;
  restore?: boolean;
}): Promise<void> {
  const projectRoot = findProjectRoot();

  // --restore short-circuits everything else.
  if (opts.restore) {
    const snapshot = join(projectRoot, ".jstack", "setup-auto-prev.json");
    const target = join(projectRoot, "jstack.config.json");
    if (!existsSync(snapshot)) {
      console.error(
        "No snapshot at .jstack/setup-auto-prev.json. " +
          "Restore is available only after a prior setup --auto --write run.",
      );
      process.exit(1);
      return;
    }
    copyFileSync(snapshot, target);
    console.log("Restored your previous config (one step back).");
    return;
  }

  const { corePath, overlay } = findCoreAndOverlay();
  const probeDirs = [join(corePath, "config", "probes")];
  if (overlay) probeDirs.push(join(overlay.absolute_path, "config", "probes"));
  const mcpMapDirs = probeDirs;
  const existing = readConfigOptional(projectRoot) ?? {};
  const shim = opts.probeFixture ? loadProbeFixture(opts.probeFixture) : makeAgentShim();

  console.log(`✔ Loaded core (0.1.0)${overlay ? ` and overlay "${overlay.id}"` : ""}`);
  console.log(`─── Running probes against ${probeDirs.length} probe dir(s)`);

  const out = await runSetupAuto({
    probeDirs,
    mcpMapDirs,
    draft: existing as Record<string, unknown>,
    shim,
  });

  for (const r of out.results) {
    const tag = r.status === "ok" ? "✔" : r.status === "skipped" ? "○" : "✗";
    const detail = r.status === "ok"
      ? `${r.contributions.length} contribs`
      : r.status === "skipped"
        ? r.reason
        : r.error;
    console.log(`  ${tag} ${r.probe_id} (${r.mcp_id}) — ${detail}`);
  }

  if (opts.write) {
    if (!opts.yes) {
      const p = await import("@clack/prompts");
      const ok = await p.confirm({ message: "Write probed config to disk?", initialValue: true });
      if (!ok) {
        console.log("Cancelled.");
        return;
      }
    }
    // Snapshot existing config for --restore before overwriting.
    const existingPath = join(projectRoot, "jstack.config.json");
    if (existsSync(existingPath)) {
      const snapshotDir = join(projectRoot, ".jstack");
      mkdirSync(snapshotDir, { recursive: true });
      const snapshot = join(snapshotDir, "setup-auto-prev.json");
      copyFileSync(existingPath, snapshot);
    }
    const parsed = JstackConfigSchema.parse(out.config);
    writeConfig(projectRoot, parsed);
    writeProvenance(projectRoot, {
      version: 1,
      captured_at: new Date().toISOString(),
      contributions: Object.values(out.aggregated).map((c) => ({
        config_path: c.config_path,
        probe_id: c.probe_id,
        mcp_id: c.mcp_id,
        confidence: c.confidence,
        human_edited: false,
      })),
    });
    console.log("Wrote jstack.config.json and .jstack/setup-auto-provenance.json.");
    return;
  }

  console.log("\n--write not set; passing aggregated draft to schema-driven review.");
  console.log("Run `jstack setup --schema --resume-auto` to review and persist.");
}
```

In `runSetup` (the existing exported function in this file), add at the very top:

```ts
const o = opts as Record<string, unknown>;
if (o.auto || o.restore) {
  return runSetupAutoCommand({
    probeFixture: o.probeFixture as string | undefined,
    write: Boolean(o.write),
    yes: Boolean(o.yes),
    restore: Boolean(o.restore),
  });
}
```

- [ ] **Step 3: Update the index handler**

In `cli/src/index.ts`, the `setup` action handler must pass the new options through to `runSetup`. If the existing handler only forwards a known set, expand it:

```ts
.action(async (opts) => {
  await runSetup({
    reconfigure: opts.reconfigure,
    withGbrainKb: opts.withGbrainKb,
    pe: opts.pe,
    auto: opts.auto,
    probeFixture: opts.probeFixture,
    write: opts.write,
    yes: opts.yes,
    resumeAuto: opts.resumeAuto,
    restore: opts.restore,
  });
});
```

Also update `runSetup`'s parameter type accordingly.

- [ ] **Step 4: Smoke test**

Run: `bun cli/src/index.ts setup --auto --probe-fixture tests/fixtures/probes/golden-core.json --write --yes`

In a temporary project root with no existing config:

```bash
mkdir -p /tmp/setup-auto-smoke && cd /tmp/setup-auto-smoke
JSTACK_PLUGIN_ROOT=/Users/jonathan.boice/Documents/GitHub/jstack/jstack.core \
CLAUDE_PLUGIN_ROOT=/Users/jonathan.boice/Documents/GitHub/jstack/jstack.core \
bun /Users/jonathan.boice/Documents/GitHub/jstack/jstack.core/cli/src/index.ts \
  setup --auto \
  --probe-fixture /Users/jonathan.boice/Documents/GitHub/jstack/jstack.core/tests/fixtures/probes/golden-core.json \
  --write --yes
cat jstack.config.json | head -40
cat .jstack/setup-auto-provenance.json | head -20
```

Expected: jstack.config.json contains `team.timezone`, `integrations.jira.project_key`, etc., matching the golden expected fixture.

- [ ] **Step 5: Add a CLI integration test**

Create `cli/src/commands/setup-auto.contract.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CORE_ROOT = join(__dirname, "..", "..", "..");
const FIXTURE = join(CORE_ROOT, "tests", "fixtures", "probes", "golden-core.json");

describe("jstack setup --auto --probe-fixture --write --yes", () => {
  it("writes a deterministic jstack.config.json", () => {
    const proj = mkdtempSync(join(tmpdir(), "setup-auto-"));
    try {
      execSync(
        `bun ${join(CORE_ROOT, "cli", "src", "index.ts")} setup --auto --probe-fixture ${FIXTURE} --write --yes`,
        {
          cwd: proj,
          env: { ...process.env, CLAUDE_PLUGIN_ROOT: CORE_ROOT },
          encoding: "utf8",
        },
      );
      const cfg = JSON.parse(readFileSync(join(proj, "jstack.config.json"), "utf8"));
      expect(cfg.user?.github_login).toBe("alex-kim");
      expect(cfg.user?.email).toBe("alex@acme.com");
      expect(cfg.integrations?.jira?.project_key).toBe("PLT");
    } finally {
      rmSync(proj, { recursive: true, force: true });
    }
  });

  it("--restore returns the previous jstack.config.json byte-for-byte", () => {
    const proj = mkdtempSync(join(tmpdir(), "setup-auto-restore-"));
    try {
      // Seed an existing config.
      const original = JSON.stringify(
        { team: { name: "Original", timezone: "UTC" } },
        null,
        2,
      );
      writeFileSync(join(proj, "jstack.config.json"), original + "\n", "utf8");
      // Run --auto --write to overwrite (and snapshot).
      execSync(
        `bun ${join(CORE_ROOT, "cli", "src", "index.ts")} setup --auto --probe-fixture ${FIXTURE} --write --yes`,
        { cwd: proj, env: { ...process.env, CLAUDE_PLUGIN_ROOT: CORE_ROOT }, encoding: "utf8" },
      );
      const probed = readFileSync(join(proj, "jstack.config.json"), "utf8");
      expect(probed).not.toEqual(original + "\n");
      // Restore.
      execSync(
        `bun ${join(CORE_ROOT, "cli", "src", "index.ts")} setup --auto --restore`,
        { cwd: proj, env: { ...process.env, CLAUDE_PLUGIN_ROOT: CORE_ROOT }, encoding: "utf8" },
      );
      const restored = readFileSync(join(proj, "jstack.config.json"), "utf8");
      expect(restored).toEqual(original + "\n");
    } finally {
      rmSync(proj, { recursive: true, force: true });
    }
  });
});
```

Run: `bun test cli/src/commands/setup-auto.contract.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add cli/src/commands/setup.ts cli/src/index.ts cli/src/types/cli-registry.ts cli/src/commands/setup-auto.contract.test.ts
git commit -m "feat(setup): wire --auto/--probe-fixture/--write/--yes/--resume-auto flags"
```

---

## Task 15: Bridge `--resume-auto` into the schema-driven setup

**Files:**
- Modify: `cli/src/commands/setup.ts`
- Modify: `cli/src/lib/setup-auto.ts` (add `seedAnswersFromAggregated`)

This task assumes the schema-driven setup spec has landed and exposes either `runSetupSchema(opts)` from `cli/src/commands/setup-schema.ts` or a similar entry point. **If schema-driven setup is not yet merged, defer this task.**

- [ ] **Step 1: Implement seed exporter**

Append to `cli/src/lib/setup-auto.ts`:

```ts
export type SeedAnswerMap = Record<string, unknown>;

export function seedAnswersFromAggregated(aggregated: AggregatedConfig): SeedAnswerMap {
  const out: SeedAnswerMap = {};
  for (const [path, contrib] of Object.entries(aggregated)) {
    out[path] = contrib.value;
  }
  return out;
}
```

- [ ] **Step 2: Plumb the seed into the schema flow**

In `runSetupAutoCommand`, when `--write` is NOT set, write a temp `.jstack/setup-auto-seed.json` with `seedAnswersFromAggregated(out.aggregated)` and invoke (or instruct user to run) `setup --schema --resume-auto`.

`setup-schema.ts` should look for `.jstack/setup-auto-seed.json`; if present, use those values as `initialValue` for matching `QuestionSpec` paths.

- [ ] **Step 3: Add a contract test**

Create `cli/src/commands/setup-resume.contract.test.ts`:

```ts
// Pseudocode — concrete test depends on schema-driven setup's CLI surface.
// Verifies that:
//   1. setup --auto (without --write) writes .jstack/setup-auto-seed.json.
//   2. setup --schema --resume-auto reads it and uses values as initial values.
//   3. After completion, the seed file is removed.
```

Run: skip if schema-driven setup hasn't shipped yet.

- [ ] **Step 4: Commit**

```bash
git add cli/src/lib/setup-auto.ts cli/src/commands/setup.ts cli/src/commands/setup-resume.contract.test.ts
git commit -m "feat(setup-auto): bridge --resume-auto seeds schema-driven wizard"
```

---

## Task 16: Documentation in plugin README

**Files:**
- Modify: `README.md` (jstack.core root) — append a `### setup --auto` subsection under "Setup".

- [ ] **Step 1: Append to README under "Option 1: Interactive CLI wizard"**

Insert after the existing wizard description:

````markdown
### Option 1b: MCP-driven auto-discovery (`setup --auto`)

```bash
./cli/bin/jstack setup --auto
```

Walks the configured MCPs, runs read-only probes (e.g. `github.get_me`, `slack.read_user_profile`, `getVisibleJiraProjects`), and proposes a draft config. Probes are declarative JSON in `config/probes/*.json` (core + overlay). Each contribution is shown with its source MCP and confidence level; you accept, edit, or skip per field before write.

- `--probe-fixture <file>` — read responses from a JSON file (used for tests and on hosts without MCP support).
- `--write` — skip the schema-driven review and write the probed draft directly (with one final confirm; `--yes` skips that confirm).
- `--resume-auto` — pipe results into `setup --schema` so you review every field with the probed values seeded.
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs(setup-auto): document --auto flow in README"
```

---

## Task 17: Final integration check

**Files:**
- (none — verifications only.)

- [ ] **Step 1: Full test suite**

Run: `bun test`
Expected: all pass.

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: clean.

- [ ] **Step 3: Eval validate**

Run: `bun run eval validate`
Expected: pass.

- [ ] **Step 4: Verify pipeline**

Run: `bun run verify`
Expected: green.

- [ ] **Step 5: Manual smoke**

Run the smoke test from Task 14 Step 4 again.

PR-2 is now ready. Push and open a PR titled "PR-2: probe registry + `setup --auto`". Reference the spec.

---

## Spec coverage check

| Spec section | PR-2 task |
|--------------|-----------|
| §4.2 ProbeSpec types | Task 2 |
| §4.2 generic logical ids + `_mcp-map.json` | Task 5 (`loadMcpMap`), Task 12 (core map), |
| §4.2.1 host-shim contract | Task 7 (fixture), Task 8 (agent), Task 13 (used in runner) |
| §4.2.2 load-time validation (`read_only:true`, ≥1 extract) | Task 5 |
| §4.3 `setup --auto` flow steps 1–9 | Task 13, Task 14 |
| §4.3 provenance sidecar | Task 11 |
| §6 PM #3 deterministic golden-file | Task 13, Task 14 |
| §6 Eng "no global state" | Tasks 4–6, 9–10 |
| §8 probe registry rejects `read_only:false` | Task 5 |
| §8 probe extract applied to fixture | Task 4 |
| §8 probe `applies_when` skips on guard fail | Task 6 |
| §8 `runProbes` deterministic | Task 13 |
| §8 `setup --auto --probe-fixture` writes nothing without confirm | Task 14 |
| §8 `setup --auto --probe-fixture --write --yes` deterministic | Task 14 |
| §10 #3 minimal template language (3 placeholders) | Task 3 |
| §10 #4 v1 ships only for Claude Code; fixture for others | Tasks 7, 8 |
| §10 #2 CLI never reads tokens | (no token reads anywhere; no test needed — absence verified by grep against `process.env.*TOKEN`) |

All in-scope spec items are covered.

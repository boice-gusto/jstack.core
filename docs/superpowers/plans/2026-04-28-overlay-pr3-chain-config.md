# PR-3: Chain Config + `jstack chain` Command — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote the human-readable `prompts/chains/*.md` files to a typed `config/chains.json` registry. Add a `jstack chain` command (`list`, `show`, `validate`, `run`) that loads chains from core and overlay, attributes them by source, and walks step-by-step in an agent host.

**Architecture:** New `cli/src/lib/chain-engine.ts` loads chain config from core + overlay (overlay overrides by id), validates each `step.skill` against the existing skill catalog, and exposes `runChain()` for an agent host to drive. `prompts/chains/*.md` becomes the `narrative` field on each chain entry — those files are not removed.

**Tech Stack:** TypeScript, Bun, Zod, `@clack/prompts`, `vitest`.

**Spec:** [`../specs/2026-04-28-overlay-registry-and-setup-auto-design.md`](../specs/2026-04-28-overlay-registry-and-setup-auto-design.md) §4.4.

**Working directory:** `/Users/jonathan.boice/Documents/GitHub/jstack/jstack.core`.

**Depends on:** PR-1 (`cli/src/lib/overlay.ts`).

**Adopted decisions from spec §10:** `--auto-yes` runtime override is supported; chain-step-level `requires_user: true` opts out of `--auto-yes` for that step.

---

## File Structure

### New files

| Path | Responsibility |
|------|----------------|
| `cli/src/types/chain.ts` | `ChainSpec`, `ChainStepSpec`, `ChainRegistry` types and zod schemas. |
| `cli/src/lib/chain-engine.ts` | `loadChainRegistry()`, `validateChain()`, `resolveChainNarrative()`, `runChain()`. |
| `cli/src/commands/chain.ts` | CLI subcommand handlers: `list`, `show <id>`, `validate`, `run <id>`. |
| `cli/src/types/chain.test.ts` | Schema parse tests. |
| `cli/src/lib/chain-engine.test.ts` | Loader, overlay-overrides-core, validate-against-skills, narrative resolve. |
| `cli/src/commands/chain.test.ts` | CLI command output tests. |
| `config/chains.json` | The three core chains migrated from `prompts/chains/*.md`. |

### Modified files

| Path | Why |
|------|-----|
| `cli/src/index.ts` | Register the new `chain` subcommand and its `list/show/run/validate` actions, plus `--auto-yes` flag. |
| `cli/src/types/cli-registry.ts` | Mirror the new commands in the registry. |
| `prompts/chains/intake-to-sprint-chain.md` | Add a small frontmatter footer pointing back at `config/chains.json` (optional, no behavior change). |
| `prompts/chains/incident-response-chain.md` | Same. |
| `prompts/chains/sprint-close-chain.md` | Same. |

### Touch-light

- `cli/src/lib/overlay.ts` — no change.
- `skills/_core/references/chaining-guide.md` — optional doc update; not required for green tests.

---

## Task 1: Chain types and zod schemas

**Files:**
- Create: `cli/src/types/chain.ts`
- Test: `cli/src/types/chain.test.ts`

- [ ] **Step 1: Write the failing test**

Create `cli/src/types/chain.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ChainSpecSchema } from "./chain.js";

const minimal = {
  title: "Intake → Sprint",
  steps: [
    { skill: "jstack:intake", wait_for_user: true },
    { skill: "jstack:prioritize", wait_for_user: true, config: { rubric: "RICE" } },
  ],
};

describe("ChainSpecSchema", () => {
  it("parses a minimal chain", () => {
    const parsed = ChainSpecSchema.parse(minimal);
    expect(parsed.steps).toHaveLength(2);
    expect(parsed.steps[0].wait_for_user).toBe(true);
  });

  it("rejects chains with zero steps", () => {
    expect(() =>
      ChainSpecSchema.parse({ title: "x", steps: [] }),
    ).toThrow();
  });

  it("rejects step.skill with whitespace", () => {
    expect(() =>
      ChainSpecSchema.parse({
        title: "x",
        steps: [{ skill: "jstack: invalid", wait_for_user: true }],
      }),
    ).toThrow();
  });

  it("accepts requires_user opt-out for --auto-yes", () => {
    const parsed = ChainSpecSchema.parse({
      title: "x",
      steps: [{ skill: "jstack:y", wait_for_user: true, requires_user: true }],
    });
    expect(parsed.steps[0].requires_user).toBe(true);
  });

  it("accepts optional narrative path", () => {
    const parsed = ChainSpecSchema.parse({
      ...minimal,
      narrative: "prompts/chains/intake-to-sprint-chain.md",
    });
    expect(parsed.narrative).toBe("prompts/chains/intake-to-sprint-chain.md");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test cli/src/types/chain.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `cli/src/types/chain.ts`:

```ts
import { z } from "zod";

const SKILL_RE = /^[a-z0-9][a-z0-9:_/-]*$/;

export const ChainStepSpecSchema = z
  .object({
    skill: z.string().regex(SKILL_RE, "skill must be lowercase, no whitespace"),
    wait_for_user: z.boolean().default(true),
    requires_user: z.boolean().default(false),
    config: z.record(z.unknown()).optional(),
    note: z.string().optional(),
  })
  .strict();

export const ChainSpecSchema = z
  .object({
    title: z.string().min(1),
    narrative: z.string().optional(),
    steps: z.array(ChainStepSpecSchema).min(1, "chain must have at least one step"),
    config_hooks: z.array(z.string()).optional(),
  })
  .strict();

export type ChainStepSpec = z.infer<typeof ChainStepSpecSchema>;
export type ChainSpec = z.infer<typeof ChainSpecSchema>;

export const ChainsFileSchema = z
  .object({
    chains: z.record(ChainSpecSchema),
  })
  .strict();

export type ChainsFile = z.infer<typeof ChainsFileSchema>;

export type ResolvedChain = ChainSpec & {
  id: string;
  source: "core" | { overlay: string };
  source_path: string;
};
```

- [ ] **Step 4: Run tests**

Run: `bun test cli/src/types/chain.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add cli/src/types/chain.ts cli/src/types/chain.test.ts
git commit -m "feat(chain): ChainSpec/ChainStepSpec types with auto-yes opt-out"
```

---

## Task 2: Migrate core chains to `config/chains.json`

**Files:**
- Create: `config/chains.json`

- [ ] **Step 1: Author the file**

Create `config/chains.json` derived from the three existing `prompts/chains/*.md` documents:

```json
{
  "chains": {
    "intake_to_sprint": {
      "title": "Intake → Sprint",
      "narrative": "prompts/chains/intake-to-sprint-chain.md",
      "steps": [
        { "skill": "jstack:intake",          "wait_for_user": true },
        { "skill": "jstack:prioritize",      "wait_for_user": true, "config": { "rubric": "RICE" } },
        { "skill": "jstack:sprint-planning", "wait_for_user": true }
      ],
      "config_hooks": [
        "chains.intake_to_sprint.rubric",
        "chains.intake_to_sprint.capacity_source",
        "chains.intake_to_sprint.spill_threshold_pct"
      ]
    },
    "incident_response": {
      "title": "Incident Response",
      "narrative": "prompts/chains/incident-response-chain.md",
      "steps": [
        { "skill": "jstack:incident:triage",                 "wait_for_user": true, "requires_user": true },
        { "skill": "jstack:incident:reconcile-timeline",     "wait_for_user": true },
        { "skill": "jstack:incident:contributing-factors",   "wait_for_user": true },
        { "skill": "jstack:postmortem:create-postmortem",    "wait_for_user": true },
        { "skill": "jstack:postmortem:review-action-items",  "wait_for_user": true }
      ]
    },
    "sprint_close": {
      "title": "Sprint Close",
      "narrative": "prompts/chains/sprint-close-chain.md",
      "steps": [
        { "skill": "jstack:sprint:retro",         "wait_for_user": true },
        { "skill": "jstack:sprint:metrics",       "wait_for_user": true },
        { "skill": "jstack:reports:weekly-digest","wait_for_user": true },
        { "skill": "jstack:notion:publish",       "wait_for_user": true }
      ]
    }
  }
}
```

- [ ] **Step 2: Validate the file parses against the schema**

Run a one-shot:

```bash
bun -e 'import("./cli/src/types/chain.js").then(({ChainsFileSchema}) => { const d = JSON.parse(require("node:fs").readFileSync("config/chains.json","utf8")); ChainsFileSchema.parse(d); console.log("ok"); })'
```

Expected: `ok`.

- [ ] **Step 3: Commit**

```bash
git add config/chains.json
git commit -m "feat(chains): migrate intake_to_sprint, incident_response, sprint_close to config"
```

---

## Task 3: Implement `loadChainRegistry`

**Files:**
- Create: `cli/src/lib/chain-engine.ts`
- Test: `cli/src/lib/chain-engine.test.ts`

- [ ] **Step 1: Write the failing test**

Create `cli/src/lib/chain-engine.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadChainRegistry } from "./chain-engine.js";

function makeChainsFile(dir: string, chains: Record<string, unknown>): string {
  const path = join(dir, "chains.json");
  writeFileSync(path, JSON.stringify({ chains }), "utf8");
  return path;
}

describe("loadChainRegistry", () => {
  it("loads core chains and tags source", () => {
    const root = mkdtempSync(join(tmpdir(), "chain-"));
    try {
      const corePath = makeChainsFile(root, {
        intake: {
          title: "Intake",
          steps: [{ skill: "jstack:intake", wait_for_user: true }],
        },
      });
      const reg = loadChainRegistry({ corePath });
      expect(reg.chains).toHaveLength(1);
      expect(reg.chains[0].id).toBe("intake");
      expect(reg.chains[0].source).toBe("core");
      expect(reg.chains[0].source_path).toBe(corePath);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("merges overlay chains; overlay overrides core by id", () => {
    const root = mkdtempSync(join(tmpdir(), "chain-"));
    const overlayDir = join(root, "overlay");
    mkdirSync(overlayDir);
    try {
      const corePath = makeChainsFile(root, {
        intake: { title: "Core Intake", steps: [{ skill: "jstack:intake", wait_for_user: true }] },
        sprint_close: { title: "Sprint", steps: [{ skill: "jstack:sprint", wait_for_user: true }] },
      });
      const overlayPath = makeChainsFile(overlayDir, {
        intake: { title: "Overlay Intake", steps: [{ skill: "jstack:intake-org", wait_for_user: true }] },
      });
      const reg = loadChainRegistry({
        corePath,
        overlay: { id: "acme", chainsFile: overlayPath },
      });
      expect(reg.chains).toHaveLength(2);
      const intake = reg.chains.find((c) => c.id === "intake");
      expect(intake?.title).toBe("Overlay Intake");
      expect(intake?.source).toEqual({ overlay: "acme" });
      const close = reg.chains.find((c) => c.id === "sprint_close");
      expect(close?.source).toBe("core");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns errors on invalid chain", () => {
    const root = mkdtempSync(join(tmpdir(), "chain-"));
    try {
      const corePath = makeChainsFile(root, {
        bad: { title: "Bad", steps: [] },
      });
      const reg = loadChainRegistry({ corePath });
      expect(reg.chains).toHaveLength(0);
      expect(reg.errors[0]).toMatch(/at least one step/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns empty when neither file is present", () => {
    const reg = loadChainRegistry({ corePath: "/nope/chains.json" });
    expect(reg.chains).toEqual([]);
    expect(reg.errors).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test cli/src/lib/chain-engine.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `cli/src/lib/chain-engine.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import { ChainsFileSchema, type ResolvedChain, type ChainSpec } from "../types/chain.js";

export type LoadChainOptions = {
  corePath: string;
  overlay?: { id: string; chainsFile: string };
};

export type ChainRegistry = {
  chains: ResolvedChain[];
  errors: string[];
};

function readChains(path: string): { ok: true; chains: Record<string, ChainSpec> } | { ok: false; error: string } {
  if (!existsSync(path)) return { ok: true, chains: {} };
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    return { ok: false, error: `${path}: invalid JSON (${(e as Error).message})` };
  }
  const parsed = ChainsFileSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: `${path}: ${parsed.error.issues.map((i) => i.message).join("; ")}` };
  }
  return { ok: true, chains: parsed.data.chains };
}

export function loadChainRegistry(opts: LoadChainOptions): ChainRegistry {
  const errors: string[] = [];
  const core = readChains(opts.corePath);
  let coreChains: Record<string, ChainSpec> = {};
  if (core.ok) coreChains = core.chains;
  else errors.push(core.error);

  let overlayChains: Record<string, ChainSpec> = {};
  if (opts.overlay) {
    const ov = readChains(opts.overlay.chainsFile);
    if (ov.ok) overlayChains = ov.chains;
    else errors.push(ov.error);
  }

  const merged: ResolvedChain[] = [];
  const seen = new Set<string>();
  for (const [id, spec] of Object.entries(overlayChains)) {
    merged.push({
      ...spec,
      id,
      source: { overlay: opts.overlay!.id },
      source_path: opts.overlay!.chainsFile,
    });
    seen.add(id);
  }
  for (const [id, spec] of Object.entries(coreChains)) {
    if (seen.has(id)) continue;
    merged.push({ ...spec, id, source: "core", source_path: opts.corePath });
    seen.add(id);
  }
  merged.sort((a, b) => a.id.localeCompare(b.id));
  return { chains: merged, errors };
}
```

- [ ] **Step 4: Run tests**

Run: `bun test cli/src/lib/chain-engine.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add cli/src/lib/chain-engine.ts cli/src/lib/chain-engine.test.ts
git commit -m "feat(chain): loadChainRegistry merges core+overlay; tags source per chain"
```

---

## Task 4: Implement `validateChain` against skill catalog

**Files:**
- Modify: `cli/src/lib/chain-engine.ts`
- Modify: `cli/src/lib/chain-engine.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `cli/src/lib/chain-engine.test.ts`:

```ts
import { validateChain } from "./chain-engine.js";

describe("validateChain", () => {
  const knownSkills = new Set(["jstack:intake", "jstack:prioritize"]);

  it("returns no issues when all step.skill are known", () => {
    const issues = validateChain(
      {
        title: "x",
        steps: [
          { skill: "jstack:intake", wait_for_user: true, requires_user: false },
          { skill: "jstack:prioritize", wait_for_user: true, requires_user: false },
        ],
      },
      knownSkills,
    );
    expect(issues).toEqual([]);
  });

  it("returns one issue per unknown skill", () => {
    const issues = validateChain(
      {
        title: "x",
        steps: [
          { skill: "jstack:nope-1", wait_for_user: true, requires_user: false },
          { skill: "jstack:nope-2", wait_for_user: true, requires_user: false },
        ],
      },
      knownSkills,
    );
    expect(issues).toHaveLength(2);
    expect(issues[0]).toMatch(/jstack:nope-1/);
    expect(issues[1]).toMatch(/jstack:nope-2/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test cli/src/lib/chain-engine.test.ts -t "validateChain"`
Expected: FAIL — `validateChain` not exported.

- [ ] **Step 3: Implement**

Append to `cli/src/lib/chain-engine.ts`:

```ts
import type { ChainSpec } from "../types/chain.js";

export function validateChain(chain: ChainSpec, knownSkills: Set<string>): string[] {
  const issues: string[] = [];
  for (const [i, step] of chain.steps.entries()) {
    if (!knownSkills.has(step.skill)) {
      issues.push(`step ${i + 1}: unknown skill "${step.skill}"`);
    }
  }
  return issues;
}
```

- [ ] **Step 4: Run tests**

Run: `bun test cli/src/lib/chain-engine.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add cli/src/lib/chain-engine.ts cli/src/lib/chain-engine.test.ts
git commit -m "feat(chain): validateChain reports unknown skills against the catalog"
```

---

## Task 5: Helper to load known skill ids

**Files:**
- Modify: `cli/src/lib/chain-engine.ts`
- Modify: `cli/src/lib/chain-engine.test.ts`

- [ ] **Step 1: Write the failing test**

Append to the test file:

```ts
it("loadKnownSkillIds reads SKILL.md frontmatter from a skills tree", () => {
  const root = mkdtempSync(join(tmpdir(), "skills-"));
  try {
    mkdirSync(join(root, "skills", "intake"), { recursive: true });
    writeFileSync(
      join(root, "skills", "intake", "SKILL.md"),
      "---\nname: jstack:intake\ndescription: x\n---\nbody",
      "utf8",
    );
    mkdirSync(join(root, "skills", "prioritize"), { recursive: true });
    writeFileSync(
      join(root, "skills", "prioritize", "SKILL.md"),
      "---\nname: jstack:prioritize\ndescription: x\n---\nbody",
      "utf8",
    );
    const ids = loadKnownSkillIds([join(root, "skills")]);
    expect(ids.has("jstack:intake")).toBe(true);
    expect(ids.has("jstack:prioritize")).toBe(true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

Add to imports: `import { loadKnownSkillIds } from "./chain-engine.js";`

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test cli/src/lib/chain-engine.test.ts -t "loadKnownSkillIds"`
Expected: FAIL.

- [ ] **Step 3: Implement**

Append to `cli/src/lib/chain-engine.ts`:

```ts
import { readdirSync, statSync } from "node:fs";
import { join as joinPath } from "node:path";

const SKILL_NAME_RE = /^name:\s*(\S+)/m;

function walk(dir: string, hits: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const full = joinPath(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, hits);
    else if (st.isFile() && name === "SKILL.md") hits.push(full);
  }
}

export function loadKnownSkillIds(skillsRoots: string[]): Set<string> {
  const hits: string[] = [];
  for (const root of skillsRoots) walk(root, hits);
  const ids = new Set<string>();
  for (const path of hits) {
    let body: string;
    try {
      body = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    const m = body.match(SKILL_NAME_RE);
    if (m && m[1]) ids.add(m[1]);
  }
  return ids;
}
```

- [ ] **Step 4: Run tests**

Run: `bun test cli/src/lib/chain-engine.test.ts`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add cli/src/lib/chain-engine.ts cli/src/lib/chain-engine.test.ts
git commit -m "feat(chain): loadKnownSkillIds scans SKILL.md frontmatter for chain validation"
```

---

## Task 6: `runChain` (agent-driven walker)

**Files:**
- Modify: `cli/src/lib/chain-engine.ts`
- Modify: `cli/src/lib/chain-engine.test.ts`

`runChain` does not invoke skills directly (the CLI process has no agent). Instead, it emits step envelopes and pauses for the agent host to drive the next step. The CLI surface respects `--auto-yes` to skip pauses on steps where `requires_user !== true`.

- [ ] **Step 1: Write the failing test**

Append to the test file:

```ts
import { runChain } from "./chain-engine.js";
import type { ResolvedChain } from "../types/chain.js";

const sampleChain: ResolvedChain = {
  id: "x",
  title: "X",
  steps: [
    { skill: "jstack:a", wait_for_user: true, requires_user: false },
    { skill: "jstack:b", wait_for_user: true, requires_user: true },
    { skill: "jstack:c", wait_for_user: true, requires_user: false },
  ],
  source: "core",
  source_path: "/tmp/chains.json",
};

describe("runChain", () => {
  it("emits one envelope per step", async () => {
    const envelopes: string[] = [];
    await runChain(sampleChain, {
      autoYes: false,
      promptUser: async () => "continue",
      emit: (e) => envelopes.push(e.step.skill),
    });
    expect(envelopes).toEqual(["jstack:a", "jstack:b", "jstack:c"]);
  });

  it("with --auto-yes, skips prompts EXCEPT on requires_user steps", async () => {
    const prompts: string[] = [];
    await runChain(sampleChain, {
      autoYes: true,
      promptUser: async (msg: string) => {
        prompts.push(msg);
        return "continue";
      },
      emit: () => {},
    });
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toMatch(/jstack:b/);
  });

  it("aborts when promptUser returns 'abort'", async () => {
    const envelopes: string[] = [];
    await runChain(sampleChain, {
      autoYes: false,
      promptUser: async () => "abort",
      emit: (e) => envelopes.push(e.step.skill),
    });
    expect(envelopes).toEqual(["jstack:a"]); // only first step emitted before abort
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test cli/src/lib/chain-engine.test.ts -t "runChain"`
Expected: FAIL.

- [ ] **Step 3: Implement**

Append to `cli/src/lib/chain-engine.ts`:

```ts
import type { ChainStepSpec } from "../types/chain.js";

export type RunChainEnvelope = {
  chain_id: string;
  step_index: number;
  step: ChainStepSpec;
};

export type RunChainOptions = {
  autoYes: boolean;
  promptUser: (message: string) => Promise<"continue" | "abort">;
  emit: (envelope: RunChainEnvelope) => void;
};

export type RunChainResult = {
  status: "completed" | "aborted";
  steps_emitted: number;
};

export async function runChain(
  chain: ResolvedChain,
  opts: RunChainOptions,
): Promise<RunChainResult> {
  let emitted = 0;
  for (const [i, step] of chain.steps.entries()) {
    opts.emit({ chain_id: chain.id, step_index: i, step });
    emitted++;
    const isLast = i === chain.steps.length - 1;
    if (isLast) break;
    const skipPause = opts.autoYes && !step.requires_user;
    if (skipPause) continue;
    const next = await opts.promptUser(
      `Step ${i + 1}/${chain.steps.length} (${step.skill}) complete. Continue?`,
    );
    if (next === "abort") {
      return { status: "aborted", steps_emitted: emitted };
    }
  }
  return { status: "completed", steps_emitted: emitted };
}
```

- [ ] **Step 4: Run tests**

Run: `bun test cli/src/lib/chain-engine.test.ts`
Expected: 10 passed.

- [ ] **Step 5: Commit**

```bash
git add cli/src/lib/chain-engine.ts cli/src/lib/chain-engine.test.ts
git commit -m "feat(chain): runChain emits step envelopes; honors --auto-yes + requires_user opt-out"
```

---

## Task 7: `chain.ts` CLI command (`list`, `show`, `validate`, `run`)

**Files:**
- Create: `cli/src/commands/chain.ts`
- Test: `cli/src/commands/chain.test.ts`

- [ ] **Step 1: Write the failing test**

Create `cli/src/commands/chain.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { runChainList, runChainShow, runChainValidate } from "./chain.js";

vi.mock("../lib/chain-engine.js", async () => {
  const actual = await vi.importActual<typeof import("../lib/chain-engine.js")>(
    "../lib/chain-engine.js",
  );
  return {
    ...actual,
    loadChainRegistry: () => ({
      chains: [
        {
          id: "intake_to_sprint",
          title: "Intake → Sprint",
          source: "core",
          source_path: "/x/config/chains.json",
          steps: [{ skill: "jstack:intake", wait_for_user: true, requires_user: false }],
        },
        {
          id: "gusto-postmortem-flow",
          title: "Gusto Postmortem",
          source: { overlay: "gusto" },
          source_path: "/y/config/chains.json",
          steps: [
            { skill: "jstack:postmortem:create", wait_for_user: true, requires_user: false },
            { skill: "jstack:notion:publish", wait_for_user: true, requires_user: false },
          ],
        },
      ],
      errors: [],
    }),
    loadKnownSkillIds: () => new Set(["jstack:intake", "jstack:postmortem:create", "jstack:notion:publish"]),
  };
});

describe("runChainList", () => {
  it("lists chains with overlay attribution", () => {
    const out = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      runChainList();
      const text = out.mock.calls.flat().join("\n");
      expect(text).toMatch(/intake_to_sprint\s+\(core\)\s+1 step/);
      expect(text).toMatch(/gusto-postmortem-flow\s+\(overlay:gusto\)\s+2 steps/);
    } finally {
      out.mockRestore();
    }
  });
});

describe("runChainShow", () => {
  it("prints title, source, and steps", () => {
    const out = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      runChainShow("intake_to_sprint");
      const text = out.mock.calls.flat().join("\n");
      expect(text).toMatch(/Intake → Sprint/);
      expect(text).toMatch(/jstack:intake/);
    } finally {
      out.mockRestore();
    }
  });

  it("prints error and exits non-zero on unknown id", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const exit = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);
    try {
      runChainShow("nope");
      expect(err).toHaveBeenCalled();
      expect(exit).toHaveBeenCalledWith(1);
    } finally {
      err.mockRestore();
      exit.mockRestore();
    }
  });
});

describe("runChainValidate", () => {
  it("passes when every step.skill is in the catalog", () => {
    const out = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const code = runChainValidate();
      expect(code).toBe(0);
    } finally {
      out.mockRestore();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test cli/src/commands/chain.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `cli/src/commands/chain.ts`:

```ts
import { join } from "node:path";
import * as p from "@clack/prompts";
import chalk from "chalk";
import { findCoreAndOverlay } from "../lib/overlay.js";
import {
  loadChainRegistry,
  loadKnownSkillIds,
  validateChain,
  runChain,
  type ResolvedChain,
} from "../lib/chain-engine.js";

function pluralStep(n: number): string {
  return n === 1 ? "1 step" : `${n} steps`;
}

function formatSource(source: ResolvedChain["source"]): string {
  return source === "core" ? "core" : `overlay:${source.overlay}`;
}

function getRegistry() {
  const { corePath, overlay } = findCoreAndOverlay({
    cwd: process.cwd(),
    env: process.env,
    coreVersion: "0.1.0",
  });
  const reg = loadChainRegistry({
    corePath: join(corePath, "config", "chains.json"),
    overlay: overlay
      ? { id: overlay.id, chainsFile: join(overlay.absolute_path, "config", "chains.json") }
      : undefined,
  });
  return { reg, corePath, overlay };
}

export function runChainList(): void {
  const { reg } = getRegistry();
  if (reg.errors.length) {
    for (const e of reg.errors) console.warn(chalk.yellow(`! ${e}`));
  }
  console.log(chalk.bold("Chains"));
  for (const c of reg.chains) {
    console.log(
      `  ${c.id.padEnd(28)} (${formatSource(c.source).padEnd(20)}) ${pluralStep(c.steps.length)}`,
    );
  }
}

export function runChainShow(id: string): void {
  const { reg } = getRegistry();
  const chain = reg.chains.find((c) => c.id === id);
  if (!chain) {
    console.error(chalk.red(`Unknown chain "${id}". Try \`jstack chain list\`.`));
    process.exit(1);
    return;
  }
  console.log(chalk.bold(`${chain.id} (${chain.title})`));
  console.log(`  Source:    ${formatSource(chain.source)}`);
  console.log(`  Source path: ${chain.source_path}`);
  if (chain.narrative) console.log(`  Narrative: ${chain.narrative}`);
  console.log(`  Steps:`);
  for (const [i, s] of chain.steps.entries()) {
    const tag = s.requires_user ? " [requires_user]" : "";
    console.log(`    ${i + 1}. ${s.skill}${tag}`);
    if (s.config) {
      console.log(`       config: ${JSON.stringify(s.config)}`);
    }
  }
}

export function runChainValidate(): number {
  const { reg, corePath, overlay } = getRegistry();
  if (reg.errors.length) {
    for (const e of reg.errors) console.error(chalk.red(`✗ ${e}`));
    return 1;
  }
  const skillsDirs = [join(corePath, "skills")];
  if (overlay) skillsDirs.push(join(overlay.absolute_path, "skills"));
  const known = loadKnownSkillIds(skillsDirs);
  let bad = 0;
  for (const c of reg.chains) {
    const issues = validateChain(c, known);
    if (issues.length === 0) {
      console.log(chalk.green(`✔ ${c.id}`));
      continue;
    }
    bad++;
    console.error(chalk.red(`✗ ${c.id}`));
    for (const i of issues) console.error(`    ${i}`);
  }
  return bad === 0 ? 0 : 1;
}

export async function runChainRun(id: string, opts: { autoYes?: boolean }): Promise<void> {
  const { reg } = getRegistry();
  const chain = reg.chains.find((c) => c.id === id);
  if (!chain) {
    console.error(chalk.red(`Unknown chain "${id}".`));
    process.exit(1);
    return;
  }
  console.log(chalk.bold(`Running chain: ${chain.id} (${chain.steps.length} steps)`));
  const res = await runChain(chain, {
    autoYes: Boolean(opts.autoYes),
    promptUser: async (msg) => {
      const ok = await p.confirm({ message: msg, initialValue: true });
      if (p.isCancel(ok) || !ok) return "abort";
      return "continue";
    },
    emit: (envelope) => {
      console.log(
        chalk.dim(`[chain] step ${envelope.step_index + 1}/${chain.steps.length}: ${envelope.step.skill}`),
      );
    },
  });
  console.log(
    res.status === "completed"
      ? chalk.green(`✔ Chain ${chain.id} completed (${res.steps_emitted} steps).`)
      : chalk.yellow(`! Chain ${chain.id} aborted after ${res.steps_emitted} step(s).`),
  );
}
```

- [ ] **Step 4: Run tests**

Run: `bun test cli/src/commands/chain.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add cli/src/commands/chain.ts cli/src/commands/chain.test.ts
git commit -m "feat(chain): jstack chain list/show/validate/run with overlay attribution"
```

---

## Task 8: Wire `chain` subcommand into the CLI

**Files:**
- Modify: `cli/src/index.ts`
- Modify: `cli/src/types/cli-registry.ts`

- [ ] **Step 1: Register the subcommand**

In `cli/src/index.ts`, add:

```ts
import {
  runChainList,
  runChainRun,
  runChainShow,
  runChainValidate,
} from "./commands/chain.js";

const chain = program.command("chain").description("List, show, validate, and run jstack chains");

chain
  .command("list")
  .description("List all registered chains (core + overlay)")
  .action(() => runChainList());

chain
  .command("show <id>")
  .description("Print a chain's title, source, narrative, and steps")
  .action((id: string) => runChainShow(id));

chain
  .command("validate")
  .description("Validate every step.skill against the skill catalog")
  .action(() => process.exit(runChainValidate()));

chain
  .command("run <id>")
  .description("Walk a chain step-by-step (agent host)")
  .option("--auto-yes", "Skip pauses except on steps with requires_user=true")
  .action((id: string, opts: { autoYes?: boolean }) => runChainRun(id, opts));
```

In `cli/src/types/cli-registry.ts`, add a `chain` row mirroring the four subcommands.

- [ ] **Step 2: Smoke test**

```bash
cd /Users/jonathan.boice/Documents/GitHub/jstack/jstack.core
bun cli/src/index.ts chain list
bun cli/src/index.ts chain show intake_to_sprint
bun cli/src/index.ts chain validate
```

Expected:
- `list` shows three chains tagged `(core)`.
- `show` prints the title and the three steps.
- `validate` either passes (`✔` for each chain) or reports unknown-skill issues. If issues are reported, the test catalog is missing — verify `bun run agents-check` passes first.

- [ ] **Step 3: Add a CLI integration test**

Create `cli/src/commands/chain.contract.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { join } from "node:path";

const CORE = join(__dirname, "..", "..", "..");

describe("jstack chain CLI", () => {
  it("`chain list` prints the three core chains", () => {
    const out = execSync(`bun ${join(CORE, "cli", "src", "index.ts")} chain list`, {
      cwd: CORE,
      encoding: "utf8",
    });
    expect(out).toMatch(/intake_to_sprint/);
    expect(out).toMatch(/incident_response/);
    expect(out).toMatch(/sprint_close/);
  });

  it("`chain show <id>` prints the title", () => {
    const out = execSync(
      `bun ${join(CORE, "cli", "src", "index.ts")} chain show intake_to_sprint`,
      { cwd: CORE, encoding: "utf8" },
    );
    expect(out).toMatch(/Intake → Sprint/);
  });

  it("`chain validate` exits 0", () => {
    execSync(`bun ${join(CORE, "cli", "src", "index.ts")} chain validate`, {
      cwd: CORE,
      encoding: "utf8",
    });
  });
});
```

Run: `bun test cli/src/commands/chain.contract.test.ts`
Expected: 3 passed. If `validate` fails, fix the `step.skill` values in `config/chains.json` to match real `name:` values in `skills/**/SKILL.md` before continuing.

- [ ] **Step 4: Commit**

```bash
git add cli/src/index.ts cli/src/types/cli-registry.ts cli/src/commands/chain.contract.test.ts
git commit -m "feat(cli): register jstack chain {list,show,validate,run} subcommand"
```

---

## Task 9: Reconcile chain step skills with reality

**Files:**
- Modify: `config/chains.json`

The chain step IDs in Task 2 are best-guess. Validate them against real skills.

- [ ] **Step 1: List real skill ids**

Run:

```bash
grep -rh "^name:" /Users/jonathan.boice/Documents/GitHub/jstack/jstack.core/skills | awk '{print $2}' | sort -u
```

- [ ] **Step 2: Update `config/chains.json` step skills**

For any `step.skill` that isn't in the output above, either:

1. Replace with the closest real skill id (e.g. `jstack:intake` → match what's actually in `skills/intake/SKILL.md`).
2. Mark the step with `note: "skill TBD; tracked in <issue>"` and remove the step OR keep `validate` failing as documented technical debt.

The goal: `bun cli/src/index.ts chain validate` exits 0 against the real skill catalog.

- [ ] **Step 3: Re-run validate**

Run: `bun cli/src/index.ts chain validate`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add config/chains.json
git commit -m "fix(chains): reconcile step.skill ids with real skill catalog (validate green)"
```

---

## Task 10: Final integration check

**Files:**
- (none — verifications only.)

- [ ] **Step 1: Full test suite**

Run: `bun test`
Expected: all pass.

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: clean.

- [ ] **Step 3: Verify pipeline**

Run: `bun run verify`
Expected: green; chain validate runs as part of the pipeline.

- [ ] **Step 4: Push PR**

PR-3 is now ready. Title: "PR-3: chain config + `jstack chain` command".

---

## Spec coverage check

| Spec section | PR-3 task |
|--------------|-----------|
| §4.4 chain config schema | Task 1 |
| §4.4 narrative field | Task 1, Task 2 |
| §4.4 overlay overrides core | Task 3 |
| §4.4 `chain list` with overlay attribution | Task 7 |
| §4.4 `chain show <id>` | Task 7 |
| §4.4 `chain validate` (every `step.skill` exists) | Tasks 4, 5, 7 |
| §4.4 `chain run <id>` step-by-step | Task 6, Task 7 |
| §6 PM #4 `chain run intake_to_sprint` walks 3 steps | Task 6 (via test), Task 7 |
| §6 QA #6 chain CLI tests | Task 7, Task 8 |
| §10 #5 `--auto-yes` runtime override + step.requires_user opt-out | Tasks 1, 6, 7, 8 |

All chain-related spec items are covered.

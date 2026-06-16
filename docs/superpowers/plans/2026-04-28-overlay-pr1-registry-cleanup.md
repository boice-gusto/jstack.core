# PR-1: Overlay Registry + L1–L9 Contamination Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hard-coded `JSTACK_GUSTO_*` references in `jstack.core` with a generic overlay registry resolved at runtime, fix all 9 contamination leaks (L1–L9 in the spec), and gate the new behavior so existing users see no behavior change.

**Architecture:** Introduce `cli/src/lib/overlay.ts` that scans for `config/overlay.json` in sibling directories and exposes `resolveOverlay()`, `listOverlays()`, `getOverlayRoot(id)`. Refactor `findPluginRoot` and the four `JSTACK_GUSTO_ROOT` callers to delegate. Rename schema/config fields and config blocks to be overlay-id-driven, keeping deprecated aliases that warn-once for one minor release.

**Tech Stack:** TypeScript, Bun, Zod, `@clack/prompts`, `vitest` (jstack.core test runner per `package.json`).

**Spec:** [`../specs/2026-04-28-overlay-registry-and-setup-auto-design.md`](../specs/2026-04-28-overlay-registry-and-setup-auto-design.md) §1–§4.1, §7.1–§7.3, §8.1.

**Working directory for every task:** `/Users/jonathan.boice/Documents/GitHub/jstack/jstack.core` (the `jstack.core` package root). All file paths in this plan are relative to this root unless otherwise noted.

**Adopted decisions from spec §10:** `core_compat` is semver against `jstack.core/VERSION`; CLI never reads tokens; the deprecation table in spec §7.3 governs the warn-once aliases.

---

## File Structure

### New files

| Path | Responsibility |
|------|----------------|
| `cli/src/types/overlay.ts` | `OverlaySpec` zod schema and inferred TS type. |
| `cli/src/lib/overlay.ts` | `resolveOverlay()`, `listOverlays()`, `findCoreAndOverlay()`, `getOverlayRootEnv()`, `_resetOverlayDeprecationStateForTest()`. |
| `cli/src/lib/overlay.test.ts` | Unit tests for the resolver: no overlays, single overlay, env override, core_compat mismatch, deprecation warn-once. |
| `scripts/check-core-purity.test.ts` | The contamination grep test (CI-gated). |

### Modified files

| Path | Why |
|------|-----|
| `constants/paths.ts` | Replace `JSTACK_GUSTO_PKG_DIR` with `JSTACK_PKG_DIR` + deprecated re-export; add `JSTACK_OVERLAY_ENV`, `JSTACK_OVERLAY_ROOT_ENV`, `JSTACK_GUSTO_ROOT_ENV` (deprecated alias); set `DISTRIBUTION_VERSION_DEFAULT_URL` to empty string. |
| `cli/src/lib/config.ts` | `findPluginRoot` delegates to `overlay.resolveOverlay`; remove the hard-coded `nestedGusto` branch. |
| `cli/src/commands/skills.ts` | Replace four `process.env.JSTACK_GUSTO_ROOT` reads with a `getOverlayRootEnv()` helper. |
| `cli/src/index.ts` | Neutralize `--overlay` help text. |
| `cli/src/types/cli-registry.ts` | Same neutralization. |
| `config/defaults.json` | Replace `distribution.github.{core,gusto}` with `distribution.publish_targets.{core,overlay}`; keep `distribution.github` as a deprecated parse-only alias. |
| `config/schema.json` | Update `distribution` description; add neutral `overlay` block. |
| `config/skill-alias-map.json` | Rename `gustoRelPath` → `overlayRelPath` and add `overlayId`; keep `gustoRelPath` as a deprecated optional. |
| `scripts/validate-skill-alias-drift.ts` | Mirror the rename; warn on the legacy field. |
| `package.json` | Neutralize `homepage`; rename `check:gusto` → `check:overlay`; keep `check:gusto` as a deprecated alias-script that warns and delegates. |

### Touch-light

- `cli/src/lib/setup-defaults-slices.ts` — no edits.
- `cli/src/commands/setup.ts` — no edits in PR-1.
- `agents/`, `prompts/`, `docs/`, `examples/`, `templates/` — out of scope for contamination cleanup (per spec §1 footnote).

---

## Sequencing notes

- Tasks 1–4 build the overlay types and registry. They are pure additions and do not break anything.
- Tasks 5–9 wire the new resolver into `findPluginRoot` and `skills.ts`. After Task 9, the runtime is overlay-aware but `JSTACK_GUSTO_*` still works.
- Task 9b adds the `findCoreAndOverlay` helper that PR-2 (`setup --auto`) and PR-3 (`jstack chain`) both consume.
- Tasks 10–14 do the schema and config renames, with deprecated aliases.
- Tasks 15–17 update `package.json`, `paths.ts`, and the contamination grep CI.
- Each task ends with a commit. PR-1 is the union of these commits.

---

## Task 1: Add overlay type and zod schema

**Files:**
- Create: `cli/src/types/overlay.ts`
- Test: `cli/src/types/overlay.test.ts`

- [ ] **Step 1: Write the failing test**

Create `cli/src/types/overlay.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { OverlaySpecSchema } from "./overlay.js";

describe("OverlaySpecSchema", () => {
  it("parses a minimal overlay manifest", () => {
    const parsed = OverlaySpecSchema.parse({
      id: "gusto",
      display_name: "Gusto",
      package_dir: "jstack.gusto",
      version: "0.3.0",
      core_compat: "^0.x",
    });
    expect(parsed.id).toBe("gusto");
    expect(parsed.skills_root).toBe("skills");
    expect(parsed.probes_dir).toBe("config/probes");
  });

  it("rejects an overlay with a non-kebab id", () => {
    expect(() =>
      OverlaySpecSchema.parse({
        id: "Gusto Inc.",
        display_name: "Gusto",
        package_dir: "jstack.gusto",
        version: "0.3.0",
        core_compat: "^0.x",
      }),
    ).toThrow();
  });

  it("accepts an optional distribution block", () => {
    const parsed = OverlaySpecSchema.parse({
      id: "acme",
      display_name: "Acme",
      package_dir: "jstack.acme",
      version: "1.0.0",
      core_compat: "^0.x",
      distribution: { owner: "acme", repo: "jstack.acme", default_branch: "main" },
    });
    expect(parsed.distribution?.owner).toBe("acme");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test cli/src/types/overlay.test.ts`
Expected: FAIL with `Cannot find module './overlay.js'` (or equivalent).

- [ ] **Step 3: Write minimal implementation**

Create `cli/src/types/overlay.ts`:

```ts
import { z } from "zod";

const KEBAB_ID = /^[a-z][a-z0-9-]*$/;

export const OverlayDistributionSchema = z
  .object({
    owner: z.string().default(""),
    repo: z.string().default(""),
    default_branch: z.string().default("main"),
  })
  .strict();

export const OverlaySpecSchema = z
  .object({
    id: z.string().regex(KEBAB_ID, "id must be lowercase kebab-case"),
    display_name: z.string().min(1),
    package_dir: z.string().min(1),
    version: z.string().min(1),
    core_compat: z.string().min(1),
    skills_root: z.string().default("skills"),
    probes_dir: z.string().default("config/probes"),
    chains_file: z.string().default("config/chains.json"),
    distribution: OverlayDistributionSchema.optional(),
  })
  .strict();

export type OverlaySpec = z.infer<typeof OverlaySpecSchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test cli/src/types/overlay.test.ts`
Expected: 3 passed.

Run: `bun run typecheck` (from `jstack.core/cli` if a separate tsconfig — see `package.json`).
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add cli/src/types/overlay.ts cli/src/types/overlay.test.ts
git commit -m "feat(overlay): add OverlaySpec zod schema for overlay manifests"
```

---

## Task 2: Add overlay env-var constants in paths.ts

**Files:**
- Modify: `constants/paths.ts:21-23` (the `ENV` block) and append below.

- [ ] **Step 1: Read current file** (no test — config-only constant addition; the resolver tests in later tasks exercise these).

- [ ] **Step 2: Add new constants**

Edit `constants/paths.ts` so the `ENV` block becomes:

```ts
export const ENV = {
  CLAUDE_PLUGIN_ROOT: "CLAUDE_PLUGIN_ROOT",
  /** Pick an overlay by id from the overlay registry. */
  JSTACK_OVERLAY: "JSTACK_OVERLAY",
  /** Absolute path to a single overlay root, bypassing registry scan. */
  JSTACK_OVERLAY_ROOT: "JSTACK_OVERLAY_ROOT",
  /** @deprecated alias for JSTACK_OVERLAY_ROOT. Removed in v0.3.0. */
  JSTACK_GUSTO_ROOT: "JSTACK_GUSTO_ROOT",
} as const;
```

Add a new constant `JSTACK_PKG_DIR` immediately after `JSTACK_CORE_PKG_DIR`:

```ts
/** Default core package directory name. */
export const JSTACK_PKG_DIR = "jstack.core" as const;
```

Keep `JSTACK_GUSTO_PKG_DIR = "jstack.gusto"` for now with a JSDoc:

```ts
/** @deprecated Replaced by the overlay registry. Removed in v0.3.0. LEGACY: remove in v0.3.0 */
export const JSTACK_GUSTO_PKG_DIR = "jstack.gusto" as const;
```

Replace `DISTRIBUTION_VERSION_DEFAULT_URL` (line 44–45) with:

```ts
/** Default raw URL for distribution VERSION; empty unless distribution.version_url is set. */
export const DISTRIBUTION_VERSION_DEFAULT_URL = "" as const;
```

- [ ] **Step 3: Verify typecheck**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add constants/paths.ts
git commit -m "feat(constants): add JSTACK_OVERLAY env vars; mark gusto constants deprecated"
```

---

## Task 3: Create overlay.ts skeleton with `listOverlays`

**Files:**
- Create: `cli/src/lib/overlay.ts`
- Test: `cli/src/lib/overlay.test.ts`

- [ ] **Step 1: Write the failing test**

Create `cli/src/lib/overlay.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listOverlays } from "./overlay.js";

function makeTmpRepo(): string {
  return mkdtempSync(join(tmpdir(), "jstack-overlay-"));
}

function writeOverlayManifest(root: string, id: string, version = "0.1.0", coreCompat = "^0.x"): string {
  const dir = join(root, `jstack.${id}`);
  mkdirSync(join(dir, "config"), { recursive: true });
  writeFileSync(
    join(dir, "config", "overlay.json"),
    JSON.stringify({
      id,
      display_name: id,
      package_dir: `jstack.${id}`,
      version,
      core_compat: coreCompat,
    }),
    "utf8",
  );
  return dir;
}

describe("listOverlays", () => {
  it("returns [] when no sibling has config/overlay.json", () => {
    const root = makeTmpRepo();
    try {
      mkdirSync(join(root, "jstack.core", "config"), { recursive: true });
      writeFileSync(join(root, "jstack.core", "config", "defaults.json"), "{}", "utf8");
      expect(listOverlays(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns the overlay when one sibling has config/overlay.json", () => {
    const root = makeTmpRepo();
    try {
      writeOverlayManifest(root, "gusto");
      const found = listOverlays(root);
      expect(found).toHaveLength(1);
      expect(found[0].id).toBe("gusto");
      expect(found[0].package_dir).toBe("jstack.gusto");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns multiple overlays sorted by id", () => {
    const root = makeTmpRepo();
    try {
      writeOverlayManifest(root, "zeta");
      writeOverlayManifest(root, "alpha");
      const found = listOverlays(root);
      expect(found.map((o) => o.id)).toEqual(["alpha", "zeta"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ignores siblings with malformed config/overlay.json (invalid JSON)", () => {
    const root = makeTmpRepo();
    try {
      const dir = join(root, "jstack.broken");
      mkdirSync(join(dir, "config"), { recursive: true });
      writeFileSync(join(dir, "config", "overlay.json"), "{ this is not json", "utf8");
      expect(listOverlays(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ignores siblings whose overlay.json fails schema validation", () => {
    const root = makeTmpRepo();
    try {
      const dir = join(root, "jstack.bad");
      mkdirSync(join(dir, "config"), { recursive: true });
      writeFileSync(
        join(dir, "config", "overlay.json"),
        JSON.stringify({ id: "Bad ID with spaces", display_name: "X" }), // missing required fields, bad id
        "utf8",
      );
      expect(listOverlays(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test cli/src/lib/overlay.test.ts`
Expected: FAIL with `Cannot find module './overlay.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `cli/src/lib/overlay.ts`:

```ts
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { OverlaySpecSchema, type OverlaySpec } from "../types/overlay.js";

export type ResolvedOverlay = OverlaySpec & { absolute_path: string };

/** Scan immediate children of `parentDir` for `<dir>/config/overlay.json`. */
export function listOverlays(parentDir: string): ResolvedOverlay[] {
  if (!existsSync(parentDir)) return [];
  let entries: string[];
  try {
    entries = readdirSync(parentDir);
  } catch {
    return [];
  }
  const overlays: ResolvedOverlay[] = [];
  for (const name of entries) {
    const childAbs = join(parentDir, name);
    let isDir = false;
    try {
      isDir = statSync(childAbs).isDirectory();
    } catch {
      continue;
    }
    if (!isDir) continue;
    const manifestPath = join(childAbs, "config", "overlay.json");
    if (!existsSync(manifestPath)) continue;
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(manifestPath, "utf8"));
    } catch {
      continue;
    }
    const parsed = OverlaySpecSchema.safeParse(raw);
    if (!parsed.success) continue;
    overlays.push({ ...parsed.data, absolute_path: resolve(childAbs) });
  }
  overlays.sort((a, b) => a.id.localeCompare(b.id));
  return overlays;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test cli/src/lib/overlay.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add cli/src/lib/overlay.ts cli/src/lib/overlay.test.ts
git commit -m "feat(overlay): scan siblings for config/overlay.json with listOverlays()"
```

---

## Task 4: Add `resolveOverlay` with no-overlay fallback

**Files:**
- Modify: `cli/src/lib/overlay.ts`
- Test: `cli/src/lib/overlay.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `cli/src/lib/overlay.test.ts`:

```ts
import { resolveOverlay } from "./overlay.js";

describe("resolveOverlay", () => {
  it("returns null when no overlays present", () => {
    const root = makeTmpRepo();
    try {
      mkdirSync(join(root, "jstack.core", "config"), { recursive: true });
      writeFileSync(join(root, "jstack.core", "config", "defaults.json"), "{}", "utf8");
      const out = resolveOverlay({ parentDir: root, env: {}, coreVersion: "0.1.0" });
      expect(out).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test cli/src/lib/overlay.test.ts -t "no overlays"`
Expected: FAIL — `resolveOverlay` is not exported.

- [ ] **Step 3: Implement minimal `resolveOverlay`**

Append to `cli/src/lib/overlay.ts`:

```ts
export type ResolveOverlayOptions = {
  parentDir: string;
  env: NodeJS.ProcessEnv;
  coreVersion: string;
};

export function resolveOverlay(opts: ResolveOverlayOptions): ResolvedOverlay | null {
  const overlays = listOverlays(opts.parentDir);
  if (overlays.length === 0) return null;
  return null; // expanded in Task 5
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test cli/src/lib/overlay.test.ts -t "no overlays"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cli/src/lib/overlay.ts cli/src/lib/overlay.test.ts
git commit -m "feat(overlay): add resolveOverlay() with no-overlay base case"
```

---

## Task 5: `resolveOverlay` returns single sibling overlay

**Files:**
- Modify: `cli/src/lib/overlay.ts`
- Test: `cli/src/lib/overlay.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `cli/src/lib/overlay.test.ts`:

```ts
it("returns the single overlay when its core_compat is satisfied", () => {
  const root = makeTmpRepo();
  try {
    writeOverlayManifest(root, "gusto", "0.3.0", "^0.x");
    const out = resolveOverlay({ parentDir: root, env: {}, coreVersion: "0.1.0" });
    expect(out?.id).toBe("gusto");
    expect(out?.absolute_path).toContain("jstack.gusto");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test cli/src/lib/overlay.test.ts -t "single overlay when its core_compat is satisfied"`
Expected: FAIL — returns null.

- [ ] **Step 3: Add semver guard and single-overlay return**

Add a dependency check first — `semver` is already used by Bun-friendly toolchains; if it's not in `cli/package.json`, install it.

Run: `cd cli && bun add semver`

Run: `cd cli && bun add -d @types/semver`

Update `cli/src/lib/overlay.ts`:

```ts
import semver from "semver";
// existing imports …

function compatOk(coreVersion: string, range: string): boolean {
  // semver.satisfies returns false on parse error; use coerce to tolerate "0.x" style.
  const coerced = semver.coerce(coreVersion);
  if (!coerced) return false;
  return semver.satisfies(coerced.version, range, { includePrerelease: true });
}

export function resolveOverlay(opts: ResolveOverlayOptions): ResolvedOverlay | null {
  const overlays = listOverlays(opts.parentDir);
  if (overlays.length === 0) return null;
  const compatible = overlays.filter((o) => compatOk(opts.coreVersion, o.core_compat));
  if (compatible.length === 0) return null;
  if (compatible.length === 1) return compatible[0];
  return null; // env-pick is added in Task 6
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test cli/src/lib/overlay.test.ts -t "single overlay when its core_compat is satisfied"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cli/src/lib/overlay.ts cli/package.json cli/bun.lock
git commit -m "feat(overlay): resolveOverlay returns single compat overlay; gate by semver core_compat"
```

---

## Task 6: `resolveOverlay` honors `JSTACK_OVERLAY` env

**Files:**
- Modify: `cli/src/lib/overlay.ts`
- Test: `cli/src/lib/overlay.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("picks the overlay matching JSTACK_OVERLAY env when multiple present", () => {
  const root = makeTmpRepo();
  try {
    writeOverlayManifest(root, "gusto");
    writeOverlayManifest(root, "acme");
    const out = resolveOverlay({
      parentDir: root,
      env: { JSTACK_OVERLAY: "acme" },
      coreVersion: "0.1.0",
    });
    expect(out?.id).toBe("acme");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("returns null when JSTACK_OVERLAY does not match any overlay id", () => {
  const root = makeTmpRepo();
  try {
    writeOverlayManifest(root, "gusto");
    const out = resolveOverlay({
      parentDir: root,
      env: { JSTACK_OVERLAY: "nope" },
      coreVersion: "0.1.0",
    });
    expect(out).toBeNull();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test cli/src/lib/overlay.test.ts -t "JSTACK_OVERLAY"`
Expected: 2 failures.

- [ ] **Step 3: Implement env override**

In `resolveOverlay`, before the single-result branch, add:

```ts
const envId = (opts.env.JSTACK_OVERLAY ?? "").trim();
if (envId) {
  const picked = compatible.find((o) => o.id === envId);
  return picked ?? null;
}
if (compatible.length === 1) return compatible[0];
return null;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test cli/src/lib/overlay.test.ts -t "JSTACK_OVERLAY"`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add cli/src/lib/overlay.ts cli/src/lib/overlay.test.ts
git commit -m "feat(overlay): JSTACK_OVERLAY env disambiguates when multiple overlays present"
```

---

## Task 7: `resolveOverlay` rejects core_compat mismatch

**Files:**
- Test: `cli/src/lib/overlay.test.ts` (no impl change — Task 5 already added the filter; this only adds the test).

- [ ] **Step 1: Write the test**

```ts
it("returns null when overlay core_compat fails", () => {
  const root = makeTmpRepo();
  try {
    writeOverlayManifest(root, "gusto", "0.3.0", "^2.0.0");
    const out = resolveOverlay({ parentDir: root, env: {}, coreVersion: "0.1.0" });
    expect(out).toBeNull();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run test**

Run: `bun test cli/src/lib/overlay.test.ts -t "core_compat fails"`
Expected: PASS (Task 5 implementation is sufficient).

- [ ] **Step 3: Commit**

```bash
git add cli/src/lib/overlay.test.ts
git commit -m "test(overlay): assert core_compat mismatch returns null"
```

---

## Task 8: `getOverlayRootEnv` helper + warn-once on `JSTACK_GUSTO_ROOT`

**Files:**
- Modify: `cli/src/lib/overlay.ts`
- Test: `cli/src/lib/overlay.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { getOverlayRootEnv, _resetOverlayDeprecationStateForTest } from "./overlay.js";

describe("getOverlayRootEnv", () => {
  beforeEach(() => _resetOverlayDeprecationStateForTest());

  it("returns JSTACK_OVERLAY_ROOT when set", () => {
    expect(
      getOverlayRootEnv({ JSTACK_OVERLAY_ROOT: "/p/jstack.acme" }),
    ).toBe("/p/jstack.acme");
  });

  it("returns JSTACK_GUSTO_ROOT and warns once when only the legacy var is set", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const env = { JSTACK_GUSTO_ROOT: "/p/jstack.gusto" };
      expect(getOverlayRootEnv(env)).toBe("/p/jstack.gusto");
      expect(getOverlayRootEnv(env)).toBe("/p/jstack.gusto");
      const warns = warn.mock.calls.flat().filter((s) => String(s).includes("JSTACK_GUSTO_ROOT"));
      expect(warns.length).toBe(1);
    } finally {
      warn.mockRestore();
    }
  });

  it("prefers JSTACK_OVERLAY_ROOT when both are set; no warn", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(
        getOverlayRootEnv({
          JSTACK_OVERLAY_ROOT: "/p/jstack.new",
          JSTACK_GUSTO_ROOT: "/p/jstack.old",
        }),
      ).toBe("/p/jstack.new");
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
```

Add to the imports at the top of the test file:

```ts
import { beforeEach, vi } from "vitest";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test cli/src/lib/overlay.test.ts -t "getOverlayRootEnv"`
Expected: 3 failures (`getOverlayRootEnv` not exported).

- [ ] **Step 3: Implement helper**

Append to `cli/src/lib/overlay.ts`:

```ts
let warnedJstackGustoRoot = false;

/** @internal — for tests only. */
export function _resetOverlayDeprecationStateForTest(): void {
  warnedJstackGustoRoot = false;
}

/** Read the overlay root path from env, preferring the new var over the deprecated alias. */
export function getOverlayRootEnv(env: NodeJS.ProcessEnv): string {
  const fresh = (env.JSTACK_OVERLAY_ROOT ?? "").trim();
  if (fresh) return fresh;
  const legacy = (env.JSTACK_GUSTO_ROOT ?? "").trim();
  if (legacy) {
    if (!warnedJstackGustoRoot) {
      warnedJstackGustoRoot = true;
      console.warn(
        "[deprecated] JSTACK_GUSTO_ROOT is deprecated; use JSTACK_OVERLAY_ROOT (removed in v0.3.0).",
      );
    }
    return legacy;
  }
  return "";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test cli/src/lib/overlay.test.ts -t "getOverlayRootEnv"`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add cli/src/lib/overlay.ts cli/src/lib/overlay.test.ts
git commit -m "feat(overlay): getOverlayRootEnv with warn-once on legacy JSTACK_GUSTO_ROOT"
```

---

## Task 9: Refactor `findPluginRoot` to delegate to `resolveOverlay`

**Files:**
- Modify: `cli/src/lib/config.ts:9-122`
- Test: `cli/src/lib/config.ts` already has indirect coverage via `cli-interactive-contracts.test.ts`. Add a focused unit test.
- Test (new): `cli/src/lib/config.test.ts`

- [ ] **Step 1: Read current `cli/src/lib/config.ts` to confirm exports**

The current `findPluginRoot` uses `JSTACK_GUSTO_PKG_DIR` (line 106) and walks up to `WALK_LIMITS.PLUGIN_ROOT_MAX_STEPS`. We will keep that walking behavior but ask `resolveOverlay` first when at each parent step.

- [ ] **Step 2: Write the failing test**

Create `cli/src/lib/config.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findPluginRoot } from "./config.js";

function makeMonorepo(): { root: string; core: string; overlay: string } {
  const root = mkdtempSync(join(tmpdir(), "jstack-monorepo-"));
  const core = join(root, "jstack.core");
  const overlay = join(root, "jstack.acme");
  mkdirSync(join(core, "config"), { recursive: true });
  mkdirSync(join(core, "skills"), { recursive: true });
  writeFileSync(join(core, "config", "defaults.json"), "{}", "utf8");
  mkdirSync(join(overlay, "config"), { recursive: true });
  mkdirSync(join(overlay, "skills"), { recursive: true });
  writeFileSync(
    join(overlay, "config", "overlay.json"),
    JSON.stringify({
      id: "acme",
      display_name: "Acme",
      package_dir: "jstack.acme",
      version: "0.1.0",
      core_compat: "^0.x",
    }),
    "utf8",
  );
  writeFileSync(join(overlay, "config", "defaults.json"), "{}", "utf8");
  return { root, core, overlay };
}

describe("findPluginRoot", () => {
  it("prefers the overlay sibling when one is present", () => {
    const { root, overlay } = makeMonorepo();
    try {
      // walk up from /core/cli, but no JSTACK_OVERLAY env set
      const out = findPluginRoot(join(root, "jstack.core", "cli"));
      expect(out).toBe(overlay);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns core when no overlay is present", () => {
    const root = mkdtempSync(join(tmpdir(), "jstack-core-only-"));
    try {
      const core = join(root, "jstack.core");
      mkdirSync(join(core, "config"), { recursive: true });
      mkdirSync(join(core, "skills"), { recursive: true });
      writeFileSync(join(core, "config", "defaults.json"), "{}", "utf8");
      const out = findPluginRoot(join(core, "cli"));
      expect(out).toBe(core);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test cli/src/lib/config.test.ts -t "findPluginRoot"`
Expected: probably PASS the second case but FAIL the first because the legacy code only prefers the literal `jstack.gusto` directory; an `acme` overlay is not preferred. (If the existing `nestedGusto` happens to match because the overlay isn't named gusto, the test will fail as expected.)

- [ ] **Step 4: Refactor `findPluginRoot`**

Update `cli/src/lib/config.ts`. Replace the current `findPluginRoot` (lines ~95-122) with:

```ts
import { resolveOverlay } from "./overlay.js";
import { readFileSync } from "node:fs";
// existing imports …

function readCoreVersion(coreRoot: string): string {
  try {
    return readFileSync(join(coreRoot, "VERSION"), "utf8").trim();
  } catch {
    return "0.0.0";
  }
}

export function findPluginRoot(cwd = process.cwd()): string {
  const envRoot = process.env[ENV.CLAUDE_PLUGIN_ROOT];
  if (envRoot && existsSync(envRoot)) {
    return resolve(envRoot);
  }
  let dir = cwd;
  for (let i = 0; i < WALK_LIMITS.PLUGIN_ROOT_MAX_STEPS; i++) {
    // Direct hit: this dir is itself a plugin root (core or overlay).
    if (existsSync(join(dir, CONFIG_DIR, DEFAULTS_FILE)) && existsSync(join(dir, SKILLS_DIR))) {
      return dir;
    }
    // Monorepo scan: prefer a sibling overlay over a sibling core, gated by core_compat.
    const corePath = join(dir, JSTACK_PKG_DIR);
    const coreVersion = readCoreVersion(corePath);
    const overlay = resolveOverlay({ parentDir: dir, env: process.env, coreVersion });
    if (overlay) return overlay.absolute_path;
    if (
      existsSync(join(corePath, CONFIG_DIR, DEFAULTS_FILE)) &&
      existsSync(join(corePath, SKILLS_DIR))
    ) {
      return resolve(corePath);
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return cwd;
}
```

Remove the import `JSTACK_GUSTO_PKG_DIR` from the imports list (it is no longer referenced here).

- [ ] **Step 5: Run all CLI tests**

Run: `bun test cli/src/`
Expected: all pass, including the two new `findPluginRoot` cases.

- [ ] **Step 6: Commit**

```bash
git add cli/src/lib/config.ts cli/src/lib/config.test.ts
git commit -m "refactor(config): findPluginRoot delegates to overlay.resolveOverlay; drop gusto special-case"
```

---

## Task 9b: `findCoreAndOverlay` helper (returns both paths)

`findPluginRoot` returns *one* root (overlay if present, otherwise core). PR-2's `setup --auto` and PR-3's `chain` command both need **both** core and overlay paths simultaneously (so they can load probes/chains from each). Add the helper here so downstream PRs depend cleanly on PR-1.

**Files:**
- Modify: `cli/src/lib/overlay.ts`
- Modify: `cli/src/lib/overlay.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `cli/src/lib/overlay.test.ts`:

```ts
describe("findCoreAndOverlay", () => {
  it("finds core only when no overlay present", () => {
    const root = mkdtempSync(join(tmpdir(), "cao-"));
    try {
      const core = join(root, "jstack.core");
      mkdirSync(join(core, "config"), { recursive: true });
      mkdirSync(join(core, "skills"), { recursive: true });
      writeFileSync(join(core, "config", "defaults.json"), "{}", "utf8");
      const out = findCoreAndOverlay({
        cwd: join(core, "cli"),
        env: {},
        coreVersion: "0.1.0",
      });
      expect(out.corePath).toBe(core);
      expect(out.overlay).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("finds both core and overlay when both are siblings", () => {
    const root = mkdtempSync(join(tmpdir(), "cao-both-"));
    try {
      const core = join(root, "jstack.core");
      const overlay = join(root, "jstack.acme");
      mkdirSync(join(core, "config"), { recursive: true });
      mkdirSync(join(core, "skills"), { recursive: true });
      writeFileSync(join(core, "config", "defaults.json"), "{}", "utf8");
      mkdirSync(join(overlay, "config"), { recursive: true });
      mkdirSync(join(overlay, "skills"), { recursive: true });
      writeFileSync(join(overlay, "config", "defaults.json"), "{}", "utf8");
      writeFileSync(
        join(overlay, "config", "overlay.json"),
        JSON.stringify({
          id: "acme",
          display_name: "Acme",
          package_dir: "jstack.acme",
          version: "0.1.0",
          core_compat: "^0.x",
        }),
        "utf8",
      );
      const out = findCoreAndOverlay({
        cwd: join(overlay, "tests"),
        env: {},
        coreVersion: "0.1.0",
      });
      expect(out.corePath).toBe(core);
      expect(out.overlay?.id).toBe("acme");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("throws when no core is discoverable", () => {
    const root = mkdtempSync(join(tmpdir(), "cao-empty-"));
    try {
      expect(() =>
        findCoreAndOverlay({ cwd: root, env: {}, coreVersion: "0.1.0" }),
      ).toThrow(/no core/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

Add `findCoreAndOverlay` to the imports at the top:

```ts
import { findCoreAndOverlay } from "./overlay.js";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test cli/src/lib/overlay.test.ts -t "findCoreAndOverlay"`
Expected: 3 failures.

- [ ] **Step 3: Implement**

Append to `cli/src/lib/overlay.ts`:

```ts
import { dirname } from "node:path";

export type CoreAndOverlay = {
  corePath: string;
  overlay: ResolvedOverlay | null;
};

export type FindCoreAndOverlayOptions = {
  cwd: string;
  env: NodeJS.ProcessEnv;
  coreVersion: string;
};

/**
 * Walk parents looking for both:
 *   - core: a directory with config/defaults.json AND skills/ AND NO config/overlay.json
 *   - overlay: a directory with config/overlay.json (validated by resolveOverlay)
 * Returns absolute paths for both. Throws if no core is discoverable.
 */
export function findCoreAndOverlay(opts: FindCoreAndOverlayOptions): CoreAndOverlay {
  let dir = opts.cwd;
  let foundCore: string | null = null;
  let foundOverlay: ResolvedOverlay | null = null;

  function tryRegisterCore(candidate: string): void {
    if (foundCore) return;
    const hasDefaults = existsSync(join(candidate, "config", "defaults.json"));
    const hasSkills = existsSync(join(candidate, "skills"));
    const hasOverlayJson = existsSync(join(candidate, "config", "overlay.json"));
    if (hasDefaults && hasSkills && !hasOverlayJson) {
      foundCore = resolve(candidate);
    }
  }

  for (let i = 0; i < 30; i++) {
    tryRegisterCore(dir);
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      // ignore
    }
    for (const name of entries) {
      tryRegisterCore(join(dir, name));
    }
    if (!foundOverlay) {
      const overlay = resolveOverlay({
        parentDir: dir,
        env: opts.env,
        coreVersion: opts.coreVersion,
      });
      if (overlay) foundOverlay = overlay;
    }
    if (foundCore) break;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  if (!foundCore) {
    throw new Error(
      `findCoreAndOverlay: no core package found walking up from ${opts.cwd} ` +
        `(looking for a directory with config/defaults.json AND skills/ AND NO config/overlay.json)`,
    );
  }
  return { corePath: foundCore, overlay: foundOverlay };
}
```

- [ ] **Step 4: Run tests**

Run: `bun test cli/src/lib/overlay.test.ts`
Expected: all pass (3 new + previous).

- [ ] **Step 5: Commit**

```bash
git add cli/src/lib/overlay.ts cli/src/lib/overlay.test.ts
git commit -m "feat(overlay): findCoreAndOverlay returns both core and overlay paths"
```

---

## Task 10: Replace `JSTACK_GUSTO_ROOT` reads in `commands/skills.ts`

**Files:**
- Modify: `cli/src/commands/skills.ts:99,113,161,227`

- [ ] **Step 1: Add a helper-call test**

Append to `cli/src/lib/overlay.test.ts`:

```ts
it("getOverlayRootEnv returns empty string when neither var is set", () => {
  expect(getOverlayRootEnv({})).toBe("");
});
```

Run: `bun test cli/src/lib/overlay.test.ts -t "neither var"`
Expected: PASS (already covered, but explicit).

- [ ] **Step 2: Refactor each call site**

In `cli/src/commands/skills.ts`, replace each of the four lines:

```ts
const overlay = opts.overlay?.trim() || process.env.JSTACK_GUSTO_ROOT?.trim();
```

with:

```ts
const overlay = opts.overlay?.trim() || getOverlayRootEnv(process.env);
```

Add this import at the top of the file:

```ts
import { getOverlayRootEnv } from "../lib/overlay.js";
```

- [ ] **Step 3: Run tests**

Run: `bun test cli/src/`
Expected: all pass.

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add cli/src/commands/skills.ts cli/src/lib/overlay.test.ts
git commit -m "refactor(cli): use getOverlayRootEnv helper instead of direct JSTACK_GUSTO_ROOT reads"
```

---

## Task 11: Neutralize `--overlay` help text

**Files:**
- Modify: `cli/src/index.ts:90`
- Modify: `cli/src/types/cli-registry.ts:217`

- [ ] **Step 1: Edit help string in `cli/src/index.ts`**

Change:

```ts
.option("--overlay <path>", "Second plugin root (e.g. jstack.gusto checkout)")
```

to:

```ts
.option("--overlay <path>", "Overlay plugin root (registered overlay package, optional)")
```

- [ ] **Step 2: Edit description in `cli/src/types/cli-registry.ts`**

Change:

```ts
description: "Second plugin root (e.g. jstack.gusto checkout)",
```

to:

```ts
description: "Overlay plugin root (registered overlay package, optional)",
```

- [ ] **Step 3: Run typecheck and tests**

Run: `bun run typecheck && bun test cli/src/`
Expected: pass.

- [ ] **Step 4: Run the help command and inspect the output**

Run: `bun run cli/src/index.ts --help | grep overlay`
Expected: a single line that does not contain the substring "gusto".

- [ ] **Step 5: Commit**

```bash
git add cli/src/index.ts cli/src/types/cli-registry.ts
git commit -m "refactor(cli): neutralize --overlay help text (drop jstack.gusto example)"
```

---

## Task 12: Migrate `config/defaults.json` distribution block

**Files:**
- Modify: `config/defaults.json:408-432`

- [ ] **Step 1: Update the distribution block**

Replace the current `distribution` object (lines ~408-432) with:

```json
"distribution": {
  "update_check": true,
  "version_url": "",
  "publish_targets": {
    "core": {
      "owner": "",
      "repo": "",
      "default_branch": "main"
    },
    "overlay": {
      "id": "",
      "owner": "",
      "repo": "",
      "default_branch": "main"
    }
  },
  "github": {
    "core": {
      "owner": "",
      "repo": "",
      "default_branch": "main"
    },
    "_legacy_note": "Legacy parse-only alias for distribution.publish_targets.core. Removed in v0.3.0."
  },
  "plugin_pr": {
    "path_deny_globs": [
      "**/.claude/settings.local.json",
      "**/settings.json",
      "**/.mcp.json",
      "**/.env",
      "**/.env.*"
    ]
  }
}
```

Note: the `gusto` block under `distribution.github` is **removed**. The `_legacy_note` is a comment-style sentinel that the schema (Task 13) ignores.

- [ ] **Step 2: Verify the file parses**

Run: `node -e "JSON.parse(require('fs').readFileSync('config/defaults.json','utf8')); console.log('ok')"`
Expected: `ok`.

Run: `bun test cli/src/`
Expected: all pass (no callers depend on the old keys; `runMcpRefresh` and friends only touch `mcp_servers`).

- [ ] **Step 3: Commit**

```bash
git add config/defaults.json
git commit -m "config(defaults): replace distribution.github.gusto with publish_targets.overlay"
```

---

## Task 13: Update `config/schema.json` description and overlay block

**Files:**
- Modify: `config/schema.json:256` and surrounding `distribution` block.

- [ ] **Step 1: Read the current `distribution` block**

Run: `grep -n "distribution" config/schema.json | head -10` to find the section.

- [ ] **Step 2: Update the description and add an overlay block**

Edit the `distribution` description (around line 256) from:

```
"description": "update_check, version_url, github core/gusto repos, plugin_pr deny globs"
```

to:

```
"description": "update_check, version_url, publish_targets per logical id (core, overlay), plugin_pr deny globs"
```

Add a sibling top-level block in `JstackConfigSchema` properties (alphabetical position is fine):

```json
"overlay": {
  "type": "object",
  "additionalProperties": false,
  "description": "Overlay binding for this workspace. Empty when no overlay is in use.",
  "properties": {
    "id":          { "type": "string" },
    "package_dir": { "type": "string" }
  }
}
```

- [ ] **Step 3: Verify the file parses**

Run: `node -e "JSON.parse(require('fs').readFileSync('config/schema.json','utf8')); console.log('ok')"`
Expected: `ok`.

- [ ] **Step 4: Commit**

```bash
git add config/schema.json
git commit -m "config(schema): neutralize distribution description; add overlay block"
```

---

## Task 14: Rename `gustoRelPath` → `overlayRelPath` in skill-alias-map

**Files:**
- Modify: `config/skill-alias-map.json:7,9`
- Modify: `scripts/validate-skill-alias-drift.ts:17,92`

- [ ] **Step 1: Migrate `config/skill-alias-map.json`**

For every row that has `gustoRelPath`, add a sibling `overlayRelPath` with the same value and an `overlayId: "gusto"` field. Keep the `gustoRelPath` field for one release. Example for the existing row:

Before:
```json
{
  "alias": "jstack:jira-create",
  "corePath": "skills/jira/create-jira-ticket/SKILL.md",
  "gustoRelPath": "jstack.gusto/skills/gusto-jira/create-jira-ticket/SKILL.md",
  "notes": "Gusto-specific Jira creation overlay; content intentionally diverges."
}
```

After:
```json
{
  "alias": "jstack:jira-create",
  "corePath": "skills/jira/create-jira-ticket/SKILL.md",
  "overlayId": "gusto",
  "overlayRelPath": "jstack.gusto/skills/gusto-jira/create-jira-ticket/SKILL.md",
  "gustoRelPath": "jstack.gusto/skills/gusto-jira/create-jira-ticket/SKILL.md",
  "_legacy_gustoRelPath_removal": "v0.3.0",
  "notes": "Overlay-specific Jira creation; content intentionally diverges."
}
```

- [ ] **Step 2: Update `scripts/validate-skill-alias-drift.ts`**

Update the zod row schema (line 17 area):

```ts
const Row = z.object({
  alias: z.string(),
  corePath: z.string(),
  overlayId: z.string().optional(),
  overlayRelPath: z.string().optional(),
  /** @deprecated use overlayRelPath. Removed in v0.3.0. LEGACY: remove in v0.3.0 */
  gustoRelPath: z.string().optional(),
  notes: z.string().optional(),
});
```

Update the validator loop (around line 92) to read `overlayRelPath` first, falling back to `gustoRelPath` with a one-shot warn:

```ts
let warnedLegacyAlias = false;
function pickOverlayPath(row: z.infer<typeof Row>): string | undefined {
  if (row.overlayRelPath) return row.overlayRelPath;
  if (row.gustoRelPath) {
    if (!warnedLegacyAlias) {
      warnedLegacyAlias = true;
      console.warn(
        "[deprecated] gustoRelPath in skill-alias-map.json is deprecated; use overlayRelPath (removed in v0.3.0).",
      );
    }
    return row.gustoRelPath;
  }
  return undefined;
}
```

Replace the literal `row.gustoRelPath` reference in the existing loop body with `pickOverlayPath(row)`. The fixture array around line 92 (`{ label: "gustoRelPath", rel: row.gustoRelPath }`) becomes `{ label: "overlayRelPath", rel: pickOverlayPath(row) }`.

- [ ] **Step 3: Run the existing drift validator**

Run: `bun scripts/validate-skill-alias-drift.ts`
Expected: prints the legacy warn once, then validates clean.

- [ ] **Step 4: Add a focused unit test**

Create `scripts/validate-skill-alias-drift.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

// We re-import the helper if exported; otherwise call the script as a module.
// Pseudocode — adjust to the actual export shape.
import { pickOverlayPath } from "./validate-skill-alias-drift.js";

describe("pickOverlayPath", () => {
  it("returns overlayRelPath when present", () => {
    expect(pickOverlayPath({ alias: "x", corePath: "y", overlayRelPath: "a" })).toBe("a");
  });
  it("falls back to gustoRelPath and warns once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(pickOverlayPath({ alias: "x", corePath: "y", gustoRelPath: "b" })).toBe("b");
      expect(pickOverlayPath({ alias: "x", corePath: "y", gustoRelPath: "b" })).toBe("b");
      const calls = warn.mock.calls.flat().filter((s) => String(s).includes("gustoRelPath"));
      expect(calls.length).toBe(1);
    } finally {
      warn.mockRestore();
    }
  });
});
```

If `pickOverlayPath` is not currently exported from the script, refactor the script to export it (top-level `export function`).

Run: `bun test scripts/validate-skill-alias-drift.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add config/skill-alias-map.json scripts/validate-skill-alias-drift.ts scripts/validate-skill-alias-drift.test.ts
git commit -m "refactor(skill-alias-map): rename gustoRelPath to overlayRelPath; add overlayId"
```

---

## Task 15: Neutralize `package.json`

**Files:**
- Modify: `package.json` (root of `jstack.core`).

- [ ] **Step 1: Update fields**

Open `jstack.core/package.json`. Apply these changes:

| Field | Before | After |
|-------|--------|-------|
| `homepage` | `"https://github.com/gusto/jstack.core"` | `""` (empty string — concrete URL is set per-fork) |
| `scripts.check:gusto` | (current) | wrapper that prints deprecation and delegates to `check:overlay` |
| `scripts.check:overlay` | (new) | `bash -c 'overlay_dir="${JSTACK_OVERLAY_ROOT:-../jstack.gusto}"; if [ -d "$overlay_dir" ]; then cd "$overlay_dir" && bun run check; fi'` |
| `scripts.check:all` | `"bun run check && cd ../jstack.gusto && bun run check"` | `"bun run check && bun run check:overlay"` |

The new `check:gusto` script:

```json
"check:gusto": "echo '[deprecated] check:gusto is deprecated; use check:overlay (removed in v0.3.0)' && bun run check:overlay"
```

Also update `package.json:7` (the `name` field appears to be a stray "boice@gusto jonathan.boice@gusto.com"). Replace it with the actual package name expected by the npm registry, e.g. `"name": "jstack-core"`. **If this field is intentional and used elsewhere, do not change it; instead just confirm and skip.** (See Step 2.)

- [ ] **Step 2: Confirm `name` field is safe to change**

Run: `grep -rn '"name"' /Users/jonathan.boice/Documents/GitHub/jstack/jstack.core/package.json`
Run: `grep -rn 'jstack-core' /Users/jonathan.boice/Documents/GitHub/jstack/jstack.core/cli /Users/jonathan.boice/Documents/GitHub/jstack/jstack.core/scripts`

If no consumers reference the literal name string, change it. If consumers exist, leave the `name` as-is and only change `homepage` and the scripts.

- [ ] **Step 3: Verify scripts run**

Run: `bun run check:overlay`
Expected: silent no-op when `../jstack.gusto` does not exist; otherwise runs `bun run check` in the overlay directory.

Run: `bun run check:gusto`
Expected: prints the deprecation warning, then behaves like `check:overlay`.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore(pkg): neutralize homepage; rename check:gusto to check:overlay (with deprecation alias)"
```

---

## Task 16: Replace `DISTRIBUTION_VERSION_DEFAULT_URL`

**Files:**
- Modify: `constants/paths.ts:43-45`
- Verify: callers of `DISTRIBUTION_VERSION_DEFAULT_URL` handle empty string gracefully.

- [ ] **Step 1: Confirm Task 2 already changed this value**

Task 2 already replaced the constant value with `""`. This task verifies no caller breaks on empty string.

Run: `grep -rn 'DISTRIBUTION_VERSION_DEFAULT_URL' cli/src scripts`

- [ ] **Step 2: Read each caller and verify the empty-string path**

If a caller does `const url = DISTRIBUTION_VERSION_DEFAULT_URL` without first checking emptiness, modify it to read `cfg.distribution?.version_url ?? DISTRIBUTION_VERSION_DEFAULT_URL` and short-circuit on empty:

```ts
const url = cfg.distribution?.version_url ?? DISTRIBUTION_VERSION_DEFAULT_URL;
if (!url) {
  // No version URL configured. Skip the update check.
  return null;
}
```

- [ ] **Step 3: Run tests**

Run: `bun test cli/src/`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add cli/src/commands/upgrade.ts cli/src/lib/update-check.ts
git commit -m "refactor(constants): tolerate empty DISTRIBUTION_VERSION_DEFAULT_URL"
```

(Adjust the `git add` paths to match what actually changed in Step 2.)

---

## Task 17: Add the contamination grep CI test

**Files:**
- Create: `scripts/check-core-purity.test.ts`

- [ ] **Step 1: Write the test**

Create `scripts/check-core-purity.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const CORE_ROOT = join(__dirname, "..");

const ALLOW_LIST_FILES = [
  "constants/paths.ts",                       // legacy alias (Task 2)
  "cli/src/commands/skills.ts",               // legacy env-var help/comment after refactor — none expected
  "scripts/validate-skill-alias-drift.ts",    // legacy alias parser
  "scripts/validate-skill-alias-drift.test.ts",
  "cli/src/lib/overlay.ts",                   // mentions JSTACK_GUSTO_ROOT in deprecation logic
  "cli/src/lib/overlay.test.ts",
];

const FORBIDDEN_PATTERN = "\\bgusto\\b|jstack\\.gusto|JSTACK_GUSTO";

describe("core purity", () => {
  it("only allow-listed files contain gusto/jstack.gusto/JSTACK_GUSTO literals in code paths", () => {
    let output = "";
    try {
      output = execSync(
        `rg -n --hidden ` +
          `--glob '!docs/**' ` +
          `--glob '!agents/**' ` +
          `--glob '!prompts/**' ` +
          `--glob '!examples/**' ` +
          `--glob '!templates/**' ` +
          `--glob '!skill-catalog.json' ` +
          `--glob '!skills-data.js' ` +
          `--glob '!CHANGELOG.md' ` +
          `--glob '!README.md' ` +
          `--glob '!skills/**' ` +
          `--glob '!evals/**' ` +
          `--glob '!themes/**' ` +
          `--glob '!.git/**' ` +
          `--glob '!node_modules/**' ` +
          `--glob '!index.html' ` +
          `'${FORBIDDEN_PATTERN}' .`,
        { cwd: CORE_ROOT, encoding: "utf8" },
      );
    } catch (e: unknown) {
      // ripgrep exits 1 when no matches found; that's the green case.
      const exit = (e as { status?: number }).status;
      if (exit === 1) {
        return; // success: no matches anywhere
      }
      throw e;
    }
    const offenders = output
      .split("\n")
      .filter(Boolean)
      .map((line) => line.split(":")[0])
      .filter((file) => !ALLOW_LIST_FILES.some((allowed) => file.endsWith(allowed)));
    expect(offenders, `Unexpected gusto-named hits:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("every LEGACY marker file is in the allow-list (and vice versa)", () => {
    let out = "";
    try {
      out = execSync(`rg -nl 'LEGACY: remove in v[0-9]+\\.[0-9]+\\.[0-9]+' .`, {
        cwd: CORE_ROOT,
        encoding: "utf8",
      });
    } catch (e: unknown) {
      const exit = (e as { status?: number }).status;
      if (exit === 1) out = ""; // no markers
      else throw e;
    }
    const markerFiles = out.split("\n").filter(Boolean).map((s) => s.replace(/^\.\//, ""));
    // Every file with a marker must end with an allow-listed suffix.
    for (const f of markerFiles) {
      const allowed = ALLOW_LIST_FILES.some((a) => f.endsWith(a));
      expect(allowed, `${f} has a LEGACY marker but is not in ALLOW_LIST_FILES`).toBe(true);
    }
    // Every allow-listed file should still exist; missing entries are stale.
    for (const a of ALLOW_LIST_FILES) {
      const path = join(CORE_ROOT, a);
      expect(existsSync(path), `allow-list entry ${a} does not exist on disk`).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run the test**

Run: `bun test scripts/check-core-purity.test.ts`
Expected: PASS — both assertions green. If the offenders list is non-empty, fix each file before continuing.

- [ ] **Step 3: Add the test to CI**

Confirm `package.json`'s `verify` or `check` script runs `bun test` over the whole tree, or add `scripts/check-core-purity.test.ts` explicitly. Existing `bun run check` and `bun run verify` should pick it up.

- [ ] **Step 4: Commit**

```bash
git add scripts/check-core-purity.test.ts
git commit -m "test(ci): add core-purity grep gating gusto/jstack.gusto/JSTACK_GUSTO literals"
```

---

## Task 18: Final integration check

**Files:**
- (none — this task only runs verifications.)

- [ ] **Step 1: Run the full test suite**

Run: `bun test`
Expected: all tests pass.

- [ ] **Step 2: Run typecheck**

Run: `bun run typecheck` (or whatever `package.json` defines).
Expected: clean.

- [ ] **Step 3: Run agents-check**

Run: `bun run agents-check`
Expected: clean (no token drift).

- [ ] **Step 4: Run the full verify pipeline**

Run: `bun run verify`
Expected: all gates pass, including the new core-purity test.

- [ ] **Step 5: Smoke-test the CLI manually**

```bash
# In a sibling directory with both core and a synthetic overlay:
mkdir -p /tmp/pr1-smoke/jstack.acme/config /tmp/pr1-smoke/jstack.acme/skills
cat > /tmp/pr1-smoke/jstack.acme/config/overlay.json <<'EOF'
{
  "id": "acme",
  "display_name": "Acme",
  "package_dir": "jstack.acme",
  "version": "0.1.0",
  "core_compat": "^0.x"
}
EOF
echo '{}' > /tmp/pr1-smoke/jstack.acme/config/defaults.json
cp -r /Users/jonathan.boice/Documents/GitHub/jstack/jstack.core /tmp/pr1-smoke/jstack.core
cd /tmp/pr1-smoke/jstack.core
bun cli/src/index.ts mcp list --help
# Expected: help text without the literal "gusto"
```

- [ ] **Step 6: Smoke-test deprecation alias**

```bash
JSTACK_GUSTO_ROOT=/tmp/pr1-smoke/jstack.acme bun cli/src/index.ts skills list 2>&1 | head -5
# Expected: at most one warning about JSTACK_GUSTO_ROOT being deprecated
```

- [ ] **Step 7: No commit (this task is verification-only)**

PR-1 is now ready for review. Push the branch and open a PR titled "PR-1: overlay registry + L1–L9 contamination cleanup". Reference the spec in the PR description. Wait for review and merge before starting PR-2 (which depends on `cli/src/lib/overlay.ts`).

---

## Spec coverage check

| Spec section | PR-1 task |
|--------------|-----------|
| §1 audit L1 (`JSTACK_GUSTO_PKG_DIR`) | Task 2 (deprecate), Task 9 (remove use) |
| §1 audit L2 (`DISTRIBUTION_VERSION_DEFAULT_URL`) | Task 2, Task 16 |
| §1 audit L3 (`findPluginRoot` `nestedGusto`) | Task 9 |
| §1 audit L4 (`--overlay` help text) | Task 11 |
| §1 audit L5 (`JSTACK_GUSTO_ROOT` × 4) | Task 8 (helper), Task 10 (call sites) |
| §1 audit L6 (`distribution.github.gusto`) | Task 12 |
| §1 audit L7 (schema description) | Task 13 |
| §1 audit L8 (`gustoRelPath`) | Task 14 |
| §1 audit L9 (`package.json`) | Task 15 |
| §4.1 overlay registry / `OverlaySpec` | Task 1 |
| §4.1 `resolveOverlay`, `listOverlays` | Tasks 3–7 (note: `getOverlayRoot(id)` named in spec is covered by `listOverlays` + `findCoreAndOverlay`; no separate `getOverlayRoot(id)` exported in v1 — add later if a real consumer needs it) |
| §4.1 env override / core_compat / deprecation | Tasks 6–8 |
| §4.1 `findCoreAndOverlay` (consumed by PR-2 + PR-3) | Task 9b |
| §6 PM #1 (no `gusto` literal in core code paths) | Task 17 |
| §6 QA #1 (contamination grep) | Task 17 |
| §6 QA #2 (overlay resolution table-driven test) | Tasks 4–7 |
| §6 QA #8 (deprecation warn-once) | Task 8, Task 14 |
| §7.3 deprecation table | Tasks 2, 8, 14, 15 |
| §8.1 contamination grep exact rule | Task 17 |

All spec items in PR-1's scope are covered.

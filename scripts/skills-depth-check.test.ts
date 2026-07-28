/**
 * Tests for the skill quality gate.
 *
 * This gate runs inside `bun run check`, so both failure directions matter: a false
 * negative lets generic filler through, and a false positive blocks legitimate content.
 * Three real calibration bugs were found in this rule set by using it, and each has a
 * regression test below:
 *
 *   1. `LOC` was missing from the unit vocabulary, so "200-400 LOC" went uncounted and a
 *      skill with six real thresholds failed the threshold rule.
 *   2. `min\b` never matched "minutes" because a word character follows.
 *   3. Fiction detection could not distinguish an assertion from a placeholder, so a
 *      competitive-research skill was flagged for using "Competitor X" inside a quoted
 *      teaching example.
 *
 * The script is run as a subprocess against a temp skills tree so the real repo is untouched.
 */
import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync, existsSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "..");
const script = join(import.meta.dir, "skills-depth-check.ts");
let sandbox: string;

function makeSandbox(): string {
  const dir = mkdtempSync(join(tmpdir(), "skills-depth-"));
  mkdirSync(join(dir, "scripts"), { recursive: true });
  mkdirSync(join(dir, "skills"), { recursive: true });
  cpSync(script, join(dir, "scripts", "skills-depth-check.ts"));
  const nm = join(repoRoot, "node_modules");
  if (existsSync(nm)) {
    try {
      symlinkSync(nm, join(dir, "node_modules"), "dir");
    } catch {
      // resolution may still succeed by walking upward
    }
  }
  return dir;
}

function writeSkill(dir: string, rel: string, effort: string, body: string) {
  const d = join(dir, "skills", rel);
  mkdirSync(d, { recursive: true });
  writeFileSync(
    join(d, "SKILL.md"),
    `---\nname: jstack-${rel.replace(/\//g, "-")}\ndescription: A fixture skill used only for testing the depth gate.\ncategory: ${rel.split("/")[0]}\neffort: ${effort}\n---\n\n${body}\n`,
  );
}

async function run(dir: string, args: string[] = []) {
  const proc = Bun.spawn(["bun", join(dir, "scripts", "skills-depth-check.ts"), ...args], {
    cwd: dir,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [out, err] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
  return { code: await proc.exited, out, err };
}

const DEEP_BODY = `
## Domain rules — fixture

1. Absolute rule naming a concrete failure condition.

### Thresholds

| Signal | Threshold |
|---|---|
| Review size | 400 LOC |
| Session length | 60 minutes |
| Staleness | >30 days |

### Anti-patterns

| Anti-pattern | Why wrong | Instead |
|---|---|---|
| Guessing | Unfalsifiable | Measure |

## Worked example

Weak: "this could be better".
Sharp: "the filter column is unindexed, so this scans; add the composite index."

Out of scope: anything this skill must not do.
`;

const THIN_BODY = `
## What this skill is for
Look something up and return it.
`;

beforeAll(() => {
  sandbox = makeSandbox();
});
afterAll(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe("skills-depth-check — tiering by effort", () => {
  test("a thin low-effort skill passes: depth scales with judgment load", async () => {
    writeSkill(sandbox, "lookup/get", "low", THIN_BODY);
    const { code, out } = await run(sandbox);
    expect(code).toBe(0);
    expect(out).toContain("Tier C");
    rmSync(join(sandbox, "skills", "lookup"), { recursive: true });
  });

  test("a thin HIGH-effort skill is flagged on every Tier A rule", async () => {
    writeSkill(sandbox, "analysis/deep", "max", THIN_BODY);
    const { out } = await run(sandbox);
    for (const rule of ["domain-rules", "thresholds", "anti-patterns", "worked-example", "scope-edge"]) {
      expect(out).toContain(rule);
    }
    rmSync(join(sandbox, "skills", "analysis"), { recursive: true });
  });

  test("a deep high-effort skill fully meets its tier", async () => {
    writeSkill(sandbox, "analysis/deep", "max", DEEP_BODY);
    const { code, out } = await run(sandbox);
    expect(code).toBe(0);
    expect(out).toMatch(/Tier A: 1\/1/);
    rmSync(join(sandbox, "skills", "analysis"), { recursive: true });
  });

  test("--strict promotes depth findings to failures", async () => {
    writeSkill(sandbox, "analysis/deep", "max", THIN_BODY);
    const { code } = await run(sandbox, ["--strict"]);
    expect(code).toBe(1);
    rmSync(join(sandbox, "skills", "analysis"), { recursive: true });
  });
});

describe("skills-depth-check — correctness (always fatal)", () => {
  test("rejects the dead generic template prose", async () => {
    writeSkill(
      sandbox,
      "x/y",
      "low",
      "Prefer read-only first, then idempotent updates, then irreversible changes — each gated by org norms.",
    );
    const { code, out } = await run(sandbox);
    expect(code).toBe(1);
    expect(out).toContain("dead-boilerplate");
    rmSync(join(sandbox, "skills", "x"), { recursive: true });
  });

  test("flags fabricated org data ASSERTED as fact", async () => {
    writeSkill(sandbox, "x/y", "low", "Our SOC2 audit in September blocks any data handling change.");
    const { code, out } = await run(sandbox);
    expect(code).toBe(1);
    expect(out).toContain("fiction");
    rmSync(join(sandbox, "skills", "x"), { recursive: true });
  });

  // Regression: the same token inside a quoted illustration is correct teaching content.
  test("does NOT flag the same token used as a placeholder in an example", async () => {
    writeSkill(
      sandbox,
      "x/y",
      "low",
      `Separate claim from evidence: "Competitor X is the market leader" is a claim; a dated metric is evidence.`,
    );
    const { code, out } = await run(sandbox);
    expect(code).toBe(0);
    expect(out).not.toContain("fiction");
    rmSync(join(sandbox, "skills", "x"), { recursive: true });
  });

  test("requires effort frontmatter, since it drives the tier", async () => {
    const d = join(sandbox, "skills", "noeffort");
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, "SKILL.md"), `---\nname: jstack-noeffort\ndescription: Missing effort.\ncategory: x\n---\n\nbody\n`);
    const { code, out } = await run(sandbox);
    expect(code).toBe(1);
    expect(out).toContain("missing-effort");
    rmSync(d, { recursive: true });
  });
});

describe("skills-depth-check — threshold detection regressions", () => {
  test("counts domain units like LOC that an earlier vocabulary omitted", async () => {
    const body = DEEP_BODY.replace(
      "| Review size | 400 LOC |\n| Session length | 60 minutes |\n| Staleness | >30 days |",
      "| Review size | 200 LOC |\n| Pace | 400 LOC |\n| Cap | 450 LOC |",
    );
    writeSkill(sandbox, "analysis/loc", "high", body);
    const { out } = await run(sandbox);
    expect(out).not.toMatch(/analysis\/loc.*thresholds/);
    rmSync(join(sandbox, "skills", "analysis"), { recursive: true });
  });

  test("counts 'minutes', which a trailing word-boundary previously rejected", async () => {
    const body = DEEP_BODY.replace(
      "| Review size | 400 LOC |\n| Session length | 60 minutes |\n| Staleness | >30 days |",
      "| A | 60 minutes |\n| B | 30 minutes |\n| C | 90 minutes |",
    );
    writeSkill(sandbox, "analysis/mins", "high", body);
    const { out } = await run(sandbox);
    expect(out).not.toMatch(/analysis\/mins.*thresholds/);
    rmSync(join(sandbox, "skills", "analysis"), { recursive: true });
  });

  // Irreducibly qualitative Tier A domains (e.g. announcement review) express binding
  // constraints as approval gates and ordering, which is equally checkable.
  test("accepts a qualitative approve/revise/block criteria table instead of numbers", async () => {
    const body = `
## Domain rules — fixture

1. An absolute rule.

### Thresholds

| Criterion | Gate |
|---|---|
| Named approver recorded before send | required |
| Internal informed before external | required |
| Draft reviewed before recipients populated | required |

### Anti-patterns

| Anti-pattern | Why wrong | Instead |
|---|---|---|
| Send-then-review | Irreversible | Approve first |

## Worked example

Weak: "looks fine to send".
Sharp: "no approver is recorded; blocking until one signs off."

Out of scope: drafting the announcement itself.
`;
    writeSkill(sandbox, "review/qualitative", "high", body);
    const { code, out } = await run(sandbox);
    expect(code).toBe(0);
    expect(out).not.toMatch(/review\/qualitative.*thresholds/);
    rmSync(join(sandbox, "skills", "review"), { recursive: true });
  });
});

describe("skills-depth-check — reasoned exemptions", () => {
  // An exemption must be visible in output and must waive only the rule it names, so a
  // waiver can never be a silent way to turn a number green.
  test("the real exemption is reported with its reason, not hidden", async () => {
    const proc = Bun.spawn(["bun", script], { cwd: repoRoot, stdout: "pipe", stderr: "pipe" });
    const out = await new Response(proc.stdout).text();
    await proc.exited;
    expect(out).toContain("EXEMPTED");
    expect(out).toContain("computer-use/cua");
    // The justification must be present, not just the fact of the waiver.
    expect(out).toMatch(/routing tables|cosmetic/i);
  });

  test("an exemption waives only the named rule", async () => {
    // cua is exempt from `thresholds` only; it must still be held to the other Tier A rules.
    const proc = Bun.spawn(["bun", script, "--json"], { cwd: repoRoot, stdout: "pipe", stderr: "pipe" });
    const out = await new Response(proc.stdout).text();
    await proc.exited;
    const j = JSON.parse(out);
    const ids = j.exempted.map((e: { id: string }) => e.id);
    expect(ids).toEqual(["thresholds"]);
    expect(j.exempted).toHaveLength(1);
  });
});

describe("skills-depth-check — output contract", () => {
  test("--json emits only JSON on stdout", async () => {
    writeSkill(sandbox, "analysis/deep", "max", DEEP_BODY);
    const { out } = await run(sandbox, ["--json"]);
    const parsed = JSON.parse(out);
    expect(parsed.skills).toBeGreaterThan(0);
    expect(parsed.correctness_errors).toBe(0);
    expect(parsed.tiers.A).toBe(1);
    rmSync(join(sandbox, "skills", "analysis"), { recursive: true });
  });
});

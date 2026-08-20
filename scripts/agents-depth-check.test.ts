/**
 * Tests for the agent quality gate.
 *
 * This gate runs inside `bun run check`, so a false negative silently lets a generic
 * agent through and a false positive blocks a good one. Both matter, so the fixtures
 * below cover each direction: a deliberately shallow agent must be flagged on every
 * depth rule, and a rich one must pass all of them.
 *
 * The script is exercised as a subprocess against a temp `agents/` directory so the
 * real repo is never touched.
 */
import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  cpSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "..");
const script = join(import.meta.dir, "agents-depth-check.ts");

let sandbox: string;

/** Minimal sandbox: the script resolves agents/ relative to its own parent, so mirror that. */
function makeSandbox(): string {
  const dir = mkdtempSync(join(tmpdir(), "agents-depth-"));
  mkdirSync(join(dir, "scripts", "lib"), { recursive: true });
  mkdirSync(join(dir, "agents"), { recursive: true });
  cpSync(script, join(dir, "scripts", "agents-depth-check.ts"));
  // The script now sources frontmatter parsing from the shared module — mirror it too.
  cpSync(
    join(repoRoot, "scripts", "lib", "parse-frontmatter.ts"),
    join(dir, "scripts", "lib", "parse-frontmatter.ts"),
  );
  // The script imports js-yaml; reuse the repo's install rather than re-resolving.
  const nm = join(repoRoot, "node_modules");
  if (existsSync(nm)) {
    try {
      require("node:fs").symlinkSync(nm, join(dir, "node_modules"), "dir");
    } catch {
      // Symlink unsupported/exists — bun can still resolve upward in most cases.
    }
  }
  return dir;
}

function writeAgent(dir: string, file: string, contents: string) {
  writeFileSync(join(dir, "agents", file), contents);
}

async function run(
  dir: string,
  args: string[] = [],
): Promise<{ code: number; out: string; err: string }> {
  const proc = Bun.spawn(
    ["bun", join(dir, "scripts", "agents-depth-check.ts"), ...args],
    {
      cwd: dir,
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [out, err] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  return { code, out, err };
}

const REQUIRED_SECTIONS = `
## Role
Owns a thing.

## Specialty
Something specific.

## Configuration read order and unset behavior
1. **\`team.*\`** — unset → ask once.

## Evidence chain (internal)
- Nothing.

## Failure modes
- **No access** — say so.
`;

/** An agent with every depth signal present. */
const RICH_AGENT = `---
name: jstack-rich-example
description: >-
  A deliberately complete example agent used only as a test fixture, long enough to clear the
  description length floor, and stating when to prefer it rather than a neighbouring agent.
model: inherit
---
${REQUIRED_SECTIONS}

## Prime Directives
1. Name the exact failure, never "handle errors".
2. Every claim cites evidence.

## Domain heuristics
| Signal | Threshold |
|--------|-----------|
| Response budget | 200ms |
| Contrast | 4.5:1 |
| Payload | 250KB |

## Named anti-patterns
| Anti-pattern | Why wrong | Instead |
|---|---|---|
| Guessing | Unfalsifiable | Measure |

## Worked examples
Weak: "perf could be better".
Sharp: "INP is 400ms because the handler blocks; split the work."

## What this agent does NOT own
Implementation. Defer to the other-example agent.

## Determinism when calling tools
Prefer idempotent, reproducible calls with machine-readable output.

${Array.from({ length: 100 }, (_, i) => `Line ${i} of substance.`).join("\n")}
`;

/** An agent that parses cleanly but is pure routing filler — must be flagged on depth. */
const SHALLOW_AGENT = `---
name: jstack-shallow-example
description: >-
  A shallow fixture agent whose description is long enough to satisfy the length floor but
  which contains none of the depth signals the gate looks for in a real specialist.
model: inherit
---
${REQUIRED_SECTIONS}
`;

beforeAll(() => {
  sandbox = makeSandbox();
});
afterAll(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe("agents-depth-check — correctness (always fatal)", () => {
  test("rejects frontmatter keys unsupported for plugin-shipped agents", async () => {
    writeAgent(
      sandbox,
      "bad-keys.md",
      RICH_AGENT.replace(
        "model: inherit",
        "model: inherit\nhooks:\n  Stop: []",
      ),
    );
    const { code, out } = await run(sandbox);
    expect(code).toBe(1);
    expect(out).toContain("hooks");
    expect(out).toContain("not supported for plugin-shipped agents");
    rmSync(join(sandbox, "agents", "bad-keys.md"));
  });

  test("rejects a name that is not jstack-<kebab>", async () => {
    writeAgent(
      sandbox,
      "bad-name.md",
      RICH_AGENT.replace("jstack-rich-example", "NotJstack_Name"),
    );
    const { code, out } = await run(sandbox);
    expect(code).toBe(1);
    expect(out).toContain("name must match jstack-<kebab-case>");
    rmSync(join(sandbox, "agents", "bad-name.md"));
  });

  test("rejects a missing required section", async () => {
    writeAgent(
      sandbox,
      "no-section.md",
      RICH_AGENT.replace("## Failure modes", "## Something Else"),
    );
    const { code, out } = await run(sandbox);
    expect(code).toBe(1);
    expect(out).toContain("## Failure modes");
    rmSync(join(sandbox, "agents", "no-section.md"));
  });

  test("rejects fabricated organization data", async () => {
    writeAgent(
      sandbox,
      "fiction.md",
      RICH_AGENT + "\nWe track ARR at Acme Platform this quarter.\n",
    );
    const { code, out } = await run(sandbox);
    expect(code).toBe(1);
    expect(out).toContain("fabricated organization data");
    rmSync(join(sandbox, "agents", "fiction.md"));
  });

  test("rejects a description too thin to route on", async () => {
    writeAgent(
      sandbox,
      "thin.md",
      RICH_AGENT.replace(
        /description: >-\n(.*\n)+?model:/,
        "description: Does stuff.\nmodel:",
      ),
    );
    const { code, out } = await run(sandbox);
    expect(code).toBe(1);
    expect(out).toContain("too thin to route on");
    rmSync(join(sandbox, "agents", "thin.md"));
  });
});

describe("agents-depth-check — depth scoring", () => {
  test("a complete agent scores full marks and passes", async () => {
    writeAgent(sandbox, "rich.md", RICH_AGENT);
    const { code, out } = await run(sandbox);
    expect(code).toBe(0);
    expect(out).toMatch(/7\/7\s+rich\.md/);
    rmSync(join(sandbox, "agents", "rich.md"));
  });

  test("a shallow agent is flagged on every depth rule but does not fail by default", async () => {
    writeAgent(sandbox, "shallow.md", SHALLOW_AGENT);
    const { code, out } = await run(sandbox);
    // Depth is advisory unless --strict, so a shallow agent must not break the build yet.
    expect(code).toBe(0);
    expect(out).toMatch(/0\/7\s+shallow\.md/);
    for (const rule of [
      "prime-directives",
      "thresholds",
      "anti-patterns",
      "worked-examples",
      "ownership-boundary",
      "determinism",
      "substance",
    ]) {
      expect(out).toContain(rule);
    }
    rmSync(join(sandbox, "agents", "shallow.md"));
  });

  test("--strict promotes depth advisories to failures", async () => {
    writeAgent(sandbox, "shallow.md", SHALLOW_AGENT);
    const { code } = await run(sandbox, ["--strict"]);
    expect(code).toBe(1);
    rmSync(join(sandbox, "agents", "shallow.md"));
  });

  // Regression: domains like orchestration and code review express limits as bare counts
  // (≤3 retries, >400 LOC). Requiring a unit suffix wrongly failed them.
  test("counts comparison thresholds without unit suffixes", async () => {
    const comparisonsOnly = RICH_AGENT.replace(
      /\| Response budget \| 200ms \|\n\| Contrast \| 4\.5:1 \|\n\| Payload \| 250KB \|/,
      "| Retry attempts | ≤3 |\n| Fan-out width | ≤10 |\n| Review size | >400 |",
    );
    writeAgent(sandbox, "cmp.md", comparisonsOnly);
    const { out } = await run(sandbox);
    expect(out).toMatch(/7\/7\s+cmp\.md/);
    rmSync(join(sandbox, "agents", "cmp.md"));
  });

  // Regression: a tight weak→sharp window perversely penalised the most detailed examples,
  // because a thorough weak-plan block runs well past a few hundred characters.
  test("accepts a weak-vs-sharp contrast separated by a long example block", async () => {
    const longExample = RICH_AGENT.replace(
      'Weak: "perf could be better".\nSharp: "INP is 400ms because the handler blocks; split the work."',
      `Weak plan — vague:\n${Array.from({ length: 20 }, (_, i) => `${i}. A step with no verification condition stated anywhere at all.`).join("\n")}\n\nSharp plan — each step names its own verification command.`,
    );
    writeAgent(sandbox, "longex.md", longExample);
    const { out } = await run(sandbox);
    expect(out).toMatch(/7\/7\s+longex\.md/);
    rmSync(join(sandbox, "agents", "longex.md"));
  });

  // Regression: `%\b` and `:1\b` can never match, which previously undercounted any agent
  // whose thresholds were percentages or contrast ratios.
  test("counts percentage and ratio thresholds, not just word-unit ones", async () => {
    const pctOnly = RICH_AGENT.replace(
      /\| Response budget \| 200ms \|\n\| Contrast \| 4\.5:1 \|\n\| Payload \| 250KB \|/,
      "| Availability | 99.9% |\n| Contrast | 4.5:1 |\n| Error rate | 1% |",
    );
    writeAgent(sandbox, "pct.md", pctOnly);
    const { out } = await run(sandbox);
    expect(out).toMatch(/7\/7\s+pct\.md/);
    rmSync(join(sandbox, "agents", "pct.md"));
  });
});

describe("agents-depth-check — output contract", () => {
  test("--json emits only JSON on stdout so it stays machine-parseable", async () => {
    writeAgent(sandbox, "rich.md", RICH_AGENT);
    const { out } = await run(sandbox, ["--json"]);
    const parsed = JSON.parse(out); // must not throw — no prose interleaved
    expect(parsed.agents).toBeGreaterThan(0);
    expect(parsed.correctness_errors).toBe(0);
    expect(parsed.depth_scores["rich.md"]).toBe("7/7");
    rmSync(join(sandbox, "agents", "rich.md"));
  });

  test("flags two agents sharing the same first primary skill", async () => {
    // The rule deliberately skips when BOTH descriptions carry a preference cue
    // ("prefer"/"instead"/"rather than"/...), so strip that cue here to trigger it.
    const withRoute = (name: string, suffix: string) =>
      RICH_AGENT.replace("jstack-rich-example", name)
        .replace(
          /description: >-\n(?:.*\n)+?model:/,
          `description: A fixture agent with an intentionally undifferentiated description that is long enough to clear the length floor, covering topic ${suffix}.\nmodel:`,
        )
        .replace(
          "## What this agent does NOT own",
          "## Primary skills (ordered)\n\n1. `jstack:recon` — first route.\n\n## What this agent does NOT own",
        );
    writeAgent(sandbox, "route-a.md", withRoute("jstack-route-a", "alpha"));
    writeAgent(sandbox, "route-b.md", withRoute("jstack-route-b", "beta"));
    const { out } = await run(sandbox);
    expect(out).toContain("shared-primary-route");
    rmSync(join(sandbox, "agents", "route-a.md"));
    rmSync(join(sandbox, "agents", "route-b.md"));
  });

  test("does NOT flag a shared route when both descriptions state a preference", async () => {
    // Regression guard on the escape hatch: sharing a route is acceptable when each
    // description says when to prefer it, which is how frontend/backend coexist.
    const withRoute = (name: string) =>
      RICH_AGENT.replace("jstack-rich-example", name).replace(
        "## What this agent does NOT own",
        "## Primary skills (ordered)\n\n1. `jstack:recon` — first route.\n\n## What this agent does NOT own",
      );
    writeAgent(sandbox, "pref-a.md", withRoute("jstack-pref-a"));
    writeAgent(sandbox, "pref-b.md", withRoute("jstack-pref-b"));
    const { out } = await run(sandbox);
    expect(out).not.toContain("shared-primary-route");
    rmSync(join(sandbox, "agents", "pref-a.md"));
    rmSync(join(sandbox, "agents", "pref-b.md"));
  });
});

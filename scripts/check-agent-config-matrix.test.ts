/**
 * Regression test for check-agent-config-matrix.ts, proving it catches real drift (true
 * positive) and stays quiet on matching content (true negative) -- the exact two properties
 * asked for when this gate was built, since the whole point of the check is a heuristic text
 * match that could plausibly misfire either way.
 *
 * The script is exercised as a subprocess against a temp tree mirroring just its own file and a
 * synthetic agents/ + docs/ pair, so the real 24 agents are never touched and drift in the real
 * matrix can't make this test flaky.
 */
import { describe, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "..");
let sandbox: string;

/** The script resolves its own root from `import.meta.url`, so it must be copied INTO the
 * sandbox (not invoked from its real repo path) for the sandbox's agents/docs to be what it
 * actually reads. */
function makeSandbox(): string {
  const dir = mkdtempSync(join(tmpdir(), "check-agent-matrix-"));
  mkdirSync(join(dir, "agents"), { recursive: true });
  mkdirSync(join(dir, "docs"), { recursive: true });
  mkdirSync(join(dir, "scripts"), { recursive: true });
  cpSync(
    join(repoRoot, "scripts", "check-agent-config-matrix.ts"),
    join(dir, "scripts", "check-agent-config-matrix.ts"),
  );
  return dir;
}

function writeAgent(dir: string, readOrderBody: string): void {
  writeFileSync(
    join(dir, "agents", "test-agent.md"),
    `---\nname: test-agent\n---\n\n## Configuration read order and unset behavior\n\n${readOrderBody}\n\n## Evidence chain (internal)\n\n- placeholder\n`,
  );
}

function writeMatrix(dir: string, row: string): void {
  writeFileSync(
    join(dir, "docs", "agents-config-matrix.md"),
    `## Configuration matrix\n\n| Agent | Primary config namespaces | Key prompts / policies | When unset / degradation |\n|-------|---------------------------|-------------------------|---------------------------|\n${row}\n`,
  );
}

async function run(
  dir: string,
  args: string[] = [],
): Promise<{ code: number; out: string }> {
  const proc = Bun.spawn(
    ["bun", join(dir, "scripts", "check-agent-config-matrix.ts"), ...args],
    { cwd: dir, stdout: "pipe", stderr: "pipe" },
  );
  const [out, err] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  return { code, out: out + err };
}

test("true negative: matching namespace on both sides reports OK, exit 0", async () => {
  sandbox = makeSandbox();
  try {
    writeAgent(
      sandbox,
      "1. **`policies.incidents`** — severities; unset → narrative only.\n2. **`engineering_health`** — corroboration.",
    );
    writeMatrix(
      sandbox,
      "| `test-agent` | `policies.incidents`, `engineering_health` | — | — |",
    );
    const { code, out } = await run(sandbox, ["--strict"]);
    expect(code).toBe(0);
    expect(out).toContain("OK");
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test("true positive: file reads a namespace the matrix row omits", async () => {
  sandbox = makeSandbox();
  try {
    writeAgent(
      sandbox,
      "1. **`policies.incidents`** — severities; unset → narrative only.\n2. **`team.members`** — ownership context.",
    );
    writeMatrix(sandbox, "| `test-agent` | `policies.incidents` | — | — |");
    const { code, out } = await run(sandbox, ["--strict"]);
    expect(code).toBe(1);
    expect(out).toContain("team");
    expect(out).toContain("never mentions it");
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test("true positive: matrix row claims a namespace the file's read order never mentions", async () => {
  sandbox = makeSandbox();
  try {
    writeAgent(
      sandbox,
      "1. **`policies.incidents`** — severities; unset → narrative only.",
    );
    writeMatrix(
      sandbox,
      "| `test-agent` | `policies.incidents`, `skill_defaults.reports` | — | — |",
    );
    const { code, out } = await run(sandbox, ["--strict"]);
    expect(code).toBe(1);
    expect(out).toContain("skill_defaults");
    expect(out).toContain("file's own read-order section never mentions it");
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test("non-strict mode reports drift but exits 0 (local look, not a blocking gate)", async () => {
  sandbox = makeSandbox();
  try {
    writeAgent(
      sandbox,
      "1. **`policies.incidents`** — severities.\n2. **`team.members`** — ctx.",
    );
    writeMatrix(sandbox, "| `test-agent` | `policies.incidents` | — | — |");
    const { code, out } = await run(sandbox, []);
    expect(code).toBe(0);
    expect(out).toContain("drift issue");
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test("missing matrix row for an agent with a read-order section is flagged", async () => {
  sandbox = makeSandbox();
  try {
    writeAgent(sandbox, "1. **`policies.incidents`** — severities.");
    writeMatrix(
      sandbox,
      "| `some-other-agent` | `policies.incidents` | — | — |",
    );
    const { code, out } = await run(sandbox, ["--strict"]);
    expect(code).toBe(1);
    expect(out).toContain("no row in");
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test("does not flag a real-world non-namespace bolded label (no backticks) as drift", async () => {
  sandbox = makeSandbox();
  try {
    writeAgent(
      sandbox,
      "1. **`policies.incidents`** — severities.\n2. **Merge conflicts** — always ask before overwriting.",
    );
    writeMatrix(sandbox, "| `test-agent` | `policies.incidents` | — | — |");
    const { code, out } = await run(sandbox, ["--strict"]);
    expect(code).toBe(0);
    expect(out).toContain("OK");
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test("does not flag env-var-shaped or file-path-shaped tokens as config namespaces", async () => {
  sandbox = makeSandbox();
  try {
    writeAgent(
      sandbox,
      "1. **`policies.incidents`** — severities.\n2. **`JSTACK_EVAL_COVERAGE_MIN`** — override.\n3. **`config/schedules/<id>.json`** — file.",
    );
    writeMatrix(sandbox, "| `test-agent` | `policies.incidents` | — | — |");
    const { code, out } = await run(sandbox, ["--strict"]);
    expect(code).toBe(0);
    expect(out).toContain("OK");
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

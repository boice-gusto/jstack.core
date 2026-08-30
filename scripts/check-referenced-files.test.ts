/**
 * Regression test for check-referenced-files.ts. Exercised as a subprocess against a temp tree
 * mirroring just its own dependency (evals/discover.ts) plus a synthetic skills/ tree, so the
 * real 143 skills are never touched and drift there can't make this test flaky.
 */
import { existsSync, symlinkSync } from "node:fs";
import { expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "..");

function makeSandbox(): string {
  const dir = mkdtempSync(join(tmpdir(), "check-ref-files-"));
  mkdirSync(join(dir, "scripts"), { recursive: true });
  mkdirSync(join(dir, "evals"), { recursive: true });
  mkdirSync(join(dir, "skills"), { recursive: true });
  cpSync(
    join(repoRoot, "scripts", "check-referenced-files.ts"),
    join(dir, "scripts", "check-referenced-files.ts"),
  );
  cpSync(
    join(repoRoot, "evals", "discover.ts"),
    join(dir, "evals", "discover.ts"),
  );
  const nm = join(repoRoot, "node_modules");
  if (existsSync(nm)) {
    try {
      symlinkSync(nm, join(dir, "node_modules"), "dir");
    } catch {
      // Symlink unsupported/exists — bun can still resolve upward in most cases.
    }
  }
  return dir;
}

function writeSkill(dir: string, rel: string, body: string): void {
  const skillDir = join(dir, "skills", rel);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, "SKILL.md"), body);
}

async function run(
  dir: string,
  args: string[] = [],
): Promise<{ code: number; out: string }> {
  const proc = Bun.spawn(
    ["bun", join(dir, "scripts", "check-referenced-files.ts"), ...args],
    { cwd: dir, stdout: "pipe", stderr: "pipe" },
  );
  const [out, err] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  return { code, out: out + err };
}

test("true negative: a path that exists on disk resolves cleanly", async () => {
  const dir = makeSandbox();
  try {
    mkdirSync(join(dir, "templates", "foo"), { recursive: true });
    writeFileSync(join(dir, "templates", "foo", "bar.json"), "{}");
    writeSkill(
      dir,
      "foo",
      "---\nname: jstack-foo\ndescription: Uses templates/foo/bar.json.\n---\n\nBody.\n",
    );
    const { code, out } = await run(dir, ["--strict"]);
    expect(code).toBe(0);
    expect(out).toContain("1 file reference");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("true positive: a path that doesn't exist and isn't hedged is flagged", async () => {
  const dir = makeSandbox();
  try {
    writeSkill(
      dir,
      "foo",
      "---\nname: jstack-foo\ndescription: Uses templates/foo/missing.json.\n---\n\nBody.\n",
    );
    const { code, out } = await run(dir, ["--strict"]);
    expect(code).toBe(1);
    expect(out).toContain("templates/foo/missing.json");
    expect(out).toContain("does not exist");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('"if present" hedge suppresses a missing-path flag', async () => {
  const dir = makeSandbox();
  try {
    writeSkill(
      dir,
      "foo",
      "---\nname: jstack-foo\ndescription: Foo.\n---\n\nSee templates/foo/missing.json if present.\n",
    );
    const { code, out } = await run(dir, ["--strict"]);
    expect(code).toBe(0);
    expect(out).toContain("OK");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('"e.g." hedge suppresses a fill-in-the-blank example path', async () => {
  const dir = makeSandbox();
  try {
    writeSkill(
      dir,
      "foo",
      "---\nname: jstack-foo\ndescription: Foo.\n---\n\nName a path (e.g. skills/my-domain/SKILL.md).\n",
    );
    const { code, out } = await run(dir, ["--strict"]);
    expect(code).toBe(0);
    expect(out).toContain("OK");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a hedge word outside the 80-char window does NOT suppress a real miss", async () => {
  const dir = makeSandbox();
  try {
    const filler = "x".repeat(100);
    writeSkill(
      dir,
      "foo",
      `---\nname: jstack-foo\ndescription: Foo.\n---\n\noptional. ${filler} See templates/foo/missing.json.\n`,
    );
    const { code, out } = await run(dir, ["--strict"]);
    expect(code).toBe(1);
    expect(out).toContain("does not exist");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("non-strict mode reports the break but exits 0", async () => {
  const dir = makeSandbox();
  try {
    writeSkill(
      dir,
      "foo",
      "---\nname: jstack-foo\ndescription: Uses templates/foo/missing.json.\n---\n\nBody.\n",
    );
    const { code, out } = await run(dir, []);
    expect(code).toBe(0);
    expect(out).toContain("broken reference");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

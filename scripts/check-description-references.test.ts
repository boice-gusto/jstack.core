/**
 * Regression test for check-description-references.ts. The script is exercised as a subprocess
 * against a temp tree mirroring just its own dependencies (evals/discover.ts,
 * evals/chain-resolve.ts, scripts/lib/parse-frontmatter.ts) plus a synthetic skills/ tree, so the
 * real 143 skills are never touched and drift there can't make this test flaky.
 */
import { existsSync, symlinkSync } from "node:fs";
import { expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "..");

function makeSandbox(): string {
  const dir = mkdtempSync(join(tmpdir(), "check-desc-refs-"));
  mkdirSync(join(dir, "scripts", "lib"), { recursive: true });
  mkdirSync(join(dir, "evals"), { recursive: true });
  mkdirSync(join(dir, "skills"), { recursive: true });
  for (const rel of [
    ["scripts", "check-description-references.ts"],
    ["scripts", "lib", "parse-frontmatter.ts"],
    ["evals", "discover.ts"],
    ["evals", "chain-resolve.ts"],
  ]) {
    cpSync(join(repoRoot, ...rel), join(dir, ...rel));
  }
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

function writeSkill(
  dir: string,
  rel: string,
  name: string,
  description: string,
): void {
  const skillDir = join(dir, "skills", rel);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(
    join(skillDir, "SKILL.md"),
    `---\nname: ${name}\ndescription: ${description}\ncategory: test\neffort: low\n---\n\nBody.\n`,
  );
}

async function run(
  dir: string,
  args: string[] = [],
): Promise<{ code: number; out: string }> {
  const proc = Bun.spawn(
    ["bun", join(dir, "scripts", "check-description-references.ts"), ...args],
    { cwd: dir, stdout: "pipe", stderr: "pipe" },
  );
  const [out, err] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  return { code, out: out + err };
}

test("true negative: a disambiguation reference to a real sibling resolves cleanly", async () => {
  const dir = makeSandbox();
  try {
    writeSkill(
      dir,
      "foo",
      "jstack-foo",
      "Do foo. For bar, use jstack:bar instead.",
    );
    writeSkill(dir, "bar", "jstack-bar", "Do bar.");
    const { code, out } = await run(dir, ["--strict"]);
    expect(code).toBe(0);
    expect(out).toContain("OK");
    expect(out).toContain("1 disambiguation reference");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("true positive: a disambiguation reference to a nonexistent skill is flagged", async () => {
  const dir = makeSandbox();
  try {
    writeSkill(
      dir,
      "foo",
      "jstack-foo",
      "Do foo. For bar, use jstack:baz instead.",
    );
    const { code, out } = await run(dir, ["--strict"]);
    expect(code).toBe(1);
    expect(out).toContain("jstack:baz");
    expect(out).toContain("does not resolve");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("true positive: resolves the hyphen-suffix naming convention, not just path form", async () => {
  const dir = makeSandbox();
  try {
    // "bar-baz" as a slash-path (skills/bar/baz) doesn't exist, but as a name suffix
    // (jstack-bar-baz) it does -- the check must try both resolution forms, same as chains-to.
    writeSkill(dir, "bar-baz", "jstack-bar-baz", "Do bar-baz.");
    writeSkill(
      dir,
      "foo",
      "jstack-foo",
      "Do foo. For bar-baz work, use jstack:bar-baz instead.",
    );
    const { code, out } = await run(dir, ["--strict"]);
    expect(code).toBe(0);
    expect(out).toContain("OK");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("no disambiguation phrase present: clean run, zero references counted", async () => {
  const dir = makeSandbox();
  try {
    writeSkill(
      dir,
      "foo",
      "jstack-foo",
      "Do foo with no cross-references at all.",
    );
    const { code, out } = await run(dir, ["--strict"]);
    expect(code).toBe(0);
    expect(out).toContain("0 disambiguation reference");
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
      "jstack-foo",
      "Do foo. For bar, use jstack:baz instead.",
    );
    const { code, out } = await run(dir, []);
    expect(code).toBe(0);
    expect(out).toContain("broken reference");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

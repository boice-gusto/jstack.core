/**
 * Regression test for the silent frontmatter-parse-failure bug in `generate-skill-evals.ts`.
 *
 * The paraphrase-routing generator used to call a hand-rolled `parseFrontmatter` that
 * swallowed ANY YAML parse error and returned `{}` with zero indication anything failed —
 * the same silent-failure shape that once cost 27/137 skill files their frontmatter (an
 * unquoted `: ` inside a description made `yaml.safe_load` return an empty mapping; see
 * the comment in `skills-depth-check.ts`). Now it routes through the shared
 * `parseYamlFrontmatter` (`scripts/lib/parse-frontmatter.ts`) and warns to stderr, naming
 * the file, instead of continuing without a trace.
 *
 * The script is exercised as a subprocess against a temp tree mirroring just enough of the
 * repo layout (scripts/, scripts/lib/, evals/, skills/) for its relative imports to resolve,
 * so the real repo's ~700 skills are never touched and the test stays fast.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "..");
let sandbox: string;

/** Mirrors just the files generate-skill-evals.ts needs to resolve its relative imports. */
function makeSandbox(): string {
  const dir = tmpNamedDir();
  mkdirSync(join(dir, "scripts", "lib"), { recursive: true });
  mkdirSync(join(dir, "evals"), { recursive: true });
  mkdirSync(join(dir, "skills"), { recursive: true });

  for (const rel of [
    ["scripts", "generate-skill-evals.ts"],
    ["scripts", "lib", "parse-frontmatter.ts"],
    ["scripts", "lib", "skill-eval-facts.ts"],
    ["scripts", "lib", "skill-eval-docs.ts"],
    ["evals", "discover.ts"],
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

function tmpNamedDir(): string {
  const { mkdtempSync } = require("node:fs");
  return mkdtempSync(join(tmpdir(), "gen-skill-evals-"));
}

function writeFixtureSkill(dir: string, rel: string, skillMd: string) {
  const skillDir = join(dir, "skills", rel);
  // The paraphrase-routing generator only considers a skill whose evals/ dir already exists.
  mkdirSync(join(skillDir, "evals"), { recursive: true });
  writeFileSync(join(skillDir, "SKILL.md"), skillMd);
}

function writeRouterList(dir: string, routers: string[]) {
  writeFileSync(
    join(dir, "evals", "router-skills.json"),
    JSON.stringify({ routers }),
  );
}

async function run(
  dir: string,
  args: string[] = [],
): Promise<{ code: number; out: string; err: string }> {
  const proc = Bun.spawn(
    ["bun", join(dir, "scripts", "generate-skill-evals.ts"), ...args],
    { cwd: dir, stdout: "pipe", stderr: "pipe" },
  );
  const [out, err] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  return { code, out, err };
}

const VALID_SKILL_MD = `---
name: jstack-goodrouter
description: A fixture orchestrator skill used only for testing eval generation.
category: test
effort: low
---

## Role
Routes to children.
`;

// An unterminated flow sequence (\`[\`) is guaranteed-invalid YAML.
const INVALID_YAML_SKILL_MD = `---
name: jstack-badyaml
description: [unterminated flow sequence causes a YAML parse failure
category: test
effort: low
---

## Role
This SKILL.md has deliberately broken frontmatter.
`;

beforeAll(() => {
  sandbox = makeSandbox();
});
afterAll(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe("generate-skill-evals — frontmatter parse failures are surfaced, not swallowed", () => {
  test("warns on stderr, names the file, and does not crash when frontmatter is invalid YAML", async () => {
    writeFixtureSkill(sandbox, "badyaml", INVALID_YAML_SKILL_MD);
    writeRouterList(sandbox, ["badyaml"]);

    const { code, err } = await run(sandbox, ["--dry-run"]);

    expect(code).toBe(0);
    // Regression check: the old code swallowed the error and returned `{}` completely
    // silently. A warning naming the file is the whole point of the fix.
    expect(err).toContain("badyaml/SKILL.md");
    expect(err).toContain("frontmatter failed to parse");

    rmSync(join(sandbox, "skills", "badyaml"), {
      recursive: true,
      force: true,
    });
  });

  test("a router skill with valid frontmatter produces no parse-failure warning", async () => {
    writeFixtureSkill(sandbox, "goodrouter", VALID_SKILL_MD);
    writeRouterList(sandbox, ["goodrouter"]);

    const { code, err } = await run(sandbox, ["--dry-run"]);

    expect(code).toBe(0);
    expect(err).not.toContain("frontmatter failed to parse");

    rmSync(join(sandbox, "skills", "goodrouter"), {
      recursive: true,
      force: true,
    });
  });
});

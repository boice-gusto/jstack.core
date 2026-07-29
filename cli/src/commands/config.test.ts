/**
 * Tests for `jstack config`.
 *
 * These exist because the command read its file with a bare `readFileSync`, so a missing config
 * surfaced as an ENOENT stack trace naming a line inside `config.ts` — while `status` and `doctor`
 * printed an actionable line for the identical condition. The failure could not be covered by an A2A
 * case: `findProjectRoot()` walks UP from the cwd, so any directory inside the repo finds the real
 * config. A unit test can control the root, which is why this lives here rather than in the harness.
 */
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const ENTRY = join(import.meta.dir, "..", "index.ts");
let dir: string;

/** Run the real CLI with cwd set to an isolated directory that has no parent jstack.config.json. */
function runConfig(cwd: string) {
  const r = spawnSync("bun", ["run", ENTRY, "config"], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, JSTACK_INTROSPECT: "", NO_COLOR: "1" },
  });
  return { code: r.status, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "jstack-config-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("missing config", () => {
  test("exits 1 with an actionable message, not a stack trace", () => {
    const { code, out } = runConfig(dir);
    expect(code).toBe(1);
    expect(out).toContain("No config at");
    expect(out).toContain("jstack setup");
    // The regression: a raw Node error surfacing implementation internals to the user.
    expect(out).not.toContain("ENOENT");
    expect(out).not.toContain("at runConfigShow");
    expect(out).not.toContain("no such file or directory");
  });
});

describe("malformed config", () => {
  test("reports invalid JSON distinctly from a missing file", () => {
    writeFileSync(join(dir, "jstack.config.json"), "{ not json ");
    const { code, out } = runConfig(dir);
    expect(code).toBe(1);
    expect(out).toContain("is not valid JSON");
    expect(out).toContain("jstack doctor");
    // Missing and malformed need different fixes, so they must not share a message.
    expect(out).not.toContain("No config at");
  });
});

describe("valid config", () => {
  test("prints the path then the file contents, and exits 0", () => {
    mkdirSync(join(dir, "sub"), { recursive: true });
    writeFileSync(join(dir, "jstack.config.json"), '{\n  "version": "9.9.9"\n}\n');
    const { code, out } = runConfig(dir);
    expect(code).toBe(0);
    expect(out).toContain("jstack.config.json");
    expect(out).toContain('"version": "9.9.9"');
  });

  test("is found from a subdirectory, since findProjectRoot walks up", () => {
    mkdirSync(join(dir, "a", "b"), { recursive: true });
    writeFileSync(join(dir, "jstack.config.json"), '{ "version": "1.2.3" }');
    const { code, out } = runConfig(join(dir, "a", "b"));
    expect(code).toBe(0);
    expect(out).toContain('"version": "1.2.3"');
  });
});

import { afterEach, describe, expect, mock, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DependencyIssue } from "../lib/dependency-resolver.js";

/**
 * `applyRepairsInteractive` is the point where doctor's `--fix --apply` and
 * `--apply-repairs <file>` actually touch the filesystem / config. Repair paths can
 * originate from a config value resolved by `absolutize()` (no containment check by
 * design — the resolver is read-only) or, for `--apply-repairs`, from a JSON file an
 * attacker fully controls. These tests prove the function refuses to write outside
 * the project/plugin roots, and refuses to let a `set_config` path pollute
 * Object.prototype, while still applying legitimate repairs mixed into the same batch.
 *
 * `@clack/prompts` and `isInteractive` are mocked so the (unattended) consent prompts
 * always say "yes" — the containment check must hold regardless of consent, since
 * consent only covers "do the repairs I was shown", not "and anything else".
 */
/**
 * `mock.module` is PROCESS-WIDE and is never restored, so anything stubbed here is what every
 * other test file in the same run imports. Stubbing `nonInteractiveHint` as `() => ""` made
 * cli/src/lib/cliUi.test.ts fail whenever bun happened to load this file first -- which differs
 * between macOS and Linux, so the suite was green locally and red in CI for a reason that had
 * nothing to do with either test. Delegate everything not deliberately overridden to the real
 * module, so the blast radius is only what these tests actually need to change.
 */
const realCliUi = await import("../lib/cliUi.js");
mock.module("../lib/cliUi.js", () => ({
  ...realCliUi,
  isInteractive: () => true,
  handleCancel: () => false,
  exitCancelled: () => {
    throw new Error("exitCancelled() should not be called in these tests");
  },
}));
mock.module("@clack/prompts", () => ({
  confirm: async () => true,
  select: async () => "done",
}));

const { applyRepairsInteractive, runDoctor } = await import("./doctor.js");

function mkFixture() {
  const projectRoot = mkdtempSync(join(tmpdir(), "jstack-doctor-project-"));
  const pluginRoot = mkdtempSync(join(tmpdir(), "jstack-doctor-plugin-"));
  const outside = mkdtempSync(join(tmpdir(), "jstack-doctor-outside-"));
  return { projectRoot, pluginRoot, outside };
}

function issue(repairs: DependencyIssue["repairs"]): DependencyIssue {
  return {
    id: "t",
    configPath: ["x"],
    severity: "error",
    message: "t",
    repairs,
  };
}

describe("applyRepairsInteractive — path containment", () => {
  test("mkdir: a traversal path is rejected and does not escape the project root", async () => {
    const { projectRoot, pluginRoot, outside } = mkFixture();
    try {
      const evilTarget = join(projectRoot, "..", "..", "pwned-" + Date.now());
      const issues = [issue([{ kind: "mkdir", path: evilTarget }])];

      const applied = await applyRepairsInteractive(
        issues,
        projectRoot,
        {},
        pluginRoot,
      );

      expect(applied).toBe(0);
      expect(existsSync(evilTarget)).toBe(false);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
      rmSync(pluginRoot, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  test("mkdir: an absolute path outside every root is rejected", async () => {
    const { projectRoot, pluginRoot, outside } = mkFixture();
    try {
      const evilTarget = join(outside, "escaped-dir");
      const issues = [issue([{ kind: "mkdir", path: evilTarget }])];

      const applied = await applyRepairsInteractive(
        issues,
        projectRoot,
        {},
        pluginRoot,
      );

      expect(applied).toBe(0);
      expect(existsSync(evilTarget)).toBe(false);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
      rmSync(pluginRoot, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  test("write_file: a traversal path is rejected and no file is written outside the root", async () => {
    const { projectRoot, pluginRoot, outside } = mkFixture();
    try {
      const evilTarget = join(
        projectRoot,
        "..",
        "..",
        "etc-passwd-" + Date.now(),
      );
      const issues = [
        issue([
          {
            kind: "write_file",
            path: evilTarget,
            content: "pwned",
            ifMissing: true,
          },
        ]),
      ];

      const applied = await applyRepairsInteractive(
        issues,
        projectRoot,
        {},
        pluginRoot,
      );

      expect(applied).toBe(0);
      expect(existsSync(evilTarget)).toBe(false);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
      rmSync(pluginRoot, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  test("a rejected repair does not block legitimate repairs in the same batch", async () => {
    const { projectRoot, pluginRoot, outside } = mkFixture();
    try {
      const goodDir = join(projectRoot, "kb", "docs");
      const evilTarget = join(outside, "escaped-dir");
      const issues = [
        issue([
          { kind: "mkdir", path: evilTarget },
          { kind: "mkdir", path: goodDir },
        ]),
      ];

      const applied = await applyRepairsInteractive(
        issues,
        projectRoot,
        {},
        pluginRoot,
      );

      expect(applied).toBe(1);
      expect(existsSync(goodDir)).toBe(true);
      expect(existsSync(evilTarget)).toBe(false);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
      rmSync(pluginRoot, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  test("write_file: a path under the plugin root (not the project root) is still allowed", async () => {
    const { projectRoot, pluginRoot, outside } = mkFixture();
    try {
      // Mirrors checkNotionTemplateSet's repair, which targets pluginRoot, not projectRoot.
      const target = join(
        pluginRoot,
        "templates",
        "notion",
        "catalog",
        "custom.json",
      );
      const issues = [
        issue([
          { kind: "write_file", path: target, content: "{}", ifMissing: true },
        ]),
      ];

      const applied = await applyRepairsInteractive(
        issues,
        projectRoot,
        {},
        pluginRoot,
      );

      expect(applied).toBe(1);
      expect(existsSync(target)).toBe(true);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
      rmSync(pluginRoot, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  test("mkdir: an ordinary in-project path is still applied normally (regression check)", async () => {
    const { projectRoot, pluginRoot, outside } = mkFixture();
    try {
      const target = join(projectRoot, "docs", "notes");
      const issues = [issue([{ kind: "mkdir", path: target }])];

      const applied = await applyRepairsInteractive(
        issues,
        projectRoot,
        {},
        pluginRoot,
      );

      expect(applied).toBe(1);
      expect(existsSync(target)).toBe(true);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
      rmSync(pluginRoot, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });
});

describe("applyRepairsInteractive — set_config prototype pollution", () => {
  test("a __proto__ path does not pollute Object.prototype", async () => {
    const { projectRoot, pluginRoot, outside } = mkFixture();
    try {
      expect(
        (Object.prototype as Record<string, unknown>).polluted,
      ).toBeUndefined();

      const issues = [
        issue([
          {
            kind: "set_config",
            path: ["__proto__", "polluted"],
            value: "PWNED",
          },
        ]),
      ];
      await applyRepairsInteractive(issues, projectRoot, {}, pluginRoot);

      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
      expect(
        (Object.prototype as Record<string, unknown>).polluted,
      ).toBeUndefined();
    } finally {
      delete (Object.prototype as Record<string, unknown>).polluted;
      rmSync(projectRoot, { recursive: true, force: true });
      rmSync(pluginRoot, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  test("a constructor.prototype path does not pollute Object.prototype", async () => {
    const { projectRoot, pluginRoot, outside } = mkFixture();
    try {
      const issues = [
        issue([
          {
            kind: "set_config",
            path: ["constructor", "prototype", "polluted2"],
            value: "PWNED",
          },
        ]),
      ];
      await applyRepairsInteractive(issues, projectRoot, {}, pluginRoot);

      expect(({} as Record<string, unknown>).polluted2).toBeUndefined();
      expect(
        (Object.prototype as Record<string, unknown>).polluted2,
      ).toBeUndefined();
    } finally {
      delete (Object.prototype as Record<string, unknown>).polluted2;
      rmSync(projectRoot, { recursive: true, force: true });
      rmSync(pluginRoot, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  test("a legitimate set_config repair still writes jstack.config.json", async () => {
    const { projectRoot, pluginRoot, outside } = mkFixture();
    try {
      const issues = [
        issue([
          { kind: "set_config", path: ["team", "name"], value: "Platform" },
        ]),
      ];
      const applied = await applyRepairsInteractive(
        issues,
        projectRoot,
        {},
        pluginRoot,
      );

      expect(applied).toBe(1);
      const written = JSON.parse(
        readFileSync(join(projectRoot, "jstack.config.json"), "utf8"),
      );
      expect(written.team.name).toBe("Platform");
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
      rmSync(pluginRoot, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });
});

/**
 * `runDoctor`'s six flags (fix/apply/strict/json/saveRepairs/applyRepairs) are read
 * independently, so combinations like `--json --fix` used to silently drop part of the
 * request instead of erroring (the json branch returns before fix/apply/saveRepairs are
 * read; apply/saveRepairs were only read inside `if (opts.fix)`; apply-repairs returned
 * before the fix block). These tests confirm each invalid combination now fails loudly
 * and exits non-zero, all before `findProjectRoot()`/config are ever touched — so no
 * fixture directory is needed here.
 */
describe("runDoctor — invalid flag combinations", () => {
  async function captureLog(fn: () => Promise<void>): Promise<string> {
    const logs: string[] = [];
    const orig = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };
    try {
      await fn();
    } finally {
      console.log = orig;
    }
    return logs.join("\n");
  }

  afterEach(() => {
    process.exitCode = 0;
  });

  test("--json combined with --fix errors instead of dropping --fix", async () => {
    const out = await captureLog(() => runDoctor({ json: true, fix: true }));
    expect(out).toContain("--json cannot be combined");
    expect(process.exitCode).toBe(1);
  });

  test("--json combined with --apply errors", async () => {
    const out = await captureLog(() => runDoctor({ json: true, apply: true }));
    expect(out).toContain("--json cannot be combined");
    expect(process.exitCode).toBe(1);
  });

  test("--json combined with --save-repairs errors", async () => {
    const out = await captureLog(() =>
      runDoctor({ json: true, saveRepairs: "/tmp/repairs.json" }),
    );
    expect(out).toContain("--json cannot be combined");
    expect(process.exitCode).toBe(1);
  });

  test("--json combined with --apply-repairs errors", async () => {
    const out = await captureLog(() =>
      runDoctor({ json: true, applyRepairs: "/tmp/repairs.json" }),
    );
    expect(out).toContain("--json cannot be combined");
    expect(process.exitCode).toBe(1);
  });

  test("--apply without --fix errors instead of silently no-op'ing", async () => {
    const out = await captureLog(() => runDoctor({ apply: true }));
    expect(out).toContain("--apply requires --fix");
    expect(process.exitCode).toBe(1);
  });

  test("--save-repairs without --fix errors instead of silently no-op'ing", async () => {
    const out = await captureLog(() =>
      runDoctor({ saveRepairs: "/tmp/repairs.json" }),
    );
    expect(out).toContain("--save-repairs requires --fix");
    expect(process.exitCode).toBe(1);
  });

  test("--apply-repairs combined with --fix errors instead of silently dropping --fix", async () => {
    const out = await captureLog(() =>
      runDoctor({ applyRepairs: "/tmp/repairs.json", fix: true }),
    );
    expect(out).toContain("--apply-repairs replays a saved repair file");
    expect(process.exitCode).toBe(1);
  });

  test("--apply-repairs with --apply (no --fix) is not rejected by the --apply/--fix check", async () => {
    // --apply-repairs requires --apply and is mutually exclusive with --fix — the upfront
    // "--apply requires --fix" guard must not fire for this otherwise-valid combination.
    const out = await captureLog(() =>
      runDoctor({ applyRepairs: "/nonexistent/repairs.json", apply: true }),
    );
    expect(out).not.toContain("--apply requires --fix");
  });

  test("--apply-repairs without --apply errors upfront, before any project root/config/network access", async () => {
    // This combination used to be checked deep inside the `if (opts.applyRepairs)` handler,
    // after findProjectRoot()/config-read/an update-check network call had already run —
    // inconsistent with every other combination in this describe block, which are all
    // rejected before any of that. Passing a path that doesn't exist proves the check fires
    // before the file is ever read.
    const out = await captureLog(() =>
      runDoctor({ applyRepairs: "/nonexistent/repairs.json" }),
    );
    expect(out).toContain(
      "--apply-repairs requires --apply to prevent accidental replay",
    );
    expect(process.exitCode).toBe(1);
  });
});

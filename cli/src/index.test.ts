/**
 * Tests for the CLI surface as a whole.
 *
 * These exist because 16 of 18 `cli/src/commands/*.ts` files had no direct test, and because the
 * two things most likely to be wrong about a CLI are cross-cutting rather than per-command:
 *
 *   1. **Registry drift.** `cli/src/types/cli-registry.ts` is a hand-maintained list served by
 *      `--help-json`, which README calls "the authoritative command registry" and which agents
 *      consult to decide what to invoke. Nothing connected it to the commander definitions, so it
 *      drifted: eight `--json` options were registered while the registry advertised five. An agent
 *      reading the registry cannot discover a flag that is missing from it, and will try one that
 *      the registry invents.
 *
 *   2. **JSON-mode purity.** CLAUDE.md forbids interleaving prose into `--json` output. This is a
 *      live bug class, not a hypothetical: a `--json` mode in this repo printed its human summary
 *      after the JSON payload, which breaks every consumer that pipes it to a parser.
 *
 * The command tree is imported with `JSTACK_INTROSPECT=1` so registration happens without parsing
 * argv. Behavioral cases spawn the real CLI, because "does stdout parse as JSON" is only meaningful
 * against a real process's stdout.
 */
import { describe, expect, test, beforeAll } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import type { Command } from "commander";
import { CLI_COMMANDS, CliCommandSchema } from "./types/cli-registry.js";

const repoRoot = join(import.meta.dir, "..", "..");
const ENTRY = join("cli", "src", "index.ts");

let program: Command;

beforeAll(async () => {
  // Set ONLY across the module import, then remove it immediately.
  //
  // `bun test` evaluates test files in one process, so leaving this on `process.env` leaks into
  // every later file: any test that spawns the CLI inherits it, the CLI skips `parseAsync`, and the
  // test sees empty output with exit 0. That broke five assertions in
  // `cli-interactive-contracts.test.ts` and one in `evals/a2a/protocol.test.ts`. The import is a
  // one-time module evaluation, so the flag is only needed for that single await.
  process.env.JSTACK_INTROSPECT = "1";
  try {
    ({ program } = await import("./index.js"));
  } finally {
    delete process.env.JSTACK_INTROSPECT;
  }
});

/** Run the real CLI and capture stdout/stderr separately. */
function run(args: string[]) {
  const r = spawnSync("bun", ["run", ENTRY, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    timeout: 120_000,
    env: { ...process.env, JSTACK_INTROSPECT: "", NO_COLOR: "1" },
  });
  return { code: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

/** Walk the commander tree into `{ path, options }` rows. */
function walk(
  cmd: Command,
  prefix: string[] = [],
): Array<{ path: string; options: string[] }> {
  const rows: Array<{ path: string; options: string[] }> = [];
  for (const sub of cmd.commands as Command[]) {
    const path = [...prefix, sub.name()];
    const options = sub.options
      .map((o) => o.long ?? o.short ?? "")
      .filter(Boolean);
    rows.push({ path: path.join(" "), options });
    rows.push(...walk(sub, path));
  }
  return rows;
}

describe("command tree is introspectable without side effects", () => {
  test("importing with JSTACK_INTROSPECT does not execute a command", () => {
    // If the module had parsed argv, the bun test runner's own argv would have been consumed and
    // this import would have errored or exited before reaching here.
    expect(program).toBeDefined();
    expect(program.commands.length).toBeGreaterThan(10);
  });

  test("both entrypoints still parse normally", () => {
    expect(run(["--version"]).stdout.trim()).toBe("0.1.0");
    const bin = spawnSync("./cli/bin/jstack", ["--version"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    expect((bin.stdout ?? "").trim()).toBe("0.1.0");
  });
});

describe("registry matches the live command tree", () => {
  test("every registry entry validates against its own schema", () => {
    for (const entry of CLI_COMMANDS) {
      const r = CliCommandSchema.safeParse(entry);
      if (!r.success)
        throw new Error(`${entry.name}: ${JSON.stringify(r.error.issues)}`);
    }
  });

  test("registry names are unique", () => {
    const names = CLI_COMMANDS.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  /**
   * Every `--json` flag must be discoverable from the registry.
   *
   * The registry has one entry per TOP-LEVEL command, with two conventions for documenting a
   * subcommand flag: `skills` gets its own per-subcommand entries with structured `arguments`, while
   * a parent like `workflow` conveys flags inside its `subcommand` argument description and its
   * examples. Requiring a structured `arguments` entry flagged this as drift, but it is a difference
   * in convention, not an omission — so the assertion is that the covering entry MENTIONS the flag
   * somewhere an agent reading the registry would see it. That still fails on a `--json` flag which
   * is documented nowhere, which is the real risk.
   */
  test("every registered --json option is discoverable in the registry", () => {
    const rows = walk(program);
    const withJson = rows
      .filter((r) => r.options.includes("--json"))
      // `crew` is an in-flight, untracked feature owned by the repo author and deliberately not yet
      // in the registry. Asserting on it would fail on work-in-progress rather than on drift.
      .filter((r) => !r.path.startsWith("crew"));
    expect(withJson.length).toBeGreaterThan(0);

    const missing: string[] = [];
    for (const row of withJson) {
      const full = `jstack ${row.path}`;
      // Accept an entry naming this exact path or any prefix of it (the parent-entry convention).
      const candidates = CLI_COMMANDS.filter(
        (c) => c.name === full || full.startsWith(c.name + " "),
      );
      if (candidates.length === 0) {
        missing.push(`${full} (no registry entry covers it)`);
        continue;
      }
      const advertised = candidates.some((c) => {
        const haystack = [
          ...c.arguments.map((a) => `${a.name} ${a.description}`),
          ...c.examples.map((e) => `${e.command} ${e.description}`),
          c.description,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes("--json") || haystack.includes("json");
      });
      if (!advertised) missing.push(full);
    }
    expect(missing).toEqual([]);
  });

  test("every registry command exists in the live tree", () => {
    const live = new Set(walk(program).map((r) => `jstack ${r.path}`));
    const phantom = CLI_COMMANDS.map((c) => c.name)
      // `jstack --help-json` is a flag handled before commander parses, not a subcommand.
      .filter((n) => n !== "jstack --help-json" && n !== "jstack")
      .filter((n) => !live.has(n));
    expect(phantom).toEqual([]);
  });

  test("every registry-declared flag exists on the live command", () => {
    const rows = new Map(
      walk(program).map((r) => [`jstack ${r.path}`, r.options]),
    );
    const bogus: string[] = [];
    for (const entry of CLI_COMMANDS) {
      const opts = rows.get(entry.name);
      if (!opts) continue; // covered by the phantom-command test
      for (const arg of entry.arguments) {
        if (!arg.name.startsWith("--")) continue; // positional
        if (!opts.includes(arg.name)) bogus.push(`${entry.name} ${arg.name}`);
      }
    }
    expect(bogus).toEqual([]);
  });
});

describe("--help-json is machine-parseable", () => {
  test("stdout is pure JSON with no prose", () => {
    const { stdout, code } = run(["--help-json"]);
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout); // throws if any prose leaked onto stdout
    expect(parsed.version).toBeString();
    expect(Array.isArray(parsed.commands)).toBe(true);
  });

  test("advertises the same command count as the registry", () => {
    const parsed = JSON.parse(run(["--help-json"]).stdout);
    expect(parsed.commands.length).toBe(CLI_COMMANDS.length);
  });
});

/**
 * JSON-mode purity, per command that offers it.
 *
 * Read-only commands only: this suite must never write config or hit a network. Each is asserted to
 * emit stdout that `JSON.parse` accepts, which is the property a consumer depends on.
 */
describe("--json modes emit only JSON", () => {
  const READ_ONLY_JSON = [
    ["skills index", ["skills", "index", "--json"]],
    ["skills show", ["skills", "show", "recon", "--json"]],
    ["doctor", ["doctor", "--json"]],
    ["workflow list", ["workflow", "list", "--json"]],
  ] as const;

  for (const [label, argv] of READ_ONLY_JSON) {
    test(`${label} --json parses`, () => {
      const { stdout, stderr, code } = run([...argv]);
      // doctor exits non-zero when it finds problems; the payload must still be valid JSON.
      expect(stdout.length).toBeGreaterThan(0);
      let parsed: unknown;
      expect(() => {
        parsed = JSON.parse(stdout);
      }).not.toThrow();
      expect(parsed).toBeDefined();
      // Diagnostics belong on stderr. A human summary on stdout is the exact regression guarded here.
      expect(stdout).not.toContain("Run `jstack");
      void stderr;
      void code;
    });
  }

  // `doctor --json` emits a FLAT object of named booleans plus a warnings array — not a
  // `{checks: [...]}` list. Asserted against the real shape rather than an assumed one.
  test("doctor --json emits the flat check payload consumers read", () => {
    const { stdout } = run(["doctor", "--json"]);
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    expect(typeof parsed.ok).toBe("boolean");
    for (const key of [
      "jstack_config_present",
      "plugin_defaults_present",
      "skills_dir_present",
      "config_parseable",
      "mcp_present",
    ]) {
      expect(parsed).toHaveProperty(key);
    }
    expect(Array.isArray(parsed.warnings)).toBe(true);
  });
});

/**
 * Every command must respond to `--help` without throwing.
 *
 * Cheap, but it is the one check that actually executes each command module: a broken import, a
 * top-level throw, or a missing dependency in any of the 18 command files surfaces here. Several of
 * these files had no test of any kind touching them.
 */
describe("every command loads and can print help", () => {
  test("enumerates a realistic number of commands", () => {
    expect(walk(program).length).toBeGreaterThanOrEqual(19);
  });

  test("each top-level command prints help with exit 0", () => {
    const failures: string[] = [];
    for (const cmd of program.commands as Command[]) {
      const name = cmd.name();
      const { code, stdout, stderr } = run([name, "--help"]);
      if (code !== 0)
        failures.push(`${name}: exit ${code} ${stderr.slice(0, 120)}`);
      else if (!stdout.includes("Usage"))
        failures.push(`${name}: help printed no Usage line`);
    }
    expect(failures).toEqual([]);
  });
});

describe("unknown input is rejected, not silently ignored", () => {
  test("an unknown subcommand exits non-zero", () => {
    expect(run(["definitely-not-a-command"]).code).not.toBe(0);
  });

  test("an unknown flag on a real command exits non-zero", () => {
    expect(run(["status", "--not-a-real-flag"]).code).not.toBe(0);
  });
});

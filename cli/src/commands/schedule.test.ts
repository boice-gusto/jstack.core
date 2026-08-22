/**
 * `runScheduleEnable`/`runScheduleDisable` were duplicated verbatim except for the
 * `enabled` boolean and a couple of label strings, then collapsed into a shared
 * `setRoutineEnabled` helper. These tests drive both verbs through the real CLI to
 * confirm the thin wrappers still produce identical user-facing text/exit codes and
 * still write the right `enabled` value to jstack.config.json.
 */
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import {
  existsSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { findPluginRoot } from "../lib/config.js";
import { isCheckDue } from "../lib/crew/proactive.js";
import {
  appendRunHistory,
  computeNextFire,
  cronFromPreset,
  describeCron,
  isValidRoutineId,
  loadSkillSlugs,
  loadWellKnownRoutine,
  readRunHistory,
  splitChainInput,
  validateChain,
  wellKnownRoutineIds,
  type ScheduleRunRecord,
} from "../lib/scheduler.js";

const ENTRY = join(import.meta.dir, "..", "index.ts");
/** The repo itself IS a valid jstack plugin root (has config/defaults.json + skills/). */
const REPO_PLUGIN_ROOT = join(import.meta.dir, "..", "..", "..");
let dir: string;

function runSchedule(
  cwd: string,
  args: string[],
  extraEnv: Record<string, string> = {},
) {
  const r = spawnSync("bun", ["run", ENTRY, "schedule", ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, JSTACK_INTROSPECT: "", NO_COLOR: "1", ...extraEnv },
  });
  return { code: r.status, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

/** Same as `runSchedule`, but pins `CLAUDE_PLUGIN_ROOT` at the real repo so well-known-routine
 * prefill and skill-catalog slug validation see the real `config/defaults.json` / `skill-catalog.json`
 * regardless of the temp project dir's location. */
function runScheduleWithRealPlugin(cwd: string, args: string[]) {
  return runSchedule(cwd, args, { CLAUDE_PLUGIN_ROOT: REPO_PLUGIN_ROOT });
}

function writeConfigWithRoutine(cwd: string, enabled: boolean) {
  writeFileSync(
    join(cwd, "jstack.config.json"),
    JSON.stringify({
      version: "9.9.9",
      routines: {
        test_routine: { enabled, cron: "0 9 * * 1", chain: [] },
      },
    }),
  );
}

function writeConfigRoutines(
  cwd: string,
  routines: Record<string, { enabled: boolean; cron: string; chain: string[] }>,
) {
  writeFileSync(
    join(cwd, "jstack.config.json"),
    JSON.stringify({ version: "9.9.9", routines }),
  );
}

function readRoutines(cwd: string): Record<string, unknown> {
  const raw = JSON.parse(readFileSync(join(cwd, "jstack.config.json"), "utf8"));
  return raw.routines ?? {};
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "jstack-schedule-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("schedule enable/disable", () => {
  test("enable: unknown routine id errors and exits 1", () => {
    writeConfigWithRoutine(dir, false);
    const { code, out } = runSchedule(dir, ["enable", "nope"]);
    expect(code).toBe(1);
    expect(out).toContain("Unknown routine: nope");
  });

  test("enable: known routine prints 'Enabled <id>' and persists enabled: true", () => {
    writeConfigWithRoutine(dir, false);
    const { code, out } = runSchedule(dir, ["enable", "test_routine"]);
    expect(code).toBe(0);
    expect(out).toContain("Enabled test_routine");
    const written = JSON.parse(
      readFileSync(join(dir, "jstack.config.json"), "utf8"),
    );
    expect(written.routines.test_routine.enabled).toBe(true);
  });

  test("disable: known routine prints 'Disabled <id>' and persists enabled: false", () => {
    writeConfigWithRoutine(dir, true);
    const { code, out } = runSchedule(dir, ["disable", "test_routine"]);
    expect(code).toBe(0);
    expect(out).toContain("Disabled test_routine");
    const written = JSON.parse(
      readFileSync(join(dir, "jstack.config.json"), "utf8"),
    );
    expect(written.routines.test_routine.enabled).toBe(false);
  });

  test("disable: unknown routine id errors and exits 1", () => {
    writeConfigWithRoutine(dir, true);
    const { code, out } = runSchedule(dir, ["disable", "nope"]);
    expect(code).toBe(1);
    expect(out).toContain("Unknown routine: nope");
  });
});

describe("start/stop are backward-compatible with enable/disable", () => {
  test("start produces the same persisted state as enable, under its own label", () => {
    writeConfigRoutines(dir, {
      via_start: { enabled: false, cron: "0 9 * * 1", chain: [] },
      via_enable: { enabled: false, cron: "0 9 * * 1", chain: [] },
    });
    const started = runSchedule(dir, ["start", "via_start"]);
    const enabled = runSchedule(dir, ["enable", "via_enable"]);
    expect(started.code).toBe(0);
    expect(enabled.code).toBe(0);
    expect(started.out).toContain("Started via_start");
    expect(enabled.out).toContain("Enabled via_enable");
    const routines = readRoutines(dir) as Record<string, { enabled: boolean }>;
    expect(routines.via_start.enabled).toBe(true);
    expect(routines.via_enable.enabled).toBe(true);
  });

  test("stop produces the same persisted state as disable, under its own label", () => {
    writeConfigRoutines(dir, {
      via_stop: { enabled: true, cron: "0 9 * * 1", chain: [] },
      via_disable: { enabled: true, cron: "0 9 * * 1", chain: [] },
    });
    const stopped = runSchedule(dir, ["stop", "via_stop"]);
    const disabled = runSchedule(dir, ["disable", "via_disable"]);
    expect(stopped.code).toBe(0);
    expect(disabled.code).toBe(0);
    expect(stopped.out).toContain("Stopped via_stop");
    expect(disabled.out).toContain("Disabled via_disable");
    const routines = readRoutines(dir) as Record<string, { enabled: boolean }>;
    expect(routines.via_stop.enabled).toBe(false);
    expect(routines.via_disable.enabled).toBe(false);
  });

  test("stop: unknown routine id errors and exits 1, same as disable", () => {
    writeConfigWithRoutine(dir, true);
    const { code, out } = runSchedule(dir, ["stop", "nope"]);
    expect(code).toBe(1);
    expect(out).toContain("Unknown routine: nope");
  });
});

describe("pure logic: routine id / chain / cron-preset validation", () => {
  test("isValidRoutineId accepts kebab-case and underscored ids, rejects the rest", () => {
    expect(isValidRoutineId("standup")).toBe(true);
    expect(isValidRoutineId("weekly_digest")).toBe(true);
    expect(isValidRoutineId("my-new-routine")).toBe(true);
    expect(isValidRoutineId("MyRoutine")).toBe(false);
    expect(isValidRoutineId("1-starts-with-digit")).toBe(false);
    expect(isValidRoutineId("has a space")).toBe(false);
    expect(isValidRoutineId("")).toBe(false);
  });

  test("splitChainInput handles commas, whitespace, and mixed separators", () => {
    expect(splitChainInput("recon, announcements")).toEqual([
      "recon",
      "announcements",
    ]);
    expect(splitChainInput("recon announcements")).toEqual([
      "recon",
      "announcements",
    ]);
    expect(splitChainInput("recon,  announcements   sprint")).toEqual([
      "recon",
      "announcements",
      "sprint",
    ]);
    expect(splitChainInput("  ")).toEqual([]);
  });

  test("cronFromPreset: weekday_9am and friday_4pm are fixed expressions", () => {
    expect(cronFromPreset("weekday_9am")).toEqual({
      ok: true,
      cron: "0 9 * * 1-5",
    });
    expect(cronFromPreset("friday_4pm")).toEqual({
      ok: true,
      cron: "0 16 * * 5",
    });
  });

  test("cronFromPreset: every_n_hours accepts 1-23 and rejects out-of-range/non-integer", () => {
    expect(cronFromPreset("every_n_hours", "4")).toEqual({
      ok: true,
      cron: "0 */4 * * *",
    });
    expect(cronFromPreset("every_n_hours", "1")).toEqual({
      ok: true,
      cron: "0 */1 * * *",
    });
    expect(cronFromPreset("every_n_hours", "0").ok).toBe(false);
    expect(cronFromPreset("every_n_hours", "24").ok).toBe(false);
    expect(cronFromPreset("every_n_hours", "abc").ok).toBe(false);
  });

  test("cronFromPreset: custom is validated by the same cronExpr schema as routines.<id>.cron", () => {
    expect(cronFromPreset("custom", "30 9 * * 1-5")).toEqual({
      ok: true,
      cron: "30 9 * * 1-5",
    });
    expect(cronFromPreset("custom", "not a cron").ok).toBe(false);
    expect(cronFromPreset("custom", "").ok).toBe(true); // "" is the valid "unscheduled" sentinel
  });

  test("describeCron: known presets get a gloss, unknown expressions echo honestly", () => {
    expect(describeCron("")).toBe("not scheduled");
    expect(describeCron("0 9 * * 1-5")).toBe("every weekday at 9:00am");
    expect(describeCron("0 16 * * 5")).toBe("every Friday at 4:00pm");
    expect(describeCron("0 */6 * * *")).toBe("every 6 hours");
    expect(describeCron("1,2 3 4 5 6")).toBe('cron "1,2 3 4 5 6"');
  });

  test("validateChain: null catalog (unavailable) never blocks; a real catalog flags unknown slugs", () => {
    expect(validateChain(["anything"], null)).toEqual({ ok: true });
    const known = new Set(["recon", "announcements"]);
    expect(validateChain(["recon", "announcements"], known)).toEqual({
      ok: true,
    });
    expect(validateChain(["recon", "not-a-real-skill"], known)).toEqual({
      ok: false,
      invalid: ["not-a-real-skill"],
    });
  });
});

describe("well-known routine resolution (real config/defaults.json + config/schedules/*.json)", () => {
  const pluginRoot = findPluginRoot(REPO_PLUGIN_ROOT);

  test("wellKnownRoutineIds matches the underscored keys shipped in config/defaults.json", () => {
    const ids = wellKnownRoutineIds(pluginRoot);
    expect(ids.sort()).toEqual(
      ["standup", "weekly_digest", "sprint_close", "health_check"].sort(),
    );
  });

  test(
    "loadWellKnownRoutine resolves cron/chain from defaults.json, not the hyphenated " +
      "internal `id` field inside config/schedules/<id>.json",
    () => {
      const r = loadWellKnownRoutine(pluginRoot, "weekly_digest");
      expect(r).not.toBeNull();
      expect(r!.id).toBe("weekly_digest");
      expect(r!.cron).toBe("0 16 * * 5");
      // Bare slugs (schema-valid), not the "jstack:"-prefixed notation used inside the schedule file.
      expect(r!.chain).toEqual(["reports/team-report", "announcements"]);
      // Display metadata only, sourced from config/schedules/weekly_digest.json.
      expect(r!.displayName).toBe("Weekly digest");
    },
  );

  test("unknown id resolves to null", () => {
    expect(loadWellKnownRoutine(pluginRoot, "not-a-routine")).toBeNull();
  });

  test(
    "well-known routines' shipped chains resolve cleanly against the real skill catalog " +
      "(config/defaults.json and config/schedules/*.json previously carried bare slugs like " +
      "'team-report'/'project-report' that didn't resolve -- fixed to 'reports/team-report' / " +
      "'reports/project-report' -- the setup wizard still treats a well-known routine's chain as " +
      "already-correct and never re-validates it against the catalog, so this drift must be kept " +
      "fixed at the source, not papered over here)",
    () => {
      const catalog = loadSkillSlugs(pluginRoot);
      expect(catalog).not.toBeNull();
      const r = loadWellKnownRoutine(pluginRoot, "weekly_digest")!;
      const result = validateChain(r.chain, catalog);
      expect(result.ok).toBe(true);
    },
  );
});

describe("computeNextFire agrees with crew's isCheckDue for the same cron string", () => {
  test(
    "the minute computeNextFire reports as the next fire is exactly the minute isCheckDue " +
      "reports as due when evaluated from one minute earlier",
    () => {
      const cron = "0 9 * * 1-5"; // every weekday at 9am
      const now = Date.UTC(2026, 7, 20, 8, 0, 0); // 2026-08-20 08:00 UTC (a Thursday)
      const next = computeNextFire(cron, now);
      expect(next.nextFireMs).not.toBeNull();

      const due = isCheckDue(cron, next.nextFireMs! - 60_000, next.nextFireMs!);
      expect(due.due).toBe(true);
      expect(due.firedForMs).toBe(next.nextFireMs!);
    },
  );

  test("empty cron: both report 'not due'/'no schedule' rather than crashing", () => {
    const next = computeNextFire("", Date.now());
    expect(next.nextFireMs).toBeNull();
    const due = isCheckDue("", null, Date.now());
    expect(due.due).toBe(false);
  });
});

describe("run-history persistence (pure functions, mirrors crew's watermark shape)", () => {
  test("readRunHistory on a routine that was never run returns an empty array, not an error", () => {
    expect(readRunHistory(dir, "never-run-routine")).toEqual([]);
  });

  test("appendRunHistory persists and caps at the most recent 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      const rec: ScheduleRunRecord = {
        timestamp: new Date(i).toISOString(),
        routineId: "capped",
        exitOk: i % 2 === 0,
        durationMs: i,
        detail:
          i % 2 === 0
            ? "the process completed without error"
            : "the process failed: boom",
      };
      appendRunHistory(dir, "capped", rec);
    }
    const history = readRunHistory(dir, "capped");
    expect(history.length).toBe(20);
    // Oldest 5 (i=0..4) were dropped; the earliest remaining is i=5.
    expect(history[0]!.durationMs).toBe(5);
    expect(history[history.length - 1]!.durationMs).toBe(24);
  });

  test("history never claims the routine 'succeeded' -- only process-level exit outcome", () => {
    appendRunHistory(dir, "honest", {
      timestamp: new Date().toISOString(),
      routineId: "honest",
      exitOk: true,
      durationMs: 1000,
      detail: "the process completed without error",
    });
    const [rec] = readRunHistory(dir, "honest");
    expect(rec!.detail).not.toMatch(/succeeded|did a good job/i);
    expect(rec!.detail).toBe("the process completed without error");
  });
});

describe("schedule config: --set-cron / --set-chain, and not-found handling", () => {
  test("--set-cron updates only the cron, leaving chain and enabled untouched", () => {
    writeConfigRoutines(dir, {
      r1: { enabled: true, cron: "0 9 * * 1-5", chain: ["recon"] },
    });
    const { code, out } = runSchedule(dir, [
      "config",
      "r1",
      "--set-cron",
      "0 10 * * *",
    ]);
    expect(code).toBe(0);
    expect(out).toContain("Updated routine r1");
    const routines = readRoutines(dir) as Record<
      string,
      { enabled: boolean; cron: string; chain: string[] }
    >;
    expect(routines.r1.cron).toBe("0 10 * * *");
    expect(routines.r1.chain).toEqual(["recon"]);
    expect(routines.r1.enabled).toBe(true);
  });

  test("--set-cron rejects a malformed expression and does not write", () => {
    writeConfigRoutines(dir, {
      r1: { enabled: true, cron: "0 9 * * 1-5", chain: ["recon"] },
    });
    const { code, out } = runSchedule(dir, [
      "config",
      "r1",
      "--set-cron",
      "not a cron",
    ]);
    expect(code).toBe(1);
    const routines = readRoutines(dir) as Record<string, { cron: string }>;
    expect(routines.r1.cron).toBe("0 9 * * 1-5");
    expect(out.length).toBeGreaterThan(0);
  });

  test("--set-chain with real skill slugs updates the chain", () => {
    writeConfigRoutines(dir, {
      r1: { enabled: true, cron: "0 9 * * 1-5", chain: ["recon"] },
    });
    const { code } = runScheduleWithRealPlugin(dir, [
      "config",
      "r1",
      "--set-chain",
      "recon,announcements",
    ]);
    expect(code).toBe(0);
    const routines = readRoutines(dir) as Record<string, { chain: string[] }>;
    expect(routines.r1.chain).toEqual(["recon", "announcements"]);
  });

  test("--set-chain with an unresolvable slug is rejected and does not write", () => {
    writeConfigRoutines(dir, {
      r1: { enabled: true, cron: "0 9 * * 1-5", chain: ["recon"] },
    });
    const { code, out } = runScheduleWithRealPlugin(dir, [
      "config",
      "r1",
      "--set-chain",
      "not-a-real-skill",
    ]);
    expect(code).toBe(1);
    expect(out).toContain("not-a-real-skill");
    const routines = readRoutines(dir) as Record<string, { chain: string[] }>;
    expect(routines.r1.chain).toEqual(["recon"]);
  });

  test("config on an unknown routine id errors and points at `schedule setup`", () => {
    writeConfigRoutines(dir, { r1: { enabled: true, cron: "", chain: [] } });
    const { code, out } = runSchedule(dir, ["config", "nope"]);
    expect(code).toBe(1);
    expect(out).toContain("Unknown routine: nope");
    expect(out).toContain("jstack schedule setup nope");
  });
});

describe("schedule setup: new custom routine, slug validation, and collisions", () => {
  test("creates a new custom routine from flags, non-interactively", () => {
    writeConfigRoutines(dir, {});
    const { code, out } = runScheduleWithRealPlugin(dir, [
      "setup",
      "my-new-routine",
      "--chain",
      "recon,announcements",
      "--cron",
      "0 10 * * *",
      "--enable",
    ]);
    expect(code).toBe(0);
    expect(out).toContain("Saved routine my-new-routine");
    const routines = readRoutines(dir) as Record<
      string,
      { enabled: boolean; cron: string; chain: string[] }
    >;
    expect(routines["my-new-routine"]).toEqual({
      enabled: true,
      cron: "0 10 * * *",
      chain: ["recon", "announcements"],
    });
  });

  test("rejects --enable and --disable together, for a new custom routine", () => {
    writeConfigRoutines(dir, {});
    const { code, out } = runScheduleWithRealPlugin(dir, [
      "setup",
      "my-new-routine",
      "--chain",
      "recon",
      "--cron",
      "0 10 * * *",
      "--enable",
      "--disable",
    ]);
    expect(code).toBe(1);
    expect(out).toContain("Pass only one of --enable / --disable");
    expect(readRoutines(dir)).toEqual({});
  });

  test("rejects --enable and --disable together, for a well-known routine", () => {
    writeConfigRoutines(dir, {});
    const { code, out } = runScheduleWithRealPlugin(dir, [
      "setup",
      "standup",
      "--yes",
      "--enable",
      "--disable",
    ]);
    expect(code).toBe(1);
    expect(out).toContain("Pass only one of --enable / --disable");
    expect(readRoutines(dir)).toEqual({});
  });

  test("rejects an id that does not match ^[a-z][a-z0-9_-]*$", () => {
    writeConfigRoutines(dir, {});
    const { code, out } = runScheduleWithRealPlugin(dir, [
      "setup",
      "Not_Valid!",
      "--chain",
      "recon",
      "--cron",
      "0 10 * * *",
      "--enable",
    ]);
    expect(code).toBe(1);
    expect(out).toContain("not a valid routine id");
    expect(readRoutines(dir)).toEqual({});
  });

  test("rejects a collision with an existing routine id", () => {
    writeConfigRoutines(dir, {
      existing: { enabled: false, cron: "", chain: [] },
    });
    const { code, out } = runScheduleWithRealPlugin(dir, [
      "setup",
      "existing",
      "--chain",
      "recon",
      "--cron",
      "0 10 * * *",
      "--enable",
    ]);
    expect(code).toBe(1);
    expect(out).toContain("already exists");
  });

  test("rejects an unresolvable skill slug in --chain and does not write", () => {
    writeConfigRoutines(dir, {});
    const { code, out } = runScheduleWithRealPlugin(dir, [
      "setup",
      "my-new-routine",
      "--chain",
      "not-a-real-skill",
      "--cron",
      "0 10 * * *",
      "--enable",
    ]);
    expect(code).toBe(1);
    expect(out).toContain("not-a-real-skill");
    expect(readRoutines(dir)).toEqual({});
  });

  test("well-known routine id prefills cron/chain from config/defaults.json and honors --yes", () => {
    writeConfigRoutines(dir, {});
    const { code, out } = runScheduleWithRealPlugin(dir, [
      "setup",
      "standup",
      "--yes",
      "--enable",
    ]);
    expect(code).toBe(0);
    expect(out).toContain("Saved routine standup");
    const routines = readRoutines(dir) as Record<
      string,
      { enabled: boolean; cron: string; chain: string[] }
    >;
    expect(routines.standup).toEqual({
      enabled: true,
      cron: "0 9 * * 1-5",
      chain: ["recon", "announcements"],
    });
  });

  test("a --chain flag is ignored (with a note) for a well-known routine, since its chain is fixed", () => {
    writeConfigRoutines(dir, {});
    const { code, out } = runScheduleWithRealPlugin(dir, [
      "setup",
      "standup",
      "--yes",
      "--enable",
      "--chain",
      "not-a-real-skill",
    ]);
    expect(code).toBe(0);
    expect(out).toContain("Ignoring --chain");
    const routines = readRoutines(dir) as Record<string, { chain: string[] }>;
    expect(routines.standup.chain).toEqual(["recon", "announcements"]);
  });
});

describe("schedule run --dry-run", () => {
  test("dry-run shows the prompt without spawning a process or writing history", () => {
    writeConfigRoutines(dir, {
      r1: {
        enabled: true,
        cron: "0 9 * * 1-5",
        chain: ["recon", "announcements"],
      },
    });
    const { code, out } = runSchedule(dir, ["run", "r1", "--dry-run"]);
    expect(code).toBe(0);
    expect(out).toContain('Would run routine "r1"');
    expect(out).toContain("jstack:recon");
    expect(out).toContain("jstack:announcements");
    expect(
      existsSync(join(dir, ".jstack", "schedule-history", "r1.json")),
    ).toBe(false);
  });

  test("dry-run --json emits the chain and prompt as structured output", () => {
    writeConfigRoutines(dir, {
      r1: { enabled: true, cron: "", chain: ["recon"] },
    });
    const { code, out } = runSchedule(dir, [
      "run",
      "r1",
      "--dry-run",
      "--json",
    ]);
    expect(code).toBe(0);
    const parsed = JSON.parse(out);
    expect(parsed.id).toBe("r1");
    expect(parsed.dryRun).toBe(true);
    expect(parsed.chain).toEqual(["recon"]);
    expect(typeof parsed.prompt).toBe("string");
  });

  test("unknown routine id errors and exits 1", () => {
    writeConfigRoutines(dir, {});
    const { code, out } = runSchedule(dir, ["run", "nope", "--dry-run"]);
    expect(code).toBe(1);
    expect(out).toContain("Unknown routine: nope");
  });

  test("a routine with an empty chain refuses to run, even as a dry-run", () => {
    writeConfigRoutines(dir, { empty: { enabled: true, cron: "", chain: [] } });
    const { code, out } = runSchedule(dir, ["run", "empty", "--dry-run"]);
    expect(code).toBe(1);
    expect(out).toContain("empty chain");
  });
});

describe("schedule report: honest never-run messaging and next-fire", () => {
  test("a routine that was never run says so plainly, not implying background execution", () => {
    writeConfigRoutines(dir, {
      r1: { enabled: true, cron: "0 9 * * 1-5", chain: ["recon"] },
    });
    const { code, out } = runSchedule(dir, ["report", "r1"]);
    expect(code).toBe(0);
    expect(out).toContain("Never run via `jstack schedule run`");
    expect(out).toContain("point an external cron/launchd entry");
  });

  test("after a recorded run, report reflects it honestly (process-level, not semantic)", () => {
    appendRunHistory(dir, "r1", {
      timestamp: new Date().toISOString(),
      routineId: "r1",
      exitOk: true,
      durationMs: 2500,
      detail: "the process completed without error",
    });
    writeConfigRoutines(dir, {
      r1: { enabled: true, cron: "0 9 * * 1-5", chain: ["recon"] },
    });
    const { code, out } = runSchedule(dir, ["report", "r1"]);
    expect(code).toBe(0);
    expect(out).toContain("Last run:");
    expect(out).toContain("completed without error");
    expect(out).not.toContain("Never run");
  });

  test("summary (no id) counts enabled and ever-run routines honestly", () => {
    writeConfigRoutines(dir, {
      r1: { enabled: true, cron: "0 9 * * 1-5", chain: ["recon"] },
      r2: { enabled: false, cron: "", chain: [] },
    });
    const { code, out } = runSchedule(dir, ["report"]);
    expect(code).toBe(0);
    expect(out).toContain("2 routine(s): 1 enabled");
    expect(out).toContain("0 ever run");
    expect(out).toContain("[never run via `jstack schedule run`]");
  });

  test("unknown routine id errors and exits 1", () => {
    writeConfigRoutines(dir, {});
    const { code, out } = runSchedule(dir, ["report", "nope"]);
    expect(code).toBe(1);
    expect(out).toContain("Unknown routine: nope");
  });
});

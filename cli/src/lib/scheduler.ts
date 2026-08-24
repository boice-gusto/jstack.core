import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { JstackConfig } from "../types/config.js";
import { JstackConfigSchema, cronExpr } from "../types/config.js";
import { loadDefaults } from "./config.js";
import { cronMatchesMinute, parseCron } from "./crew/proactive.js";

export interface RoutineRow {
  id: string;
  cron: string;
  enabled: boolean;
  chain: string[];
}

/** The raw shape of `cfg.routines`, shared by every call site below instead of each one
 * independently re-asserting its own (previously slightly inconsistent) belief about it. */
export type RawRoutineEntry = { cron?: string; enabled?: boolean; chain?: string[] };
export type RawRoutines = Record<string, RawRoutineEntry>;

export function listRoutinesFromConfig(cfg: JstackConfig): RoutineRow[] {
  const r = cfg.routines as RawRoutines | undefined;
  if (!r) return [];
  return Object.entries(r).map(([id, v]) => ({
    id,
    cron: v.cron ?? "",
    enabled: !!v.enabled,
    chain: v.chain ?? [],
  }));
}

/**
 * Read-modify-write a single `routines.<id>` entry, replacing the unchecked
 * `as Record<string, Record<string, unknown>>` cast-and-spread that used to be copy-pasted at
 * every schedule.ts call site -- mirroring `commands/crew.ts`'s `mutateAgents`, which validates
 * via schema before writing rather than trusting the merge blindly.
 *
 * `mode: "overwrite"` replaces the whole entry (used when saving a brand-new routine); `"merge"`
 * (the default) spreads the patch over whatever is already there (used when editing an existing
 * one). Passing the wrong mode for a pre-existing routine can silently drop fields the routine
 * already carried via `RoutineSchema`'s `.passthrough()` -- callers creating a new id should use
 * `"overwrite"`, callers editing one they already loaded via `listRoutinesFromConfig` should use
 * the default `"merge"`.
 */
export function patchRoutine(
  cfg: JstackConfig,
  id: string,
  patch: { cron?: string; chain?: string[]; enabled?: boolean },
  mode: "merge" | "overwrite" = "merge",
): JstackConfig {
  const routines: RawRoutines = { ...(cfg.routines as RawRoutines | undefined) };
  const existing = mode === "merge" ? routines[id] : undefined;
  routines[id] = { ...existing, ...patch };
  return JstackConfigSchema.parse({ ...cfg, routines });
}

/**
 * `config/schedules/<id>.json`. `id` here MUST already be the canonical, underscored form
 * (matching a `routines.<id>` key in `config/defaults.json` / `jstack.config.json`) -- see the
 * long comment on `loadWellKnownRoutine` below for why that canonical form, and not the
 * hyphenated `id` field written *inside* these files, is what resolution goes by.
 */
export function loadScheduleFile(
  pluginRoot: string,
  id: string,
): unknown | null {
  const p = join(pluginRoot, "config", "schedules", `${id}.json`);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8"));
}

/* ---------------------------------------------------------------- routine id validation ---- */

/** Kebab/underscore routine id, e.g. `weekly_digest` or `my-new-routine`. */
export function isValidRoutineId(id: string): boolean {
  return /^[a-z][a-z0-9_-]*$/.test(id);
}

/* ---------------------------------------------------------------- well-known routines ---- */

export interface WellKnownRoutine {
  id: string;
  cron: string;
  chain: string[];
  enabled: boolean;
  /** From `config/schedules/<id>.json`'s `name`, display-only. */
  displayName?: string;
  /** From `config/schedules/<id>.json`'s `description`, display-only. */
  description?: string;
}

/**
 * Ids of the routines shipped in `config/defaults.json`'s `routines` block -- the canonical id
 * list, in the canonical (underscored) casing.
 */
export function wellKnownRoutineIds(pluginRoot: string): string[] {
  const defaults = loadDefaults(pluginRoot) as {
    routines?: Record<string, unknown>;
  };
  return Object.keys(defaults.routines ?? {});
}

/**
 * Resolve a well-known routine's cron/chain/enabled defaults, by the SAME id-casing convention
 * `config/defaults.json` and `loadScheduleFile` already use: the underscored key
 * (`weekly_digest`), which is also the `config/schedules/<id>.json` FILENAME stem.
 *
 * This deliberately does NOT read the hyphenated `id` field written inside
 * `config/schedules/<id>.json` (e.g. `"id": "weekly-digest"`) for resolution -- that field is a
 * pre-existing drift the schema's own doc comment on `RoutineSchema` warns about ("a silent
 * divergence between the two sources and an id/filename mismatch that left 3 of 4 routines
 * unable to load a schedule"). Using the filename/defaults-key as the one source of truth for
 * "what id is this routine" sidesteps that drift entirely. The schedule JSON file is still read
 * here, but ONLY for its `name`/`description` display strings -- never for `cron` or `chain`,
 * since defaults.json's chain entries are bare skill slugs (schema-valid) while the schedule
 * JSON's chain entries use the `jstack:`-prefixed skill-body notation (schema-INVALID for
 * `routines.<id>.chain`). Prefilling from defaults.json is what keeps the wizard's output valid
 * against `RoutineSchema` without a second slug-notation translation step.
 */
export function loadWellKnownRoutine(
  pluginRoot: string,
  id: string,
): WellKnownRoutine | null {
  const defaults = loadDefaults(pluginRoot) as { routines?: RawRoutines };
  const d = defaults.routines?.[id];
  if (!d) return null;

  let displayName: string | undefined;
  let description: string | undefined;
  const schedule = loadScheduleFile(pluginRoot, id);
  if (schedule && typeof schedule === "object") {
    const s = schedule as Record<string, unknown>;
    if (typeof s.name === "string") displayName = s.name;
    if (typeof s.description === "string") description = s.description;
  }

  return {
    id,
    cron: d.cron ?? "",
    chain: d.chain ?? [],
    enabled: !!d.enabled,
    displayName,
    description,
  };
}

/* ---------------------------------------------------------------- chain slug validation ---- */

/** Split a comma-and/or-whitespace separated list of skill slugs into trimmed, non-empty parts. */
export function splitChainInput(raw: string): string[] {
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Bare skill slugs (the `RoutineSchema.chain` notation) known to this plugin, read from
 * `skill-catalog.json`'s `gateId` field with the `jstack:` prefix stripped. Returns `null` (not
 * an empty set) when the catalog file cannot be read, so callers can tell "no skills exist" from
 * "cannot verify right now" and choose not to hard-block on the latter.
 */
export function loadSkillSlugs(pluginRoot: string): Set<string> | null {
  const p = join(pluginRoot, "skill-catalog.json");
  if (!existsSync(p)) return null;
  try {
    const raw = JSON.parse(readFileSync(p, "utf8")) as {
      skills?: Array<{ gateId?: unknown }>;
    };
    const out = new Set<string>();
    for (const s of raw.skills ?? []) {
      if (typeof s.gateId === "string") {
        out.add(s.gateId.replace(/^jstack:/, ""));
      }
    }
    return out;
  } catch {
    return null;
  }
}

export type ChainValidation = { ok: true } | { ok: false; invalid: string[] };

/**
 * Does every slug in `chain` resolve to a real skill? `knownSlugs === null` means the catalog
 * could not be loaded -- treated as "cannot verify", not as a rejection, since a missing
 * `skill-catalog.json` is a real deployment state (see `loadSkillSlugs`), not a typo.
 */
export function validateChain(
  chain: string[],
  knownSlugs: Set<string> | null,
): ChainValidation {
  if (knownSlugs === null) return { ok: true };
  const invalid = chain.filter((s) => !knownSlugs.has(s));
  return invalid.length > 0 ? { ok: false, invalid } : { ok: true };
}

/* ---------------------------------------------------------------- cron presets ---- */

export const CRON_PRESET_WEEKDAY_9AM = "0 9 * * 1-5";
export const CRON_PRESET_FRIDAY_4PM = "0 16 * * 5";

export type CronPresetKey =
  | "weekday_9am"
  | "friday_4pm"
  | "every_n_hours"
  | "custom";

export interface CronPresetOption {
  key: CronPresetKey;
  label: string;
  hint?: string;
}

export const CRON_PRESET_OPTIONS: CronPresetOption[] = [
  {
    key: "weekday_9am",
    label: "Every weekday morning (9am)",
    hint: CRON_PRESET_WEEKDAY_9AM,
  },
  {
    key: "friday_4pm",
    label: "Every Friday afternoon (4pm)",
    hint: CRON_PRESET_FRIDAY_4PM,
  },
  { key: "every_n_hours", label: "Every N hours" },
  { key: "custom", label: "Custom cron expression" },
];

export type CronPresetResult =
  | { ok: true; cron: string }
  | { ok: false; error: string };

/**
 * Turn a preset choice (plus, for `every_n_hours`/`custom`, its one argument) into an actual
 * cron string. `custom` is validated with the SAME `cronExpr` Zod schema `routines.<id>.cron`
 * itself is validated against, so a wizard-produced value can never be rejected later by
 * `bun run validate-config` for a reason this function did not already catch.
 */
export function cronFromPreset(
  key: CronPresetKey,
  arg?: string,
): CronPresetResult {
  switch (key) {
    case "weekday_9am":
      return { ok: true, cron: CRON_PRESET_WEEKDAY_9AM };
    case "friday_4pm":
      return { ok: true, cron: CRON_PRESET_FRIDAY_4PM };
    case "every_n_hours": {
      const n = Number((arg ?? "").trim());
      if (!Number.isInteger(n) || n < 1 || n > 23) {
        return {
          ok: false,
          error: "N must be a whole number of hours between 1 and 23",
        };
      }
      return { ok: true, cron: `0 */${n} * * *` };
    }
    case "custom": {
      const trimmed = (arg ?? "").trim();
      const parsed = cronExpr.safeParse(trimmed);
      if (!parsed.success) {
        return {
          ok: false,
          error: parsed.error.issues[0]?.message ?? "invalid cron expression",
        };
      }
      return { ok: true, cron: trimmed };
    }
  }
}

/**
 * Best-effort human-readable gloss for a cron string. Deliberately NOT a general cron-to-English
 * translator -- it recognizes the shipped presets and the `every_n_hours` shape, and otherwise
 * honestly falls back to echoing the raw expression rather than guessing at a description that
 * might be wrong.
 */
export function describeCron(cron: string): string {
  const trimmed = cron.trim();
  if (!trimmed) return "not scheduled";
  if (trimmed === CRON_PRESET_WEEKDAY_9AM) return "every weekday at 9:00am";
  if (trimmed === CRON_PRESET_FRIDAY_4PM) return "every Friday at 4:00pm";
  const everyNHours = /^0 \*\/(\d+) \* \* \*$/.exec(trimmed);
  if (everyNHours) return `every ${everyNHours[1]} hours`;
  return `cron "${trimmed}"`;
}

/* ---------------------------------------------------------------- next-fire computation ---- */

export interface NextFireResult {
  nextFireMs: number | null;
  reason: string;
}

/** Bounded scan window: a bit over a year of minutes, generous but not unbounded. */
const NEXT_FIRE_MAX_SCAN_MINUTES = 60 * 24 * 366;

/**
 * When will `cron` next fire strictly after `fromMs`? Reuses `parseCron`/`cronMatchesMinute`
 * from `cli/src/lib/crew/proactive.ts` -- the exact same field-expansion/matching logic
 * `isCheckDue` uses to decide whether a proactive check is due right now -- so `jstack schedule
 * report`'s "next fire" and crew's due-check can never silently disagree about what a given
 * cron string means.
 */
export function computeNextFire(
  cron: string,
  fromMs: number,
  maxScanMinutes: number = NEXT_FIRE_MAX_SCAN_MINUTES,
): NextFireResult {
  const trimmed = cron.trim();
  if (!trimmed) return { nextFireMs: null, reason: "no schedule configured" };
  const fields = parseCron(trimmed);
  if (!fields) {
    return { nextFireMs: null, reason: `unparseable schedule "${cron}"` };
  }
  const start = Math.floor(fromMs / 60_000) * 60_000 + 60_000;
  for (let t = start, i = 0; i < maxScanMinutes; t += 60_000, i++) {
    if (cronMatchesMinute(fields, new Date(t))) {
      return { nextFireMs: t, reason: "matched" };
    }
  }
  return {
    nextFireMs: null,
    reason: `no matching minute found in the next ${maxScanMinutes} minutes`,
  };
}

/* ---------------------------------------------------------------- run history ---- */

/**
 * One `jstack schedule run` invocation's outcome. Deliberately reports only process-level
 * honesty ("did `claude -p` exit 0") -- never a semantic judgment like "the routine succeeded" or
 * "did a good job", which nothing in this repo has a mechanism to verify. Mirrors
 * `runWorkflowStub`'s "unverified" honesty precedent in `cli/src/lib/workflow-engine.ts`.
 */
export interface ScheduleRunRecord {
  /** ISO timestamp of when the run started. */
  timestamp: string;
  routineId: string;
  /** Whether the `claude -p` process exited 0. Never "whether the routine succeeded". */
  exitOk: boolean;
  durationMs: number;
  /** Short, honest, process-level description -- see `ScheduleRunRecord` doc comment. */
  detail: string;
}

const MAX_HISTORY_ENTRIES = 20;

function historyDir(root: string): string {
  return join(root, ".jstack", "schedule-history");
}

/** Mirrors the shape of `watermarkPath` in `crew/proactive.ts`: one file, deterministic path. */
export function historyPath(root: string, id: string): string {
  return join(historyDir(root), `${id}.json`);
}

/** Missing file reads as "never run" (empty array), not an error -- same convention as `readWatermarks`. */
export function readRunHistory(root: string, id: string): ScheduleRunRecord[] {
  const p = historyPath(root, id);
  if (!existsSync(p)) return [];
  try {
    const raw = JSON.parse(readFileSync(p, "utf8"));
    return Array.isArray(raw) ? (raw as ScheduleRunRecord[]) : [];
  } catch {
    return [];
  }
}

/** Appends one run record, capped at the most recent `MAX_HISTORY_ENTRIES` (oldest dropped). */
export function appendRunHistory(
  root: string,
  id: string,
  rec: ScheduleRunRecord,
): ScheduleRunRecord[] {
  const dir = historyDir(root);
  mkdirSync(dir, { recursive: true });
  const next = [...readRunHistory(root, id), rec].slice(-MAX_HISTORY_ENTRIES);
  writeFileSync(
    historyPath(root, id),
    `${JSON.stringify(next, null, 2)}\n`,
    "utf8",
  );
  return next;
}

/* ---------------------------------------------------------------- run prompt ---- */

/**
 * The instruction handed to the unattended `claude -p` turn for `jstack schedule run <id>`.
 * Carries the exact "unattended, idempotent, report partial failure as partial failure"
 * discipline `skills/routines/*` already document in their own bodies (see
 * `skills/routines/standup/SKILL.md`'s "Plan the safe path" step) into the prompt itself, since
 * this run has no interactive user and no skill router to fall back on that framing from.
 */
export function buildRoutineRunPrompt(id: string, chain: string[]): string {
  const steps = chain.map((slug, i) => `  ${i + 1}. jstack:${slug}`).join("\n");
  return (
    `This is a scheduled, UNATTENDED routine run (routine id "${id}"), triggered by ` +
    `\`jstack schedule run ${id}\` -- nobody is watching interactively; treat this exactly as a ` +
    `cron invocation would.\n\n` +
    `Work through this chain of skills, in order:\n${steps}\n\n` +
    `Discipline for an unattended run:\n` +
    `- Never block on an interactive prompt; if a step would normally ask a question, make the ` +
    `most reasonable assumption, label it [assumption], and continue.\n` +
    `- Every step must be safe to re-run (idempotent) -- a retry or an overlapping run can happen.\n` +
    `- If a step fails, report it as a partial failure naming the failing step; never report ` +
    `overall success if any step in the chain failed.\n` +
    `- Finish with a short summary of what happened at each step.`
  );
}

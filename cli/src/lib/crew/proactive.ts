import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expandHome } from "./store.js";
import { resolvePersona } from "./persona.js";
import { runClaude, sendMessage } from "./slack.js";
import type { AgentConfig, CrewConfig, ProactiveCheckConfig } from "./types.js";

/**
 * Proactive checks: the OTHER half of "crew" -- an agent deciding, on its own schedule,
 * whether there is something worth telling the operator, rather than only answering what it
 * is asked. See `skills/crew/SKILL.md` for the operator-facing explanation.
 *
 * Split of responsibility, stated plainly because it is easy to blur:
 *
 *   DETERMINISTIC (this file, unit-tested, no model call):
 *     - whether a check's cron `schedule` is due, given when it last ran (`isCheckDue` /
 *       `scanForDueSlot` and the small cron matcher above them)
 *     - which channel a finding may post to (`resolveProactiveChannel`), reusing the same
 *       "never guess at a shared channel" principle as the ingress owner-only guard
 *     - whether a model's response counts as a "finding" worth posting at all
 *       (`parseProactiveVerdict`), which enforces a STRUCTURE, not a judgment
 *     - persisting when a check was last evaluated (`readWatermarks` / `writeWatermark`)
 *
 *   REQUIRES AN ACTUAL MODEL TURN (not faked here, not unit-tested):
 *     - "is there genuinely something worth surfacing" is answered by the agent actually
 *       investigating `check.prompt` with its own tools and reasoning. `runProactiveCheck`'s
 *       job is to construct the right context/instruction for that turn and hand it to
 *       `ctx.runTurn`, then enforce the FINDING/NO_FINDING contract on whatever comes back.
 *       `defaultRunTurn` (the real implementation used by the CLI and the tick loop) is
 *       exactly as untested by design as `runWorker` in `tick.ts` -- it shells out to
 *       `claude`, and that is not something a plain TypeScript unit test can meaningfully
 *       fake without pretending to be a model.
 */

/* -------------------------------------------------------------- cron matching ---- */

interface CronFields {
  minute: Set<number>;
  hour: Set<number>;
  dom: Set<number>;
  month: Set<number>;
  dow: Set<number>;
}

/**
 * Expand one cron field ("*", "5", "1,3,5", "1-5", "star-slash-15", "1-10/2") into the set of
 * values it matches. Deliberately a SUBSET of what the `cronExpr` regex in
 * `cli/src/types/config.ts`
 * accepts -- `L`, `W`, `?`, `#` (last-day, weekday-nearest, no-value, nth-weekday) pass that
 * regex but are not expanded here, so a schedule using them will validate at config-write time
 * and then simply never be found due. That mirrors the exact risk `cronExpr`'s own doc comment
 * already names for `routines.<id>.cron` ("a malformed expression does not error -- the
 * routine simply never fires"); it is not a new failure mode, but it is worth stating rather
 * than discovering.
 */
function expandCronField(field: string, min: number, max: number): Set<number> {
  const out = new Set<number>();
  for (const part of field.split(",")) {
    const stepMatch = /^([^/]+)\/(\d+)$/.exec(part);
    const [rangePart, stepStr] = stepMatch
      ? [stepMatch[1]!, stepMatch[2]!]
      : [part, null];
    const step = stepStr ? Number(stepStr) : 1;

    let lo: number;
    let hi: number;
    if (rangePart === "*") {
      lo = min;
      hi = max;
    } else {
      const rangeMatch = /^(\d+)-(\d+)$/.exec(rangePart);
      if (rangeMatch) {
        lo = Number(rangeMatch[1]);
        hi = Number(rangeMatch[2]);
      } else if (/^\d+$/.test(rangePart)) {
        lo = hi = Number(rangePart);
      } else {
        // Unsupported syntax (names, L/W/?/#). Contribute nothing rather than throwing --
        // an unmatchable field means the check never fires, which is the documented,
        // honest limitation above, not a crash.
        continue;
      }
    }
    for (let v = lo; v <= hi && v <= max; v += step) {
      if (v >= min) out.add(v);
    }
  }
  return out;
}

/** Parse a validated 5-field cron string. Assumes `cronExpr` already accepted it. */
function parseCron(schedule: string): CronFields | null {
  const fields = schedule.trim().split(/\s+/);
  if (fields.length !== 5) return null;
  const [minute, hour, dom, month, dow] = fields as [
    string,
    string,
    string,
    string,
    string,
  ];
  return {
    minute: expandCronField(minute, 0, 59),
    hour: expandCronField(hour, 0, 23),
    dom: expandCronField(dom, 1, 31),
    month: expandCronField(month, 1, 12),
    // Cron's day-of-week is 0-7 with both 0 and 7 meaning Sunday; normalise 7 -> 0 so it
    // matches `Date#getDay()`.
    dow: new Set([...expandCronField(dow, 0, 7)].map((d) => (d === 7 ? 0 : d))),
  };
}

function cronMatchesMinute(fields: CronFields, d: Date): boolean {
  return (
    fields.minute.has(d.getMinutes()) &&
    fields.hour.has(d.getHours()) &&
    fields.dom.has(d.getDate()) &&
    fields.month.has(d.getMonth() + 1) &&
    fields.dow.has(d.getDay())
  );
}

/** Round a timestamp down to the start of its minute. */
function minuteFloor(ms: number): number {
  return Math.floor(ms / 60_000) * 60_000;
}

const MAX_SCAN_MINUTES = 60 * 24 * 35; // 35 days -- a generous but bounded backlog window

export interface DueResult {
  due: boolean;
  /** The ms timestamp of the schedule slot to fire for, when `due`. */
  firedForMs?: number;
  /**
   * True when more than one scheduled slot passed since the last evaluation (e.g. the daemon
   * was stopped for a while) and only the most recent one is being fired for -- the others are
   * treated as missed, not queued, the same trade `tick.ts` makes for a Slack backlog it
   * cannot fully page through.
   */
  collapsed: boolean;
  reason: string;
}

/**
 * Is this schedule due, given the last time it was evaluated (fired or not)?
 *
 * `lastEvaluatedThroughMs === null` means "never evaluated" -- treated as "evaluated through
 * one minute before `nowMs`", so a freshly-added check can fire on the CURRENT minute if it
 * matches, but does not retroactively fire for every slot since the epoch.
 */
export function isCheckDue(
  schedule: string,
  lastEvaluatedThroughMs: number | null,
  nowMs: number,
): DueResult {
  if (!schedule.trim()) {
    return { due: false, collapsed: false, reason: "no schedule configured" };
  }
  const fields = parseCron(schedule);
  if (!fields) {
    return {
      due: false,
      collapsed: false,
      reason: `unparseable schedule "${schedule}"`,
    };
  }

  const since = lastEvaluatedThroughMs ?? nowMs - 60_000;
  const startMinute = minuteFloor(since) + 60_000; // first whole minute AFTER `since`
  const endMinute = minuteFloor(nowMs);
  if (startMinute > endMinute) {
    return {
      due: false,
      collapsed: false,
      reason: "already evaluated through now",
    };
  }

  const totalMinutes = Math.floor((endMinute - startMinute) / 60_000) + 1;
  const cappedStart =
    totalMinutes > MAX_SCAN_MINUTES
      ? endMinute - (MAX_SCAN_MINUTES - 1) * 60_000
      : startMinute;
  const truncated = cappedStart > startMinute;

  let matches = 0;
  let lastMatchMs: number | null = null;
  for (let t = cappedStart; t <= endMinute; t += 60_000) {
    if (cronMatchesMinute(fields, new Date(t))) {
      matches++;
      lastMatchMs = t;
    }
  }

  if (lastMatchMs === null) {
    return {
      due: false,
      collapsed: false,
      reason: truncated
        ? `no matching minute in the most recent ${MAX_SCAN_MINUTES} minutes (older backlog was not scanned)`
        : "no matching minute since last evaluation",
    };
  }

  return {
    due: true,
    firedForMs: lastMatchMs,
    collapsed: matches > 1,
    reason:
      matches > 1
        ? `${matches} scheduled slots passed since last evaluation; firing for the most recent`
        : "scheduled slot reached",
  };
}

/* -------------------------------------------------------------- channel resolution ---- */

export interface ChannelResolution {
  ok: boolean;
  channelId?: string;
  /** True when no explicit `check.channel` was given and the agent's own DM was used. */
  defaulted: boolean;
  ruleId?: string;
  reason: string;
}

/**
 * Which channel may this check post to, if it finds something?
 *
 * Mirrors the ingress owner-only guard's underlying principle -- "never let a proactive post
 * land somewhere nobody configured it for" -- but the check itself is different: a proactive
 * check does not have an author to compare against `slack.self_user_id`, so
 * `isOwnerOnlyViolation()` does not apply here. What DOES apply, and is enforced here:
 *
 *   - an UNSET `check.channel` always resolves to the agent's own configured egress channel
 *     (its DM), never guessed at from anything else
 *   - an EXPLICIT `check.channel` must already be one of `policy.egress.channels` -- the
 *     allowlist of channels crew is permitted to post to at all. A proactive check cannot grant
 *     itself a NEW posting destination; egress config is still the one place that happens.
 */
export function resolveProactiveChannel(
  check: Pick<ProactiveCheckConfig, "channel">,
  cfg: Pick<CrewConfig, "policy">,
): ChannelResolution {
  const ownerChannel = cfg.policy.egress.channels[0];

  if (!check.channel) {
    if (!ownerChannel) {
      return {
        ok: false,
        defaulted: true,
        ruleId: "no_owner_channel",
        reason:
          "no channel configured on the check and policy.egress.channels is empty",
      };
    }
    return {
      ok: true,
      channelId: ownerChannel,
      defaulted: true,
      reason: "defaulted to the agent's own egress channel",
    };
  }

  if (!cfg.policy.egress.channels.includes(check.channel)) {
    return {
      ok: false,
      defaulted: false,
      ruleId: "channel_not_egress_allowlisted",
      reason:
        `"${check.channel}" is not in policy.egress.channels; a proactive check cannot post ` +
        "somewhere egress config does not already allow",
    };
  }
  return {
    ok: true,
    channelId: check.channel,
    defaulted: false,
    reason: "explicit channel, egress-allowlisted",
  };
}

/* -------------------------------------------------------------- the model-turn contract ---- */

const FINDING_RE = /^FINDING:\s*([\s\S]+)/i;
const NO_FINDING_RE = /^NO_FINDING\b/i;

/**
 * The instruction handed to the model turn. This is prompt construction, not judgment --
 * the actual "is this worth surfacing" call is made when the model answers it.
 */
export function buildProactiveInstruction(
  agent: Pick<AgentConfig, "name">,
  check: Pick<ProactiveCheckConfig, "id" | "schedule" | "prompt">,
): string {
  return (
    `This is a scheduled, UNPROMPTED check (id "${check.id}", schedule "${check.schedule}") -- ` +
    `nobody asked this question right now; you are checking on your own initiative as ${agent.name}.\n\n` +
    `Investigate:\n${check.prompt}\n\n` +
    `Reply with EXACTLY one of two forms, nothing else around it:\n` +
    `  - If there is nothing genuinely worth telling the operator about, reply with the single ` +
    `line: NO_FINDING\n` +
    `  - If there IS something worth surfacing, reply with: FINDING: <the message to post>\n\n` +
    `Silence (NO_FINDING) is the normal, correct outcome most of the time -- do not manufacture ` +
    `something to report just to have said anything. Only use FINDING for something the operator ` +
    `would actually want to be interrupted for.`
  );
}

export interface Verdict {
  finding: boolean;
  /** The text to post. Empty when `finding` is false. */
  message: string;
  reason: string;
}

/**
 * Enforce the FINDING/NO_FINDING contract on the model's raw reply. This is the ONLY place a
 * proactive check's "should I post" decision is checked in code, and it checks STRUCTURE, not
 * substance -- it cannot tell a genuine finding from a hallucinated one, only whether the
 * model followed the contract it was given.
 *
 * `require_explicit_finding: true` (the default, and the structurally safer path): anything
 * that is not a well-formed `FINDING: …` reply -- including a malformed or contract-breaking
 * response -- is treated as no finding. Silence is the safe failure mode.
 *
 * `require_explicit_finding: false`: any non-empty reply posts verbatim, finding or not. This
 * is the exact "cron job that posts every day regardless" anti-pattern, kept available only
 * because a caller might have a check that always has something to say -- opting into it is
 * deliberate, never the default.
 */
export function parseProactiveVerdict(
  raw: string,
  requireExplicitFinding: boolean,
): Verdict {
  const trimmed = raw.trim();

  const found = FINDING_RE.exec(trimmed);
  if (found && found[1]!.trim()) {
    return {
      finding: true,
      message: found[1]!.trim(),
      reason: "model reported a finding",
    };
  }
  if (NO_FINDING_RE.test(trimmed) || trimmed.length === 0) {
    return { finding: false, message: "", reason: "model reported no finding" };
  }

  if (!requireExplicitFinding) {
    return {
      finding: trimmed.length > 0,
      message: trimmed,
      reason: "require_explicit_finding=false: posting the raw reply as-is",
    };
  }

  return {
    finding: false,
    message: "",
    reason:
      "model reply did not follow the FINDING/NO_FINDING contract; treated as no finding " +
      "because require_explicit_finding is true",
  };
}

/* -------------------------------------------------------------- watermark persistence ---- */

function watermarkPath(stateDir: string): string {
  return join(expandHome(stateDir), "proactive-watermarks.json");
}

function watermarkKey(agentId: string, checkId: string): string {
  return `${agentId}:${checkId}`;
}

/** Read every check's last-evaluated-through timestamp. Missing file reads as empty, not an error. */
export function readWatermarks(stateDir: string): Record<string, number> {
  const p = watermarkPath(stateDir);
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf8")) as Record<string, number>;
  } catch {
    return {};
  }
}

export function getWatermark(
  stateDir: string,
  agentId: string,
  checkId: string,
): number | null {
  const all = readWatermarks(stateDir);
  const v = all[watermarkKey(agentId, checkId)];
  return typeof v === "number" ? v : null;
}

/** Persist that a check has now been evaluated through `throughMs`, regardless of the verdict. */
export function writeWatermark(
  stateDir: string,
  agentId: string,
  checkId: string,
  throughMs: number,
): void {
  const dir = expandHome(stateDir);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const all = readWatermarks(stateDir);
  all[watermarkKey(agentId, checkId)] = throughMs;
  writeFileSync(watermarkPath(stateDir), `${JSON.stringify(all, null, 2)}\n`, {
    mode: 0o600,
  });
}

/* -------------------------------------------------------------- config-time validation ---- */

export interface DuplicateCheckId {
  id: string;
  count: number;
}

/** Which check ids are used more than once within ONE agent's `proactive_checks`? */
export function findDuplicateCheckIds(
  checks: Array<Pick<ProactiveCheckConfig, "id">>,
): DuplicateCheckId[] {
  const counts = new Map<string, number>();
  for (const c of checks) counts.set(c.id, (counts.get(c.id) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, n]) => n > 1)
    .map(([id, count]) => ({ id, count }));
}

export type SpecParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/**
 * Parse `crew agents add|edit --proactive-check <spec>`'s compact form:
 * `id:cron-schedule:prompt`. Only the first two colons are delimiters -- the prompt is
 * "everything after the second colon", so it may itself contain colons (a schedule field
 * never does). Kept as its own pure function so the CLI's parsing is unit-testable without
 * going through commander.
 */
export function parseProactiveCheckSpec(
  spec: string,
): SpecParseResult<{ id: string; schedule: string; prompt: string }> {
  const m = /^([^:]+):([^:]+):([\s\S]+)$/.exec(spec);
  if (!m) {
    return {
      ok: false,
      error:
        `"${spec}" is not "id:schedule:prompt" (need at least two colons -- ` +
        `e.g. "morning-incidents:0 9 * * *:Check open incidents and report anything urgent")`,
    };
  }
  const [, id, schedule, prompt] = m as unknown as [
    string,
    string,
    string,
    string,
  ];
  return {
    ok: true,
    value: { id: id.trim(), schedule: schedule.trim(), prompt: prompt.trim() },
  };
}

/**
 * Parse `--proactive-channel <id>=<channel>`, used to override where ONE already-specified
 * check posts, without forcing the channel into the harder-to-read compact check spec above.
 */
export function parseProactiveChannelSpec(
  spec: string,
): SpecParseResult<{ id: string; channel: string }> {
  const m = /^([^=]+)=([^=]+)$/.exec(spec);
  if (!m) {
    return {
      ok: false,
      error: `"${spec}" is not "id=channel" (e.g. "morning-incidents=D0123ABCD")`,
    };
  }
  const [, id, channel] = m as unknown as [string, string, string];
  return { ok: true, value: { id: id.trim(), channel: channel.trim() } };
}

/* -------------------------------------------------------------- execution ---- */

export interface ProactiveTurnResult {
  ok: boolean;
  text: string;
  costUsd: number;
}

export interface ProactivePost {
  ok: boolean;
  error?: string;
}

export interface ProactiveCheckContext {
  cfg: Pick<CrewConfig, "policy" | "mode">;
  nowMs: number;
  lastEvaluatedThroughMs: number | null;
  /**
   * Runs the actual model turn. Injectable so `runProactiveCheck` is unit-testable without a
   * real `claude` process -- the REAL implementation (`defaultRunTurn` below) is exactly as
   * untested by design as `runWorker` in `tick.ts`, for the same reason: it shells out to a
   * model, which a plain TypeScript test cannot meaningfully fake.
   */
  runTurn: (
    agent: AgentConfig,
    instruction: string,
  ) => Promise<ProactiveTurnResult>;
  /** Posts to Slack. Injectable for the same reason as `runTurn`. Never called in dry_run. */
  post: (channelId: string, text: string) => Promise<ProactivePost>;
}

export interface ProactiveCheckResult {
  due: boolean;
  posted: boolean;
  reason: string;
  channelId?: string;
  costUsd: number;
  /** The ms timestamp callers should persist as this check's new watermark, when due. */
  evaluatedThroughMs?: number;
}

/**
 * Run one agent's one proactive check: is it due, where could it post, what did the model
 * decide, and did that decision clear the bar to actually post.
 *
 * What is deterministic here: due-check (`isCheckDue`), channel resolution
 * (`resolveProactiveChannel`), and the finding/no-finding gate (`parseProactiveVerdict`). What
 * is NOT: whether `ctx.runTurn`'s reply is a genuine finding -- that is the model's call, made
 * inside `ctx.runTurn`, not something this function evaluates on its own.
 */
export async function runProactiveCheck(
  agent: AgentConfig,
  check: ProactiveCheckConfig,
  ctx: ProactiveCheckContext,
): Promise<ProactiveCheckResult> {
  const due = isCheckDue(check.schedule, ctx.lastEvaluatedThroughMs, ctx.nowMs);
  if (!due.due) {
    return { due: false, posted: false, reason: due.reason, costUsd: 0 };
  }

  const ch = resolveProactiveChannel(check, ctx.cfg);
  if (!ch.ok) {
    return {
      due: true,
      posted: false,
      reason: `channel resolution failed (${ch.ruleId}): ${ch.reason}`,
      costUsd: 0,
      evaluatedThroughMs: ctx.nowMs,
    };
  }

  const instruction = buildProactiveInstruction(agent, check);
  const turn = await ctx.runTurn(agent, instruction);
  if (!turn.ok) {
    return {
      due: true,
      posted: false,
      reason: `model turn failed: ${turn.text.slice(0, 200)}`,
      channelId: ch.channelId,
      costUsd: turn.costUsd,
      evaluatedThroughMs: ctx.nowMs,
    };
  }

  const verdict = parseProactiveVerdict(
    turn.text,
    check.require_explicit_finding,
  );
  if (!verdict.finding) {
    return {
      due: true,
      posted: false,
      reason: verdict.reason,
      channelId: ch.channelId,
      costUsd: turn.costUsd,
      evaluatedThroughMs: ctx.nowMs,
    };
  }

  if (ctx.cfg.mode !== "live") {
    return {
      due: true,
      posted: false,
      reason: `dry_run: would post "${verdict.message.slice(0, 120)}"`,
      channelId: ch.channelId,
      costUsd: turn.costUsd,
      evaluatedThroughMs: ctx.nowMs,
    };
  }

  const posted = await ctx.post(ch.channelId!, verdict.message);
  return {
    due: true,
    posted: posted.ok,
    reason: posted.ok
      ? "posted"
      : `post failed: ${posted.error ?? "unknown error"}`,
    channelId: ch.channelId,
    costUsd: turn.costUsd,
    evaluatedThroughMs: ctx.nowMs,
  };
}

/**
 * The REAL `runTurn`: a fresh, stateless `claude -p` turn per fire. No Slack MCP, no Bash, no
 * network -- same worker sandbox `runWorker()` in `tick.ts` uses for inbound messages, minus
 * the session/thread machinery a one-shot proactive check has no use for.
 *
 * `stateDir` is only used to place the empty `--mcp-config` file `--strict-mcp-config` needs
 * to point at (mirroring `runWorker`'s `no-mcp.json`); it is not otherwise part of this
 * function's contract.
 */
export async function defaultRunTurn(
  cfg: Pick<CrewConfig, "state_dir" | "budget">,
  agent: AgentConfig,
  instruction: string,
): Promise<ProactiveTurnResult> {
  const dir = expandHome(cfg.state_dir);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const mcpNone = join(dir, "no-mcp.json");
  writeFileSync(mcpNone, JSON.stringify({ mcpServers: {} }));

  const persona = resolvePersona(agent);
  const system =
    `You are ${agent.name}, running a scheduled self-check on behalf of the operator. ` +
    (persona ? `${persona} ` : "") +
    `You have no Slack connection, no shell and no network; a deterministic daemon decides ` +
    `whether to post your reply. Answer for someone reading on a phone if you do report a ` +
    `finding: lead with the answer, cite as path/to/file.ts:42 rather than pasting source. ` +
    `Never invent a path, symbol or line number; say you could not find it.`;

  const r = await runClaude(
    [
      "--model",
      agent.model,
      "--tools",
      ...agent.tools,
      "--strict-mcp-config",
      "--mcp-config",
      mcpNone,
      "--disallowedTools",
      "Bash",
      "--permission-mode",
      "dontAsk",
      "--setting-sources",
      "",
      "--disable-slash-commands",
      "--max-budget-usd",
      String(cfg.budget.per_task_usd),
      "--append-system-prompt",
      system,
      "--add-dir",
      expandHome(agent.workspace),
    ],
    instruction,
    agent.task_timeout_ms,
  );
  return { ok: r.ok, text: r.text, costUsd: r.costUsd };
}

/** The REAL `post`: sends via the same Slack MCP path `tick.ts` uses for outbound replies. */
export async function defaultPost(
  channelId: string,
  text: string,
): Promise<ProactivePost> {
  const r = await sendMessage(channelId, text);
  return { ok: r.ok, error: r.ok ? undefined : r.error };
}

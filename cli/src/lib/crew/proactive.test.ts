import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildProactiveInstruction,
  findDuplicateCheckIds,
  getWatermark,
  isCheckDue,
  parseProactiveCheckSpec,
  parseProactiveChannelSpec,
  parseProactiveVerdict,
  readWatermarks,
  resolveProactiveChannel,
  runProactiveCheck,
  writeWatermark,
  type ProactiveCheckContext,
} from "./proactive.js";
import type { AgentConfig, CrewConfig, ProactiveCheckConfig } from "./types.js";
import { AgentSchema, ProactiveCheckSchema } from "./types.js";

function agent(over: Partial<AgentConfig> = {}): AgentConfig {
  return AgentSchema.parse({
    name: "Ralph",
    sigils: ["!ralph"],
    workspace: "/tmp/ws",
    ...over,
  });
}

function check(over: Partial<ProactiveCheckConfig> = {}): ProactiveCheckConfig {
  return ProactiveCheckSchema.parse({
    id: "morning-incidents",
    schedule: "0 9 * * *",
    prompt: "Check open incidents; report only if one needs attention.",
    ...over,
  });
}

function stateDir(): string {
  return mkdtempSync(join(tmpdir(), "crew-proactive-test-"));
}

/* -------------------------------------------------------------- isCheckDue ---- */

describe("isCheckDue: cron matching", () => {
  // Wed 2025-01-15 09:00:00 local time.
  const NINE_AM = new Date(2025, 0, 15, 9, 0, 0).getTime();

  test("matches on the exact scheduled minute when never evaluated before", () => {
    const r = isCheckDue("0 9 * * *", null, NINE_AM);
    expect(r.due).toBe(true);
    expect(r.firedForMs).toBe(NINE_AM);
  });

  test("does not match a minute that is not 9:00", () => {
    const nineOhOne = NINE_AM + 60_000;
    // Never evaluated -> only the CURRENT minute (9:01) is considered, and 9:01 != 9:00.
    const r = isCheckDue("0 9 * * *", null, nineOhOne);
    expect(r.due).toBe(false);
  });

  test("fires once when scanning forward finds the 9:00 slot inside the window", () => {
    const evaluatedThrough = NINE_AM - 5 * 60_000; // last checked at 8:55
    const now = NINE_AM + 2 * 60_000; // now is 9:02
    const r = isCheckDue("0 9 * * *", evaluatedThrough, now);
    expect(r.due).toBe(true);
    expect(r.firedForMs).toBe(NINE_AM);
    expect(r.collapsed).toBe(false);
  });

  test("collapses multiple missed slots into one fire for the most recent", () => {
    // Every hour on the hour; daemon was down between 07:00 (last eval) and 10:05 (now).
    const sevenAm = new Date(2025, 0, 15, 7, 0, 0).getTime();
    const tenOhFive = new Date(2025, 0, 15, 10, 5, 0).getTime();
    const r = isCheckDue("0 * * * *", sevenAm, tenOhFive);
    expect(r.due).toBe(true);
    expect(r.collapsed).toBe(true);
    // Most recent slot is 10:00, not 8:00 or 9:00.
    expect(r.firedForMs).toBe(new Date(2025, 0, 15, 10, 0, 0).getTime());
  });

  test("empty schedule is never due", () => {
    expect(isCheckDue("", null, NINE_AM).due).toBe(false);
  });

  test("evaluating again for the same instant is not due a second time", () => {
    const first = isCheckDue("0 9 * * *", null, NINE_AM);
    expect(first.due).toBe(true);
    const second = isCheckDue("0 9 * * *", NINE_AM, NINE_AM);
    expect(second.due).toBe(false);
  });

  test("day-of-week field restricts to weekdays", () => {
    // 2025-01-18 is a Saturday.
    const saturdayNine = new Date(2025, 0, 18, 9, 0, 0).getTime();
    expect(isCheckDue("0 9 * * 1-5", null, saturdayNine).due).toBe(false);
    const mondayNine = new Date(2025, 0, 20, 9, 0, 0).getTime();
    expect(isCheckDue("0 9 * * 1-5", null, mondayNine).due).toBe(true);
  });

  test("step syntax (*/15) matches every 15 minutes", () => {
    const nineFifteen = NINE_AM + 15 * 60_000;
    expect(isCheckDue("*/15 * * * *", null, nineFifteen).due).toBe(true);
    const nineSeventeen = NINE_AM + 17 * 60_000;
    expect(isCheckDue("*/15 * * * *", null, nineSeventeen).due).toBe(false);
  });
});

/* -------------------------------------------------------------- resolveProactiveChannel ---- */

function cfgWithChannels(
  egress: string[],
  ingress = egress,
): Pick<CrewConfig, "policy"> {
  return {
    policy: {
      ingress: {
        channels: ingress,
        authors: ["U0TESTUSER1"],
        require_sigil: true,
        ignore_older_than_ms: 900_000,
        respond_to_others: false,
      },
      egress: {
        channels: egress,
        require_identity_prefix: true,
        max_message_chars: 3500,
        max_messages_per_task: 6,
      },
    },
  };
}

describe("resolveProactiveChannel", () => {
  test("unset channel defaults to the agent's own egress channel", () => {
    const r = resolveProactiveChannel({}, cfgWithChannels(["D0OWNERDM01"]));
    expect(r.ok).toBe(true);
    expect(r.channelId).toBe("D0OWNERDM01");
    expect(r.defaulted).toBe(true);
  });

  test("explicit channel already in the egress allowlist is used as-is", () => {
    const r = resolveProactiveChannel(
      { channel: "C0SHAREDCH01" },
      cfgWithChannels(["D0OWNERDM01", "C0SHAREDCH01"]),
    );
    expect(r.ok).toBe(true);
    expect(r.channelId).toBe("C0SHAREDCH01");
    expect(r.defaulted).toBe(false);
  });

  test("explicit channel NOT in the egress allowlist is refused, never silently allowed", () => {
    const r = resolveProactiveChannel(
      { channel: "C0RANDOMCH99" },
      cfgWithChannels(["D0OWNERDM01"]),
    );
    expect(r.ok).toBe(false);
    expect(r.ruleId).toBe("channel_not_egress_allowlisted");
  });

  test("no egress channel configured at all fails rather than posting nowhere", () => {
    const r = resolveProactiveChannel({}, cfgWithChannels([]));
    expect(r.ok).toBe(false);
    expect(r.ruleId).toBe("no_owner_channel");
  });
});

/* -------------------------------------------------------------- parseProactiveVerdict ---- */

describe("parseProactiveVerdict", () => {
  test("FINDING: reply is a finding", () => {
    const v = parseProactiveVerdict(
      "FINDING: three incidents are past SLA",
      true,
    );
    expect(v.finding).toBe(true);
    expect(v.message).toBe("three incidents are past SLA");
  });

  test("NO_FINDING reply is silence", () => {
    const v = parseProactiveVerdict("NO_FINDING", true);
    expect(v.finding).toBe(false);
    expect(v.message).toBe("");
  });

  test("empty reply is silence", () => {
    expect(parseProactiveVerdict("", true).finding).toBe(false);
  });

  test("require_explicit_finding=true: a reply that ignores the contract is silence, not a post", () => {
    const v = parseProactiveVerdict("Everything looks fine today!", true);
    expect(v.finding).toBe(false);
    expect(v.reason).toMatch(/FINDING\/NO_FINDING contract/);
  });

  test("require_explicit_finding=false: any non-empty reply posts verbatim -- the opt-in anti-pattern", () => {
    const v = parseProactiveVerdict("Everything looks fine today!", false);
    expect(v.finding).toBe(true);
    expect(v.message).toBe("Everything looks fine today!");
  });

  test("require_explicit_finding=false still treats an empty reply as silence", () => {
    expect(parseProactiveVerdict("", false).finding).toBe(false);
  });
});

/* -------------------------------------------------------------- buildProactiveInstruction ---- */

describe("buildProactiveInstruction", () => {
  test("names the check id, schedule and prompt, and states the contract", () => {
    const text = buildProactiveInstruction(agent(), check());
    expect(text).toContain("morning-incidents");
    expect(text).toContain("0 9 * * *");
    expect(text).toContain("Check open incidents");
    expect(text).toContain("NO_FINDING");
    expect(text).toContain("FINDING:");
  });
});

/* -------------------------------------------------------------- findDuplicateCheckIds ---- */

describe("findDuplicateCheckIds", () => {
  test("no duplicates -> empty", () => {
    expect(findDuplicateCheckIds([{ id: "a" }, { id: "b" }])).toEqual([]);
  });

  test("one id repeated twice is reported once, with the right count", () => {
    const dupes = findDuplicateCheckIds([
      { id: "a" },
      { id: "a" },
      { id: "b" },
    ]);
    expect(dupes).toEqual([{ id: "a", count: 2 }]);
  });
});

/* -------------------------------------------------------------- spec parsers ---- */

describe("parseProactiveCheckSpec", () => {
  test("parses id:schedule:prompt", () => {
    const r = parseProactiveCheckSpec(
      "morning-incidents:0 9 * * *:Check open incidents; report only if urgent",
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual({
        id: "morning-incidents",
        schedule: "0 9 * * *",
        prompt: "Check open incidents; report only if urgent",
      });
    }
  });

  test("a prompt containing colons is preserved verbatim", () => {
    const r = parseProactiveCheckSpec(
      "budget-check:0 8 * * *:Alert if over budget: check spend vs $100 cap",
    );
    expect(r.ok).toBe(true);
    if (r.ok)
      expect(r.value.prompt).toBe(
        "Alert if over budget: check spend vs $100 cap",
      );
  });

  test("fewer than two colons is rejected", () => {
    expect(parseProactiveCheckSpec("no-colons-here").ok).toBe(false);
  });
});

describe("parseProactiveChannelSpec", () => {
  test("parses id=channel", () => {
    const r = parseProactiveChannelSpec("morning-incidents=D0123ABCD");
    expect(r.ok).toBe(true);
    if (r.ok)
      expect(r.value).toEqual({
        id: "morning-incidents",
        channel: "D0123ABCD",
      });
  });

  test("missing '=' is rejected", () => {
    expect(parseProactiveChannelSpec("morning-incidents").ok).toBe(false);
  });
});

/* -------------------------------------------------------------- watermark persistence ---- */

describe("watermark persistence", () => {
  test("an unread watermark file reads as empty, not an error", () => {
    expect(readWatermarks(stateDir())).toEqual({});
    expect(getWatermark(stateDir(), "ralph", "morning-incidents")).toBeNull();
  });

  test("write then read round-trips, scoped by (agentId, checkId)", () => {
    const dir = stateDir();
    writeWatermark(dir, "ralph", "morning-incidents", 12345);
    expect(getWatermark(dir, "ralph", "morning-incidents")).toBe(12345);
    // A different check on the same agent is unaffected.
    expect(getWatermark(dir, "ralph", "other-check")).toBeNull();
  });

  test("writing one check's watermark does not clobber another's already on disk", () => {
    const dir = stateDir();
    writeWatermark(dir, "ralph", "a", 100);
    writeWatermark(dir, "ralph", "b", 200);
    expect(getWatermark(dir, "ralph", "a")).toBe(100);
    expect(getWatermark(dir, "ralph", "b")).toBe(200);
  });
});

/* -------------------------------------------------------------- runProactiveCheck ---- */

describe("runProactiveCheck: orchestration", () => {
  const NINE_AM = new Date(2025, 0, 15, 9, 0, 0).getTime();

  function ctx(
    over: Partial<ProactiveCheckContext> = {},
  ): ProactiveCheckContext & { runTurnCalls: number; postCalls: number } {
    let runTurnCalls = 0;
    let postCalls = 0;
    const base: ProactiveCheckContext = {
      cfg: { mode: "live", ...cfgWithChannels(["D0OWNERDM01"]) },
      nowMs: NINE_AM,
      lastEvaluatedThroughMs: null,
      runTurn: async () => {
        runTurnCalls++;
        return { ok: true, text: "NO_FINDING", costUsd: 0.01 };
      },
      post: async () => {
        postCalls++;
        return { ok: true };
      },
      ...over,
    };
    // `defineProperties` (not `Object.assign`) so these stay LIVE getters -- assign would
    // copy the evaluated value at construction time (always 0), not a reference that updates
    // as `runTurn`/`post` are actually called during the test.
    return Object.defineProperties(base, {
      runTurnCalls: { get: () => runTurnCalls, enumerable: true },
      postCalls: { get: () => postCalls, enumerable: true },
    }) as ProactiveCheckContext & { runTurnCalls: number; postCalls: number };
  }

  test("not due: never calls the model turn at all", async () => {
    const c = ctx({ nowMs: NINE_AM + 60_000 }); // one minute after 9:00, never evaluated
    const result = await runProactiveCheck(agent(), check(), c);
    expect(result.due).toBe(false);
    expect(result.costUsd).toBe(0);
  });

  test("due + NO_FINDING: model runs, nothing posts", async () => {
    const c = ctx();
    const result = await runProactiveCheck(agent(), check(), c);
    expect(result.due).toBe(true);
    expect(result.posted).toBe(false);
    expect(result.reason).toMatch(/no finding/);
  });

  test("due + FINDING + mode=live: posts", async () => {
    const c = ctx({
      runTurn: async () => ({
        ok: true,
        text: "FINDING: three incidents overdue",
        costUsd: 0.02,
      }),
    });
    const result = await runProactiveCheck(agent(), check(), c);
    expect(result.due).toBe(true);
    expect(result.posted).toBe(true);
    expect(result.reason).toBe("posted");
    expect(c.postCalls).toBe(1);
  });

  test("due + FINDING + mode=dry_run: never calls post, reports what it would have posted", async () => {
    const c = ctx({
      cfg: { mode: "dry_run", ...cfgWithChannels(["D0OWNERDM01"]) },
      runTurn: async () => ({
        ok: true,
        text: "FINDING: three incidents overdue",
        costUsd: 0.02,
      }),
    });
    const result = await runProactiveCheck(agent(), check(), c);
    expect(result.due).toBe(true);
    expect(result.posted).toBe(false);
    expect(result.reason).toMatch(/dry_run: would post/);
    expect(c.postCalls).toBe(0);
  });

  test("unresolved channel: model never even runs", async () => {
    const c = ctx({ cfg: { mode: "live", ...cfgWithChannels([]) } });
    const result = await runProactiveCheck(agent(), check(), c);
    expect(result.due).toBe(true);
    expect(result.posted).toBe(false);
    expect(result.reason).toMatch(/channel resolution failed/);
    expect(c.runTurnCalls).toBe(0);
  });

  test("require_explicit_finding=false posts the raw reply even without the FINDING contract", async () => {
    const c = ctx({
      runTurn: async () => ({
        ok: true,
        text: "Looks fine, nothing to add",
        costUsd: 0.01,
      }),
    });
    const result = await runProactiveCheck(
      agent(),
      check({ require_explicit_finding: false }),
      c,
    );
    expect(result.posted).toBe(true);
  });
});

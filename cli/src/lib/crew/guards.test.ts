import { describe, expect, test } from "bun:test";
import {
  agentPrefixMatch,
  allSigils,
  decide,
  findSigil,
  hasServerSuffix,
  identityPrefix,
  isDirectMessage,
  isOwnerOnlyViolation,
  routeToAgent,
  stripSigils,
  SERVER_SUFFIX_RE,
} from "./guards.js";
import {
  CrewConfigSchema,
  type CrewConfig,
  type InboundMessage,
} from "./types.js";

const NOW = 1_785_141_300_000;
const TS = "1785141296.398489"; // ~4s before NOW

const config: CrewConfig = CrewConfigSchema.parse({
  enabled: true,
  mode: "dry_run",
  slack: { self_user_id: "U0TESTUSER1" },
  agents: {
    ralph: {
      name: "Ralph",
      sigils: ["!ralph", "@agent-ralph"],
      workspace: "/tmp/ws",
    },
  },
  policy: {
    ingress: { channels: ["D0TESTDM001"], authors: ["U0TESTUSER1"] },
    egress: { channels: ["D0TESTDM001"] },
  },
});

const SIGILS = config.agents.ralph!.sigils;

function msg(over: Partial<InboundMessage> = {}): InboundMessage {
  return {
    channelId: "D0TESTDM001",
    ts: TS,
    author: "U0TESTUSER1",
    text: "!ralph what changed in core this week?",
    hasServerSuffix: false,
    ...over,
  };
}

const noOutbox = () => false;
const ctx = (outboxHas = noOutbox) => ({ config, outboxHas, nowMs: NOW });

describe("server suffix detection (fixture is a real recorded read-back, C13)", () => {
  // Verbatim tail of the real post at ts 1785141296.398489.
  const REAL =
    "_Authorised by the operator._\n*Sent using* <@U0APPID0001|Slack MCP>";

  test("fires on the real read-back", () => {
    expect(hasServerSuffix(REAL)).toBe(true);
  });

  test("is app-agnostic", () => {
    expect(hasServerSuffix("hi\n*Sent using* <@U0AQC6VGVAP|Claude>")).toBe(
      true,
    );
    expect(
      hasServerSuffix("hi\n*Sent using* <@U0XXXXXXXXX|Some Future App>"),
    ).toBe(true);
  });

  test("does not fire on ordinary text", () => {
    expect(hasServerSuffix("what does *Sent using* mean?")).toBe(false);
    expect(hasServerSuffix("plain message")).toBe(false);
  });

  test("regex is anchored at end, which is correct because the suffix genuinely is last", () => {
    expect(SERVER_SUFFIX_RE.test("*Sent using* <@U1|X>\ntrailing words")).toBe(
      false,
    );
  });
});

describe("sigil detection ignores quoted context", () => {
  test("plain sigil matches", () => {
    expect(findSigil("!ralph hello", SIGILS)).toBe("!ralph");
  });

  test("blockquoted sigil does not match -- this is what stops the ack re-triggering", () => {
    expect(findSigil("> !ralph what changed?", SIGILS)).toBeNull();
  });

  test("fenced sigil does not match", () => {
    expect(findSigil('```\n"sigils": ["!ralph"]\n```', SIGILS)).toBeNull();
  });

  test("@agent-ralph also matches", () => {
    expect(findSigil("hey @agent-ralph look at this", SIGILS)).toBe(
      "@agent-ralph",
    );
  });
});

describe("G1 is primary and never overridden", () => {
  test("drops our own post", () => {
    const d = decide(
      msg(),
      ctx(() => true),
    );
    expect(d.allow).toBe(false);
    if (!d.allow) expect(d.ruleId).toBe("G1_outbox");
  });

  test("drops our own post EVEN WITH a sigil present", () => {
    const d = decide(
      msg({ text: "!ralph do it" }),
      ctx(() => true),
    );
    expect(d.allow).toBe(false);
    if (!d.allow) expect(d.ruleId).toBe("G1_outbox");
  });
});

describe("the self-reply loop is impossible", () => {
  test("feeding Ralph's own rendered output back produces no task", () => {
    // What the renderer actually emits: prefix, quoted request, suffix appended by Slack.
    const ownOutput = msg({
      text: ":robot_face: *Ralph* · working\n> what changed in core this week?\n*Sent using* <@U0APPID0001|Slack MCP>",
      hasServerSuffix: true,
    });
    expect(
      decide(
        ownOutput,
        ctx(() => true),
      ).allow,
    ).toBe(false); // G1
    expect(decide(ownOutput, ctx(noOutbox)).allow).toBe(false); // G2b, with the ledger lost
  });

  test("ack quoting the request does not re-trigger, because the quote is a blockquote", () => {
    const ack = msg({
      text: ":robot_face: *Ralph* · working\n> !ralph what changed?\n*Sent using* <@U0APPID0001|Slack MCP>",
      hasServerSuffix: true,
    });
    // Even with G1 and G2b both blind, this is caught twice over. G2a fires first now,
    // on the identity prefix; strip that and the quoted sigil still leaves G3 to catch it.
    // Both are asserted, so neither layer can regress unnoticed.
    const blind = { ...ctx(noOutbox), config: { ...config } };
    const d = decide({ ...ack, hasServerSuffix: false }, blind);
    expect(d.allow).toBe(false);
    if (!d.allow) expect(d.ruleId).toBe("G2a_agent_prefix");

    const noPrefix = decide(
      {
        ...ack,
        text: "· working\n> !ralph what changed?",
        hasServerSuffix: false,
      },
      blind,
    );
    expect(noPrefix.allow).toBe(false);
    if (!noPrefix.allow) expect(noPrefix.ruleId).toBe("G3_no_sigil");
  });
});

describe("a sigil overrides G2b but not G1", () => {
  test("operator quoting Ralph AND asking a question is answered", () => {
    const quoteBack = msg({
      text: "!ralph explain this\n> earlier answer\n*Sent using* <@U0APPID0001|Slack MCP>",
      hasServerSuffix: true,
    });
    expect(decide(quoteBack, ctx(noOutbox)).allow).toBe(true);
  });

  test("pasting the suffix string is not a permanent self-DoS", () => {
    const pasted = msg({
      text: "!ralph what does *Sent using* <@U1|X> mean?",
      hasServerSuffix: true,
    });
    expect(decide(pasted, ctx(noOutbox)).allow).toBe(true);
  });
});

describe("ingress policy", () => {
  test("wrong channel denied with a rule id", () => {
    const d = decide(msg({ channelId: "C0ABCDEFGHI" }), ctx());
    expect(d.allow).toBe(false);
    if (!d.allow) expect(d.ruleId).toBe("ingress_channel");
  });

  test("wrong author denied", () => {
    const d = decide(msg({ author: "U0OTHERUSER" }), ctx());
    expect(d.allow).toBe(false);
    if (!d.allow) expect(d.ruleId).toBe("ingress_author");
  });

  test("cold start does not answer a three-day backlog", () => {
    const old = msg({ ts: String((NOW - 3 * 86_400_000) / 1000) });
    const d = decide(old, ctx());
    expect(d.allow).toBe(false);
    if (!d.allow) expect(d.ruleId).toBe("too_old");
  });

  test("no sigil, no task", () => {
    const d = decide(msg({ text: "note to self: buy milk" }), ctx());
    expect(d.allow).toBe(false);
    if (!d.allow) expect(d.ruleId).toBe("G3_no_sigil");
  });

  test("happy path allows and reports the sigil", () => {
    const d = decide(msg(), ctx());
    expect(d.allow).toBe(true);
    if (d.allow) expect(d.sigil).toBe("!ralph");
  });
});

describe("owner-only guardrail (isDirectMessage / isOwnerOnlyViolation)", () => {
  test("D… channel ids are direct messages, C… are not", () => {
    expect(isDirectMessage("D0TESTDM001")).toBe(true);
    expect(isDirectMessage("C0ABCDEFGHI")).toBe(false);
  });

  const cfg = (respondToOthers: boolean) => ({
    slack: { self_user_id: "U0TESTUSER1" },
    policy: { ingress: { respond_to_others: respondToOthers } },
  });

  test("the owner in a shared channel is never a violation", () => {
    expect(
      isOwnerOnlyViolation(
        { channelId: "C0ABCDEFGHI", author: "U0TESTUSER1" },
        cfg(false),
      ),
    ).toBe(false);
  });

  test("someone else in a shared channel is a violation by default", () => {
    expect(
      isOwnerOnlyViolation(
        { channelId: "C0ABCDEFGHI", author: "U0OTHERUSER" },
        cfg(false),
      ),
    ).toBe(true);
  });

  test("respond_to_others: true lifts the violation for the same message", () => {
    expect(
      isOwnerOnlyViolation(
        { channelId: "C0ABCDEFGHI", author: "U0OTHERUSER" },
        cfg(true),
      ),
    ).toBe(false);
  });

  test("someone else in the owner's own self-DM is never a violation of THIS guard -- a", () => {
    // self-DM cannot contain a second author in practice; the ingress_author allowlist is
    // what actually refuses them, checked separately and earlier in decide().
    expect(
      isOwnerOnlyViolation(
        { channelId: "D0TESTDM001", author: "U0OTHERUSER" },
        cfg(false),
      ),
    ).toBe(false);
  });
});

describe("owner-only guardrail wired into decide()", () => {
  const sharedChannelConfig: CrewConfig = CrewConfigSchema.parse({
    enabled: true,
    mode: "dry_run",
    slack: { self_user_id: "U0TESTUSER1" },
    agents: {
      ralph: {
        name: "Ralph",
        sigils: ["!ralph", "@agent-ralph"],
        workspace: "/tmp/ws",
      },
    },
    policy: {
      ingress: {
        channels: ["C0SHAREDCH1"],
        authors: ["U0TESTUSER1", "U0TEAMMATE1"],
      },
      egress: { channels: ["C0SHAREDCH1"] },
    },
  });

  test("a teammate on the authors allowlist is still refused in a shared channel by default", () => {
    const d = decide(
      msg({
        channelId: "C0SHAREDCH1",
        author: "U0TEAMMATE1",
        text: "!ralph what's the status?",
      }),
      { config: sharedChannelConfig, outboxHas: noOutbox, nowMs: NOW },
    );
    expect(d.allow).toBe(false);
    if (!d.allow) expect(d.ruleId).toBe("owner_only");
  });

  test("the owner is still answered in that same shared channel", () => {
    const d = decide(
      msg({
        channelId: "C0SHAREDCH1",
        author: "U0TESTUSER1",
        text: "!ralph what's the status?",
      }),
      { config: sharedChannelConfig, outboxHas: noOutbox, nowMs: NOW },
    );
    expect(d.allow).toBe(true);
  });

  test("respond_to_others: true lets the same teammate through", () => {
    const opened: CrewConfig = CrewConfigSchema.parse({
      ...sharedChannelConfig,
      policy: {
        ingress: {
          ...sharedChannelConfig.policy.ingress,
          respond_to_others: true,
        },
        egress: sharedChannelConfig.policy.egress,
      },
    });
    const d = decide(
      msg({
        channelId: "C0SHAREDCH1",
        author: "U0TEAMMATE1",
        text: "!ralph what's the status?",
      }),
      { config: opened, outboxHas: noOutbox, nowMs: NOW },
    );
    expect(d.allow).toBe(true);
  });

  test("the default config's respond_to_others is false", () => {
    expect(config.policy.ingress.respond_to_others).toBe(false);
  });
});

describe("config validation refuses unsafe shapes", () => {
  test("non-canonical channel id is rejected -- 'general' would post to #general", () => {
    expect(() =>
      CrewConfigSchema.parse({
        slack: { self_user_id: "U0TESTUSER1" },
        agents: { ralph: { name: "R", sigils: ["!ralph"], workspace: "/tmp" } },
        policy: {
          ingress: { channels: ["general"], authors: ["U0TESTUSER1"] },
          egress: { channels: ["D0TESTDM001"] },
        },
      }),
    ).toThrow();
  });

  test("defaults are safe: disabled and dry_run", () => {
    const c = CrewConfigSchema.parse({
      slack: { self_user_id: "U0TESTUSER1" },
      agents: { ralph: { name: "R", sigils: ["!ralph"], workspace: "/tmp" } },
      policy: {
        ingress: { channels: ["D0TESTDM001"], authors: ["U0TESTUSER1"] },
        egress: { channels: ["D0TESTDM001"] },
      },
    });
    expect(c.enabled).toBe(false);
    expect(c.mode).toBe("dry_run");
  });
});

describe("stripSigils", () => {
  test("removes sigils so a rendered excerpt cannot re-trigger", () => {
    expect(stripSigils("!ralph what changed?", SIGILS)).toBe("what changed?");
  });
});

describe("thread follow-ups: membership is the authorisation", () => {
  test("a reply with no sigil IS answered inside an active thread", () => {
    const followUp = msg({ text: "Tell me about France and its history." });
    const d = decide(followUp, { ...ctx(), inActiveThread: true });
    expect(d.allow).toBe(true);
  });

  test("the same message outside a thread is still dropped", () => {
    const d = decide(
      msg({ text: "Tell me about France and its history." }),
      ctx(),
    );
    expect(d.allow).toBe(false);
    if (!d.allow) expect(d.ruleId).toBe("G3_no_sigil");
  });

  test("G1 still applies inside a thread -- Ralph's own reply is not a follow-up", () => {
    const own = msg({ text: "Yep, I am here.", hasServerSuffix: true });
    const d = decide(own, { ...ctx(() => true), inActiveThread: true });
    expect(d.allow).toBe(false);
    if (!d.allow) expect(d.ruleId).toBe("G1_outbox");
  });

  test("G2b does NOT apply inside a thread: G1 owns that job there", () => {
    // The operator answering from Claude-in-Slack carries the same suffix Ralph does.
    // Dropping on it inside a thread silently eats real follow-ups, which happened live.
    const viaMcp = msg({
      text: "What number did you pick?",
      hasServerSuffix: true,
    });
    expect(decide(viaMcp, { ...ctx(), inActiveThread: true }).allow).toBe(true);
  });

  test("but G2b still applies to a ROOT message, so agent chatter does not wake Ralph", () => {
    const chatter = msg({
      text: "some other agent output",
      hasServerSuffix: true,
    });
    const d = decide(chatter, ctx());
    expect(d.allow).toBe(false);
    if (!d.allow) expect(d.ruleId).toBe("G2b_server_suffix");
  });
});

describe("the age filter is a cold-start guard, not a conversation rule", () => {
  const old = () =>
    msg({
      ts: String((NOW - 2 * 3_600_000) / 1000),
      text: "Tell me about France.",
    });

  test("a two-hour-old ROOT message is still dropped", () => {
    const d = decide(old(), ctx());
    expect(d.allow).toBe(false);
    if (!d.allow) expect(d.ruleId).toBe("too_old");
  });

  test("a two-hour-old THREAD follow-up is answered -- it never got a reply", () => {
    const d = decide(old(), { ...ctx(), inActiveThread: true });
    expect(d.allow).toBe(true);
  });
});

describe("routing picks the agent a message addresses", () => {
  const agents = {
    ralph: { enabled: true, sigils: ["!ralph", "@agent-ralph"] },
    scout: { enabled: true, sigils: ["!scout", "@agent-scout"] },
    dormant: { enabled: false, sigils: ["!dormant"] },
  };

  test("routes by sigil", () => {
    expect(routeToAgent("!ralph hello", agents)?.id).toBe("ralph");
    expect(routeToAgent("!scout hello", agents)?.id).toBe("scout");
  });

  test("a disabled agent is out of routing -- this is what `agents disable` means", () => {
    expect(routeToAgent("!dormant hello", agents)).toBeNull();
  });

  test("no sigil routes nowhere, so mention mode stays quiet", () => {
    expect(routeToAgent("just thinking out loud", agents)).toBeNull();
  });

  test("a quoted sigil does not route, so Ralph's ack cannot summon Scout", () => {
    expect(routeToAgent("> !scout do a thing", agents)).toBeNull();
  });

  test("allSigils covers only enabled agents", () => {
    expect(allSigils(agents)).toEqual([
      "!ralph",
      "@agent-ralph",
      "!scout",
      "@agent-scout",
    ]);
  });

  test("an @agent-<name> mention routes, which is why G4 hops is reachable", () => {
    expect(routeToAgent("hey @agent-scout take a look", agents)?.id).toBe(
      "scout",
    );
  });
});

describe("G2a agent identity prefix (fixtures are real recorded read-backs, C13)", () => {
  /**
   * These two are verbatim from the live thread in D0TESTDM001. They are the READ-BACK
   * form, which is what makes them the right fixtures: we sent `🤖 **Ralph**` and Slack
   * returned `:robot_face: *Ralph*`. A guard tested only against the sent form would pass
   * its tests and never fire in production.
   */
  const REAL_ACK =
    ":robot_face: *Ralph* · working\n> what changed in core\n`t-abc123`";
  const REAL_RESULT =
    ":robot_face: *Ralph*\nHere is what I found.\n\n_`t-abc123` · $0.019_";

  test("fires on the real read-back of an ack and of a result", () => {
    expect(agentPrefixMatch(REAL_ACK, config.agents)).toBe("ralph");
    expect(agentPrefixMatch(REAL_RESULT, config.agents)).toBe("ralph");
  });

  test("fires on the SENT form too, so a same-tick read cannot slip through", () => {
    expect(agentPrefixMatch("🤖 **Ralph**\nbody", config.agents)).toBe("ralph");
    expect(
      agentPrefixMatch(":robot_face: **Ralph** · working", config.agents),
    ).toBe("ralph");
  });

  test("what the renderer emits is by construction what the guard catches", () => {
    // The round trip that matters: identityPrefix() is shared with tick.ts, and Slack's
    // observed transform is `**` -> `*`. Both ends must be recognised.
    const sent = `${identityPrefix(config.agents.ralph!)}\nbody`;
    expect(agentPrefixMatch(sent, config.agents)).toBe("ralph");
    expect(agentPrefixMatch(sent.replace(/\*\*/g, "*"), config.agents)).toBe(
      "ralph",
    );
  });

  test("does NOT fire on the operator's own messages", () => {
    for (const t of [
      "!ralph what changed in core this week?",
      "why did Ralph say that?",
      "**Ralph** is the name I picked", // bold name but no emoji -- emoji is required
      "can you explain :robot_face: emojis?",
      "🤖 beep boop",
    ]) {
      expect(agentPrefixMatch(t, config.agents), t).toBeNull();
    }
  });

  test("does not fire when Ralph is QUOTED, which is Slack's own quote-button format", () => {
    const quoted = `> :robot_face: *Ralph*\n> Here is what I found.\n\nthat's wrong, try again`;
    expect(agentPrefixMatch(quoted, config.agents)).toBeNull();
  });

  test("recognises a DISABLED agent's output -- it is still ours, so still not input", () => {
    const withScout = CrewConfigSchema.parse({
      enabled: true,
      mode: "dry_run",
      slack: { self_user_id: "U0TESTUSER1" },
      agents: {
        ralph: { name: "Ralph", sigils: ["!ralph"], workspace: "/tmp/ws" },
        scout: {
          enabled: false,
          name: "Scout",
          sigils: ["!scout"],
          workspace: "/tmp/ws",
        },
      },
      policy: {
        ingress: { channels: ["D0TESTDM001"], authors: ["U0TESTUSER1"] },
        egress: { channels: ["D0TESTDM001"] },
      },
    });
    expect(
      agentPrefixMatch(":robot_face: *Scout*\nfindings", withScout.agents),
    ).toBe("scout");
  });

  test("THE GAP THIS CLOSES: an agent-authored message inside a thread we own", () => {
    // Before G2a this returned allow:true, because G2b is deliberately off inside a thread
    // and the age filter is relaxed there. That made a live thread the one place another
    // agent's output was treated as a follow-up.
    const d = decide(msg({ text: REAL_RESULT, hasServerSuffix: true }), {
      ...ctx(),
      inActiveThread: true,
    });
    expect(d.allow).toBe(false);
    if (!d.allow) expect(d.ruleId).toBe("G2a_agent_prefix");
  });

  test("a sigil does NOT override it, because our own output legitimately contains sigils", () => {
    const d = decide(
      msg({
        text: ":robot_face: *Ralph*\nYour sigils are !ralph and @agent-ralph.",
      }),
      { ...ctx(), inActiveThread: true },
    );
    expect(d.allow).toBe(false);
    if (!d.allow) expect(d.ruleId).toBe("G2a_agent_prefix");
  });

  test("G1 still takes precedence, so the primary guard keeps its rule id", () => {
    const d = decide(msg({ text: REAL_RESULT }), {
      ...ctx(() => true),
      inActiveThread: true,
    });
    expect(d.allow).toBe(false);
    if (!d.allow) expect(d.ruleId).toBe("G1_outbox");
  });

  test("a real operator follow-up in a thread is still allowed", () => {
    const d = decide(
      msg({ text: "actually make it the last 3 days", hasServerSuffix: true }),
      { ...ctx(), inActiveThread: true },
    );
    expect(d.allow).toBe(true);
  });
});

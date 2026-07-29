import type { CrewConfig, Decision, InboundMessage } from "./types.js";

/**
 * Loop guards and ingress policy. Pure functions, no I/O.
 *
 * The operator and Ralph share one Slack author id in a self-DM, so "ignore my own
 * messages" is not expressible by author. Without a guard, tick 2 reads Ralph's own
 * reply and answers it, forever.
 *
 *   G1  outbox ts        PRIMARY. `ts` is Slack-assigned metadata, unforgeable in a body.
 *   G2a identity prefix  every message we emit opens with `<emoji> **<Name>**`. Narrower
 *                        than G2b and therefore usable where G2b is not: it means "one of
 *                        MY agents wrote this", not "some MCP app wrote this".
 *   G2b server suffix    heuristic only. The read surface exposes no app_id/bot_id, so
 *                        `*Sent using* <@…|…>` is ordinary body text anyone can type.
 *   G3  sigil            routing rule, not a guard.
 *
 * G1 is never overridden. A sigil overrides G2b only: Ralph legitimately quotes sigils
 * when answering questions about its own config, and an operator quoting Ralph back
 * with a real question must still be answered.
 */

/** Slack appends this to messages posted through an MCP app. Body text, so forgeable. */
export const SERVER_SUFFIX_RE = /\*Sent using\*\s+<@[A-Z0-9]+\|[^>]+>\s*$/;

export function hasServerSuffix(text: string): boolean {
  return SERVER_SUFFIX_RE.test(text.trim());
}

/**
 * The identity line every outbound message opens with. The renderers in tick.ts call this,
 * so the guard below and the thing it recognises cannot drift apart -- if someone changes
 * the house style, the guard changes with it.
 */
export function identityPrefix(agent: { emoji: string; name: string }): string {
  // Bold needs ** because the MCP converts standard markdown (C13): *x* renders italic.
  return `${agent.emoji} **${agent.name}**`;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * G2a -- does this text open with one of our agents' identity prefixes?
 *
 * Matching the READ-BACK form, not the sent form, is the whole difficulty. Measured (C13):
 * we send `🤖 **Ralph**` and Slack hands it back as `:robot_face: *Ralph*` -- the emoji is
 * shortcoded and `**` is collapsed to `*`. A guard written against the sent form would
 * never fire. So: accept the configured emoji OR any `:shortcode:` (which covers Slack
 * converting whatever emoji is configured), and one or two asterisks either side.
 *
 * The emoji is REQUIRED. Keying on a bold name alone would eat an operator message that
 * merely opens with `**Ralph**`; requiring the emoji keeps the signal specific to the
 * house format. Anchored at the start, so quoting Ralph back with `>` -- which is what
 * Slack's own quote button produces -- does not trip it.
 *
 * Honest limit: this is a LOOP guard, not authentication. It is body text, so anything
 * already able to post as the operator could forge it. What it does buy is the case G1
 * cannot cover -- a rebuilt or rolled-back ledger, or a DIFFERENT agent of ours writing
 * into a thread -- without G2b's false positives on the operator's own Claude-in-Slack
 * messages.
 */
export function agentPrefixMatch(
  text: string,
  agents: Record<string, { emoji: string; name: string }>,
): string | null {
  const head = text.trimStart();
  for (const [id, a] of Object.entries(agents)) {
    if (!a.name) continue;
    // Three alternatives, because the emoji survives the round trip in more than one form:
    // the configured literal, any `:shortcode:`, or a literal pictograph. Which one comes
    // back depends on whether the config holds `:robot_face:` or `🤖` and on what Slack
    // chooses to normalise, so accept all three rather than betting on one.
    const emoji = `(?:${escapeRe(a.emoji)}|:[a-z0-9_+-]+:|\\p{Extended_Pictographic}\\uFE0F?)`;
    const re = new RegExp(`^${emoji}\\s*\\*{1,2}${escapeRe(a.name)}\\*{1,2}`, "iu");
    if (re.test(head)) return id;
  }
  return null;
}

/**
 * Find a sigil outside quoted context. A sigil inside a blockquote or code fence is
 * being discussed, not invoked -- otherwise Ralph's own ack, which quotes the request,
 * would re-trigger him.
 */
export function findSigil(text: string, sigils: string[]): string | null {
  const lines = text.split("\n");
  let inFence = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (line.startsWith(">")) continue; // quoted
    for (const s of sigils) {
      if (line.toLowerCase().includes(s.toLowerCase())) return s;
    }
  }
  return null;
}

export interface GuardContext {
  config: CrewConfig;
  /** (channel, ts) pairs we have posted. G1's authority. */
  outboxHas: (channelId: string, ts: string) => boolean;
  nowMs: number;
  /**
   * True for a reply inside a thread Ralph created. Membership is the authorisation:
   * nobody re-types a sigil in a follow-up. G1 and G2b still apply.
   */
  inActiveThread?: boolean;
}

/**
 * The whole ingress decision, in evaluation order. Every refusal carries a rule id so
 * `crew explain` can answer "why didn't Ralph reply to that" without guesswork.
 */
export function decide(msg: InboundMessage, ctx: GuardContext): Decision {
  const { config } = ctx;
  const { ingress } = config.policy;

  // G1 -- primary, never overridden.
  if (ctx.outboxHas(msg.channelId, msg.ts)) {
    return { allow: false, ruleId: "G1_outbox", reason: "we posted this message" };
  }

  if (!ingress.channels.includes(msg.channelId)) {
    return { allow: false, ruleId: "ingress_channel", reason: `channel ${msg.channelId} not allowlisted` };
  }
  if (!ingress.authors.includes(msg.author)) {
    return { allow: false, ruleId: "ingress_author", reason: `author ${msg.author} not allowlisted` };
  }

  const ageMs = ctx.nowMs - Math.floor(Number(msg.ts) * 1000);
  if (!Number.isFinite(ageMs)) {
    return { allow: false, ruleId: "bad_ts", reason: `unparseable ts ${msg.ts}` };
  }
  /**
   * The age filter is a COLD-START guard: it stops Ralph answering days of backlog the
   * first time he runs. It is the wrong rule for a follow-up inside a thread he is
   * already having a conversation in, where freshness means "after my last reply", not
   * "within the last fifteen minutes". A question you asked two hours ago and never got
   * an answer to still deserves one. The thread-activity window bounds this instead.
   */
  if (!ctx.inActiveThread && ageMs > ingress.ignore_older_than_ms) {
    return { allow: false, ruleId: "too_old", reason: `message is ${Math.round(ageMs / 1000)}s old` };
  }

  const sigil = findSigil(msg.text, allSigils(config.agents));

  /**
   * G2a -- our own house format, and the one content check that DOES apply inside a thread.
   *
   * This is what closes the gap G2b leaves. Inside a thread we own, G2b is off (see below)
   * because it fires on the operator's own Claude-in-Slack replies, which left "an agent
   * wrote into Ralph's thread" treated as a follow-up. The identity prefix separates those
   * two cases cleanly: it marks OUR agents specifically, so it can stay on everywhere.
   *
   * ALL agents are checked, not just enabled ones -- a disabled agent's old output is still
   * ours and must not become input.
   *
   * Not overridable by a sigil, and that is deliberate: Ralph quotes sigils verbatim when
   * asked about his own config, so letting a sigil override this would reopen the loop for
   * exactly the message most likely to contain one.
   */
  const mine = agentPrefixMatch(msg.text, config.agents);
  if (mine) {
    return { allow: false, ruleId: "G2a_agent_prefix", reason: `opens with ${mine}'s identity prefix` };
  }

  /**
   * G2b -- heuristic, and deliberately NOT applied inside an active thread.
   *
   * The suffix marks "posted through an MCP app", not "posted by Ralph". The operator
   * hits it too whenever they answer from Claude-in-Slack rather than typing directly,
   * which measured at 88% of this DM's traffic. For a ROOT message that is the right
   * default: agent chatter should not wake Ralph. Inside a thread Ralph owns it is
   * wrong, because G1 (the outbox) already identifies his own posts authoritatively and
   * the suffix only adds false positives that silently eat follow-ups.
   *
   * A sigil overrides it either way. G1 is never overridden.
   */
  if (msg.hasServerSuffix && !sigil && !ctx.inActiveThread) {
    return { allow: false, ruleId: "G2b_server_suffix", reason: "agent-authored message with no sigil" };
  }

  if (ingress.require_sigil && !sigil && !ctx.inActiveThread) {
    return { allow: false, ruleId: "G3_no_sigil", reason: "no sigil outside quoted context" };
  }

  return { allow: true, sigil: sigil ?? "" };
}

/**
 * Which agent is this message addressed to?
 *
 * Only enabled agents are considered, which is what makes `crew agents disable` mean
 * something. Returns null when nothing matches, so `mention` mode stays quiet by default.
 */
export function routeToAgent(
  text: string,
  agents: Record<string, { enabled: boolean; sigils: string[] }>,
): { id: string; sigil: string } | null {
  for (const [id, a] of Object.entries(agents)) {
    if (!a.enabled) continue;
    const hit = findSigil(text, a.sigils);
    if (hit) return { id, sigil: hit };
  }
  return null;
}

/** Every sigil across enabled agents, for guard checks that predate routing. */
export function allSigils(agents: Record<string, { enabled: boolean; sigils: string[] }>): string[] {
  return Object.values(agents).flatMap((a) => (a.enabled ? a.sigils : []));
}

/** Strip sigils from text destined for an outbound message, so the ack cannot re-trigger. */
export function stripSigils(text: string, sigils: string[]): string {
  let out = text;
  for (const s of sigils) {
    out = out.replaceAll(new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "");
  }
  return out.replace(/\s{2,}/g, " ").trim();
}

import type { InboundMessage } from "./types.js";
import { hasServerSuffix } from "./guards.js";

/**
 * Slack access, via a short `claude -p` shelling out to the Slack MCP.
 *
 * Why not a direct MCP client: that needs its own OAuth registration against the
 * Runlayer proxy, which is designed but unexercised. This path works today with the
 * auth you already have. It costs a few cents per call rather than $0, which is why
 * the default tick interval is minutes rather than seconds.
 *
 * Three traps this file exists to encapsulate, all measured:
 *   - `--allowedTools` does NOT restrict; it only auto-approves. (C10)
 *   - `--tools` DOES restrict, but only over built-in tools -- naming an MCP tool there makes
 *     MCP unreachable, so this tool surface cannot be narrowed by flags at all.
 *   - variadic flags swallow a trailing prompt, so the prompt goes after `--`.
 */

const SLACK_READ = "mcp__claude_ai_Slack__slack_read_channel";
const SLACK_SEND = "mcp__claude_ai_Slack__slack_send_message";
const SLACK_REACT = "mcp__claude_ai_Slack__slack_add_reaction";
const SLACK_READ_THREAD = "mcp__claude_ai_Slack__slack_read_thread";

export interface ClaudeResult {
  ok: boolean;
  text: string;
  costUsd: number;
  isError: boolean;
  /** Needed to --resume, which is how a thread keeps its memory across turns. */
  sessionId?: string;
}

/** Run `claude -p`, returning the parsed result envelope. Gates on is_error, not subtype. */
export async function runClaude(args: string[], prompt: string, timeoutMs: number): Promise<ClaudeResult> {
  const proc = Bun.spawn(["claude", "-p", "--output-format", "json", ...args, "--", prompt], {
    // stdin MUST be closed. Left open, claude blocks 3s waiting for piped input and
    // emits a warning, which both slows every call and races the timeout.
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env },
  });

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    proc.kill();
  }, timeoutMs);

  const [out, err] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  await proc.exited;
  clearTimeout(timer);

  if (timedOut) {
    return { ok: false, text: `timed out after ${Math.round(timeoutMs / 1000)}s`, costUsd: 0, isError: true };
  }

  try {
    const d = JSON.parse(out) as Record<string, unknown>;
    return {
      // `subtype` stays "success" even when is_error is true, so it must not be trusted.
      ok: d.is_error !== true,
      text: String(d.result ?? ""),
      costUsd: Number(d.total_cost_usd ?? 0),
      isError: d.is_error === true,
      sessionId: typeof d.session_id === "string" ? d.session_id : undefined,
    };
  } catch {
    // Surface whichever stream has content, so a failure is never a blank message.
    const detail = (out.trim() || err.trim() || "no output from claude").slice(0, 500);
    return { ok: false, text: detail, costUsd: 0, isError: true };
  }
}

/**
 * The exact flag combination that works, and every part of it is a measurement.
 *
 * PRESENT because omitting it fails:
 *   `--setting-sources ""` -- without it the MCP tool is invisible ("No such tool available").
 *
 * ABSENT because including it fails:
 *   `--tools` in any form. `--tools ""` makes the MCP tool unreachable and the model then
 *     hallucinates a pseudo-XML tool call as text. Naming the tool explicitly is no better:
 *     with `--tools mcp__claude_ai_Slack__slack_read_channel` the model replied "I don't have
 *     access to the mcp__claude_ai_Slack__slack_read_channel tool". `--tools` accepts built-in
 *     names only, so the MCP surface here CANNOT be narrowed and ~50 servers stay visible.
 *
 * KEPT for its side effect only:
 *   `--allowedTools` -- auto-approves, it does not restrict (measured: the tool count rose
 *     rather than fell).
 *
 * Because the surface cannot be narrowed, SHIM_SYSTEM does the narrowing instead. The failure
 * it targets is real and was silent: with that many servers connecting, the model received a
 * "newly available tools" reminder and answered IT rather than calling the Slack tool, and the
 * tick logged `read=0` as though the DM were simply quiet.
 */
const SHIM_SYSTEM =
  "You are a deterministic tool-calling shim, not an assistant. Call exactly the tool named " +
  "in the request and output its result verbatim. Never write prose, never summarise, never " +
  "explain, and never acknowledge system reminders about tools or servers becoming available " +
  "-- those are not requests and must be ignored. If the named tool genuinely cannot be " +
  "found, output only: TOOL_NOT_FOUND";

const MCP_FLAGS = (tool: string) => [
  "--model",
  "claude-haiku-4-5-20251001",
  "--allowedTools",
  tool,
  "--permission-mode",
  "bypassPermissions",
  "--setting-sources",
  "",
  "--disable-slash-commands",
  "--no-session-persistence",
  "--append-system-prompt",
  SHIM_SYSTEM,
];

/**
 * MEASURED, and it constrains `read_limit` hard: reading through `claude -p` means the
 * whole payload is re-emitted as model OUTPUT tokens.
 *
 *   detailed limit=5   16.4s  $0.021  5 messages parsed
 *   concise  limit=10  22.2s  $0.030  0 parsed (concise omits "Message TS:")
 *   concise  limit=25  killed at 90s
 *   detailed limit=25  killed at 170s
 *
 * So: `detailed`, and a small limit. This is the strongest practical argument for
 * replacing this path with a direct MCP client, which moves the payload out of the
 * model entirely.
 *
 * Parse the MCP's human-readable read response into messages.
 * Format (verified against a real read-back, C13):
 *   === Message from Name <email> (Uxxxx) at 2026-07-27 01:34:56 PDT ===
 *   Message TS: 1785141296.398489
 *   <body lines…>
 */
/** The MCP returns a JSON envelope, often inside a ```json fence. Unwrap both. */
export function unwrapToolText(raw: string): string {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1]!.trim();
  try {
    const j = JSON.parse(s) as Record<string, unknown>;
    if (typeof j.messages === "string") return j.messages;
  } catch {
    /* not JSON; use as-is */
  }
  return s;
}

export function parseReadResponse(rawInput: string, channelId: string): InboundMessage[] {
  const raw = unwrapToolText(rawInput);
  const out: InboundMessage[] = [];
  const blocks = raw.split(/^=== Message from /m).slice(1);
  for (const block of blocks) {
    const author = block.match(/\((U[A-Z0-9]+)\)/)?.[1];
    const ts = block.match(/Message TS:\s*([0-9]+\.[0-9]+)/)?.[1];
    if (!author || !ts) continue;
    const bodyStart = block.indexOf("\n", block.indexOf("Message TS:"));
    let text = bodyStart >= 0 ? block.slice(bodyStart + 1) : "";
    // These trailers are envelope metadata, not message body. Leaving them in leaks
    // "pagination_info: There are no more messages available." into the request text.
    text = text
      .replace(/^Thread:.*$/gm, "")
      .replace(/^pagination_info:.*$/gm, "")
      // `Reactions: eyes (1)` is the envelope reporting OUR OWN 👀 back to us. Observed live
      // appended to a real message body, where it becomes part of the request the worker is
      // asked to answer -- and, since we react before working, it appears on exactly the
      // messages we are about to handle.
      .replace(/^Reactions:.*$/gm, "")
      .replace(/There are no more messages available\.?/g, "")
      .trim();
    out.push({ channelId, ts, author, text, hasServerSuffix: hasServerSuffix(text) });
  }
  // Oldest first, so the watermark advances monotonically.
  return out.sort((a, b) => Number(a.ts) - Number(b.ts));
}

export interface ReadResult {
  ok: boolean;
  messages: InboundMessage[];
  costUsd: number;
  /**
   * The page came back full, so there may be OLDER unread messages the read did not
   * return (results are newest-first). Advancing the watermark past them would lose
   * them silently, so the caller must surface this rather than swallow it.
   */
  pageFull?: boolean;
  /** Set when the read failed. Never conflate "no new messages" with "the read broke". */
  error?: string;
  /** True when auth is gone: halt, do not back off into silence. */
  authLost?: boolean;
}

/**
 * MCP tools are DEFERRED: their schemas load on demand via tool search. A small model
 * intermittently fails to do that lookup and then reports the tool "not available",
 * which is a transient resolution failure, not a real absence. Measured: the identical
 * invocation succeeded and failed on consecutive runs. So the prompt tells it to search
 * first, and a miss is retried once before being believed.
 */
export function toolMissing(text: string): boolean {
  // TOOL_NOT_FOUND is the sentinel the shim system prompt asks for, so the retry path
  // recognises a deliberate report as well as the model's own phrasings.
  return /TOOL_NOT_FOUND|don't have access to|not available|no such tool|not currently available/i.test(text);
}

/**
 * A response that carries no tool output at all. Distinct from "the tool ran and there
 * were no messages": a real empty read still echoes the envelope (`Channel:` /
 * `THREAD PARENT` / `no more messages`). A reply with none of that is the model having
 * talked about the call instead of making it.
 */
export function looksLikeNoToolOutput(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  const hasEnvelope = /Channel:|Message TS:|THREAD PARENT|no more messages|"messages"|"ok"\s*:/i.test(t);
  if (hasEnvelope) return false;
  /**
   * No envelope at all means no usable read happened, whatever the length.
   *
   * This used to also require `t.length < 400`, on the assumption that a reply which skipped
   * the tool would be short. Measured otherwise: under launchd the model answered a system
   * reminder instead of calling the tool --
   *
   *   "Understood. Additional tools from multiple MCP servers are now available, including
   *    DX_Gusto, Gcal_Gusto, Gdocs_Gusto, Gdrive_Gusto, Gmail_Gusto, Jira_Confluence, ..."
   *
   * -- which is long, so the read was NOT classified as retryable and the tick gave up after
   * one attempt, logging `read=0` as though the DM were simply quiet. Since every parser here
   * needs the envelope, its absence is sufficient evidence on its own; the length test only
   * added false negatives on the exact case that matters.
   */
  return true;
}

/**
 * Call a Slack MCP tool, retrying the failures that are known to be transient.
 *
 * Two flaky modes, both observed live and both silent:
 *   - the model reports the tool "not available" because it skipped the deferred-schema
 *     lookup. The identical invocation then succeeds.
 *   - the model answers ABOUT the call rather than making it, so the reply has no tool
 *     envelope. This is what made a real follow-up vanish for a tick: the read looked
 *     like "no new messages" when it was actually "no read happened".
 *
 * Retrying an idempotent READ is free of side effects. A SEND is not, so sends only retry
 * the not-available case, never the empty-output case: a retry there could double-post.
 */
async function callSlackTool(tool: string, instruction: string, opts?: { idempotent?: boolean }): Promise<ClaudeResult> {
  const prompt =
    `You MUST actually invoke the tool ${tool}. Its schema is deferred, so look it up first. ` +
    `${instruction} Then output the tool result VERBATIM: no commentary, no summary, no ` +
    `paraphrase, no description of what you did. If the call genuinely fails, output ` +
    `exactly: ERROR: <message>`;

  const attempts = opts?.idempotent ? 3 : 2;
  let r = await runClaude(MCP_FLAGS(tool), prompt, 180_000);
  for (let i = 1; i < attempts; i++) {
    const retryable = toolMissing(r.text) || (opts?.idempotent === true && looksLikeNoToolOutput(r.text));
    if (!r.ok || !retryable) break;
    r = await runClaude(MCP_FLAGS(tool), prompt, 180_000);
  }
  return r;
}

export async function readChannel(
  channelId: string,
  oldest: string | null,
  limit: number,
  latest?: string,
): Promise<ReadResult> {
  const oldestClause = oldest ? `, oldest="${oldest}"` : "";
  const latestClause = latest ? `, latest="${latest}"` : "";
  const r = await callSlackTool(
    SLACK_READ,
    `Call it with channel_id="${channelId}"${oldestClause}${latestClause}, limit=${limit}, response_format="detailed".`,
    { idempotent: true },
  );

  if (!r.ok) {
    const authLost = /not logged in|please run \/login/i.test(r.text);
    return { ok: false, messages: [], costUsd: r.costUsd, error: r.text.slice(0, 300), authLost };
  }
  if (/^ERROR:/m.test(r.text) || toolMissing(r.text) || looksLikeNoToolOutput(r.text)) {
    // NOT an empty channel. Conflating the two is what let a follow-up disappear.
    return { ok: false, messages: [], costUsd: r.costUsd, error: `no tool output: ${r.text.slice(0, 200)}` };
  }
  const messages = parseReadResponse(r.text, channelId);
  return { ok: true, messages, costUsd: r.costUsd, pageFull: messages.length >= limit };
}

export interface SendResult {
  ok: boolean;
  ts?: string;
  costUsd: number;
  error?: string;
}

/** Extract the ts from the send response. Verified (C13): returns message_context.message_ts. */
export function parseSendResponse(raw: string): string | null {
  const direct = raw.match(/"message_ts"\s*:\s*"([0-9]+\.[0-9]+)"/);
  if (direct) return direct[1]!;
  // Fallback: a permalink of the form …/p1785141296398489
  const link = raw.match(/\/p(\d{10})(\d{6})/);
  return link ? `${link[1]}.${link[2]}` : null;
}

export async function sendMessage(channelId: string, text: string, threadTs?: string): Promise<SendResult> {
  const thread = threadTs ? `, thread_ts="${threadTs}"` : "";
  const encoded = JSON.stringify(text);
  const r = await callSlackTool(
    SLACK_SEND,
    `Call it with channel_id="${channelId}"${thread} and message set to this exact JSON string ` +
      `value (decode it, do not alter the text): ${encoded}.`,
  );
  if (!r.ok || toolMissing(r.text)) return { ok: false, costUsd: r.costUsd, error: r.text.slice(0, 300) };

  const ts = parseSendResponse(r.text);
  if (!ts) {
    // A send with no ts is dangerous: the outbox cannot record it, so G1 will not
    // recognise our own post next tick. Surface it rather than continuing.
    return { ok: false, costUsd: r.costUsd, error: `send returned no ts: ${r.text.slice(0, 200)}` };
  }
  return { ok: true, ts, costUsd: r.costUsd };
}


/**
 * Add a reaction to a message. Best-effort: a failed reaction must never stop the
 * actual work, and reactions cannot be removed (C3), so they only ever accumulate.
 */
export async function addReaction(channelId: string, ts: string, emoji: string): Promise<{ ok: boolean; costUsd: number }> {
  const r = await callSlackTool(
    SLACK_REACT,
    `Call it with channel_id="${channelId}", timestamp="${ts}", emoji_name="${emoji}".`,
  );
  return { ok: r.ok && !/^ERROR:/m.test(r.text) && !toolMissing(r.text), costUsd: r.costUsd };
}


/**
 * Read a thread. This exists because `slack_read_channel` does NOT return thread
 * replies, so without it every follow-up to Ralph's own answer is invisible and the
 * conversation dies after one turn. That is not a theoretical gap: it happened.
 *
 * The parent message is skipped -- the channel poll already handled it.
 */
export async function readThread(
  channelId: string,
  parentTs: string,
  oldest: string | null,
  limit: number,
): Promise<ReadResult> {
  const oldestClause = oldest ? `, oldest="${oldest}"` : "";
  const r = await callSlackTool(
    SLACK_READ_THREAD,
    `Call it with channel_id="${channelId}", message_ts="${parentTs}"${oldestClause}, ` +
      `limit=${limit}, response_format="detailed".`,
    { idempotent: true },
  );
  if (!r.ok) {
    const authLost = /not logged in|please run \/login/i.test(r.text);
    return { ok: false, messages: [], costUsd: r.costUsd, error: r.text.slice(0, 300), authLost };
  }
  if (/^ERROR:/m.test(r.text) || toolMissing(r.text) || looksLikeNoToolOutput(r.text)) {
    return { ok: false, messages: [], costUsd: r.costUsd, error: `no tool output: ${r.text.slice(0, 200)}` };
  }
  const all = parseThreadResponse(unwrapToolText(r.text), channelId);
  // Drop the parent: the channel poll owns it.
  const replies = all.filter((m) => m.ts !== parentTs);
  return { ok: true, messages: replies, costUsd: r.costUsd, pageFull: all.length >= limit };
}

/** Thread responses use a different layout from channel reads: `From:` / `Message TS:` blocks. */
export function parseThreadResponse(raw: string, channelId: string): InboundMessage[] {
  const out: InboundMessage[] = [];
  const blocks = raw.split(/^(?:--- Reply \d+ of \d+ ---|=== THREAD PARENT MESSAGE ===)$/m);
  for (const block of blocks) {
    const author = block.match(/\((U[A-Z0-9]+)\)/)?.[1];
    const ts = block.match(/Message TS:\s*([0-9]+\.[0-9]+)/)?.[1];
    if (!author || !ts) continue;
    const start = block.indexOf("\n", block.indexOf("Message TS:"));
    let text = start >= 0 ? block.slice(start + 1) : "";
    text = text
      .replace(/^Reactions:.*$/gm, "")
      .replace(/^=== THREAD REPLIES.*$/gm, "")
      .replace(/^pagination_info:.*$/gm, "")
      .replace(/There are no more messages in this thread\.?/g, "")
      .trim();
    out.push({ channelId, ts, author, text, hasServerSuffix: hasServerSuffix(text) });
  }
  return out.sort((a, b) => Number(a.ts) - Number(b.ts));
}


/** Remove Slack's appended attribution from text we are about to quote or reason over. */
export function stripServerSuffix(text: string): string {
  return text.replace(SERVER_SUFFIX_RE_G, "").trim();
}
export const SERVER_SUFFIX_RE_G = /\*Sent using\*\s+<@[A-Z0-9]+\|[^>]+>/g;

/**
 * Recover the ts of a message we just sent but could not parse a ts for.
 *
 * The send itself is reliable; the ts is not, because it comes back through a model that
 * sometimes summarises instead of echoing. An unrecorded post is a correctness problem,
 * not cosmetic: G1 is the primary loop guard and it keys on the outbox, so a post we
 * cannot record can be re-read as input on the next tick.
 */
export async function recoverSentTs(
  channelId: string,
  threadTs: string | undefined,
  payloadFragment: string,
  known: (ts: string) => boolean,
): Promise<string | null> {
  const res = threadTs
    ? await readThread(channelId, threadTs, null, 5)
    : await readChannel(channelId, null, 5);
  if (!res.ok) return null;
  const needle = payloadFragment.slice(0, 40);
  const match = res.messages
    .filter((m) => !known(m.ts) && m.hasServerSuffix && m.text.includes(needle))
    .sort((a, b) => Number(b.ts) - Number(a.ts))[0];
  return match?.ts ?? null;
}


/**
 * Read every message since the watermark, not just the newest page of them.
 *
 * Results come back NEWEST-first and capped at `limit`, so a single read during a burst
 * returns the newest N and silently hides everything older. Advancing the watermark past
 * that page loses those messages permanently -- the request you actually cared about can
 * be the one that vanishes.
 *
 * So walk backwards: take a page, and while it comes back full, ask again for messages
 * older than the oldest one seen (`latest`) but still newer than the watermark. Bounded
 * by `maxPages`, because each page is a real API call and a real cost.
 */
export async function readChannelPaged(
  channelId: string,
  oldest: string | null,
  limit: number,
  maxPages: number,
): Promise<ReadResult & { truncated?: boolean }> {
  const seen = new Map<string, InboundMessage>();
  let costUsd = 0;
  let latest: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const res = await readChannel(channelId, oldest, limit, latest);
    costUsd += res.costUsd;
    if (!res.ok) {
      // Partial success still matters: return what we have plus the error, so the caller
      // can process the known-good messages without advancing past the unknown ones.
      return { ok: false, messages: sortByTs(seen), costUsd, error: res.error, authLost: res.authLost };
    }
    for (const m of res.messages) seen.set(m.ts, m);

    if (res.messages.length < limit) {
      return { ok: true, messages: sortByTs(seen), costUsd };
    }
    // Full page: there may be older unread messages. Walk back from the oldest we saw.
    const oldestTs = res.messages.reduce((a, b) => (Number(a.ts) < Number(b.ts) ? a : b)).ts;
    if (latest === oldestTs) break; // no progress; stop rather than loop
    latest = oldestTs;
  }

  // Hit the page cap with pages still coming back full: there is more history than we are
  // willing to fetch in one tick. Say so; the caller must not advance past what it has.
  return { ok: true, messages: sortByTs(seen), costUsd, truncated: true };
}

function sortByTs(m: Map<string, InboundMessage>): InboundMessage[] {
  return [...m.values()].sort((a, b) => Number(a.ts) - Number(b.ts));
}

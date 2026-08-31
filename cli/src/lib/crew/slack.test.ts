import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  interpretToolResult,
  looksLikeNoToolOutput,
  parseReadResponse,
  parseSendResponse,
  parseThreadResponse,
  runClaudeStreaming,
  toolMissing,
  unwrapToolText,
} from "./slack.js";
import type { ClaudeResult } from "./slack.js";

function claudeResult(over: Partial<ClaudeResult> = {}): ClaudeResult {
  return { ok: true, text: "", costUsd: 0, isError: false, ...over };
}

/**
 * Fixtures here are VERBATIM recorded round trips (C13), never hand-written.
 * A spec-derived fixture tests the spec against itself, which is how an earlier
 * design shipped a guard that could never fire.
 */

const REAL_READ = `Channel: DM (D0TESTDM001)

=== Message from Test Operator <operator@example.com> (U0TESTUSER1) at 2026-07-27 01:34:56 PDT ===
Message TS: 1785141296.398489
:robot_face: _Ralph_ · crew design self-test \`ral-selftest-7f3a9c\`

Backticked URL: \`https://github.com/gusto/jstack.core\`
Bare URL: <https://github.com/gusto/jstack.core|github.com/gusto/jstack.core>
*Sent using* <@U0APPID0001|Slack MCP>
Thread: 1 replies (latest: 2026-07-27 01:37:55 PDT)`;

const REAL_SEND = `{"message_link":"https://gustohq.slack.com/archives/D0TESTDM001/p1785141296398489","message_context":{"message_ts":"1785141296.398489","channel_id":"D0TESTDM001"}}`;

describe("parseReadResponse against the real recorded read-back", () => {
  const msgs = parseReadResponse(REAL_READ, "D0TESTDM001");

  test("extracts one message", () => {
    expect(msgs).toHaveLength(1);
  });

  test("extracts author and ts", () => {
    expect(msgs[0]!.author).toBe("U0TESTUSER1");
    expect(msgs[0]!.ts).toBe("1785141296.398489");
  });

  test("detects the server suffix on real data -- the guard fires", () => {
    expect(msgs[0]!.hasServerSuffix).toBe(true);
  });

  test("strips the Thread: trailer, which is metadata not body", () => {
    expect(msgs[0]!.text).not.toContain("Thread: 1 replies");
  });

  test("keeps the body", () => {
    expect(msgs[0]!.text).toContain("crew design self-test");
  });
});

describe("parseReadResponse ordering and edge cases", () => {
  test("returns oldest first, so the watermark advances monotonically", () => {
    const two = `=== Message from A (U0AAAAAAAAA) at x ===
Message TS: 200.000002
second

=== Message from B (U0BBBBBBBBB) at x ===
Message TS: 100.000001
first`;
    const m = parseReadResponse(two, "D0TESTDM001");
    expect(m.map((x) => x.ts)).toEqual(["100.000001", "200.000002"]);
  });

  test("an empty response yields no messages rather than throwing", () => {
    expect(
      parseReadResponse(
        "Channel: DM (D0TESTDM001)\n\nno messages",
        "D0TESTDM001",
      ),
    ).toHaveLength(0);
  });

  test("a block missing a ts is skipped, not emitted with a bad ts", () => {
    const bad = `=== Message from A (U0AAAAAAAAA) at x ===\nno timestamp here`;
    expect(parseReadResponse(bad, "D0TESTDM001")).toHaveLength(0);
  });
});

describe("parseSendResponse against the real recorded send", () => {
  test("prefers message_ts, so no p<17-digit> conversion is needed", () => {
    expect(parseSendResponse(REAL_SEND)).toBe("1785141296.398489");
  });

  test("falls back to converting a permalink if message_ts is ever absent", () => {
    const linkOnly = `{"message_link":"https://x.slack.com/archives/D0TESTDM001/p1785141296398489"}`;
    expect(parseSendResponse(linkOnly)).toBe("1785141296.398489");
  });

  test("returns null when there is no ts at all, so the caller can refuse to continue", () => {
    expect(parseSendResponse(`{"ok":true}`)).toBeNull();
  });
});

describe("unwrapToolText handles the real envelope shapes", () => {
  test("unwraps a fenced JSON envelope with escaped newlines", () => {
    const wrapped =
      '```json\n{"messages":"Channel: DM (D0TESTDM001)\\n\\n=== Message from A (U0AAAAAAAAA) at x ===\\nMessage TS: 1.1\\nhi"}\n```';
    const msgs = parseReadResponse(wrapped, "D0TESTDM001");
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.ts).toBe("1.1");
  });

  test("unwraps bare JSON with no fence", () => {
    expect(unwrapToolText('{"messages":"hello"}')).toBe("hello");
  });

  test("passes plain text through unchanged", () => {
    expect(unwrapToolText("=== Message from A ===")).toBe(
      "=== Message from A ===",
    );
  });
});

describe("empty-output detection: 'no read happened' is not 'no new messages'", () => {
  // Conflating these made a real follow-up vanish for a tick.
  const real = `Channel: DM (D0TESTDM001)

=== Message from A (U0AAAAAAAAA) at x ===
Message TS: 1.1
hi`;

  test("a genuine empty channel still carries an envelope, so it is NOT flagged", () => {
    const emptyButReal =
      "Channel: DM (D0TESTDM001)\n\nThere are no more messages available.";
    expect(parseReadResponse(emptyButReal, "D0TESTDM001")).toHaveLength(0);
    // The envelope is present, so readChannel treats this as a valid empty read.
    expect(/Channel:|no more messages/i.test(emptyButReal)).toBe(true);
  });

  test("a real read parses", () => {
    expect(parseReadResponse(real, "D0TESTDM001")).toHaveLength(1);
  });

  test("model prose with no envelope parses to nothing, which the caller must treat as an error", () => {
    const prose = "I don't have access to that tool in this conversation.";
    expect(parseReadResponse(prose, "D0TESTDM001")).toHaveLength(0);
    expect(/Channel:|Message TS:|no more messages/i.test(prose)).toBe(false);
  });

  test("a hallucinated pseudo-XML invocation parses to nothing", () => {
    const fake =
      "<mcp__claude_ai_Slack__slack_read_channel>\n  <channel_id>D0TESTDM001</channel_id>\n</mcp__claude_ai_Slack__slack_read_channel>";
    expect(parseReadResponse(fake, "D0TESTDM001")).toHaveLength(0);
    expect(/^<mcp__/m.test(fake)).toBe(true);
  });
});

describe("a read that did not happen must be retryable, whatever its length", () => {
  /**
   * Verbatim from a real launchd tick. The model answered a "newly available tools" reminder
   * instead of calling the Slack tool. It is long, so the old `length < 400` heuristic classed
   * it as a genuine read and the tick reported `read=0` -- indistinguishable from a quiet DM.
   */
  const REAL_FAILURE =
    "Understood. Additional tools from multiple MCP servers are now available, including " +
    "DX_Gusto, Gcal_Gusto, Gdocs_Gusto, Gdrive_Gusto, Gmail_Gusto, Jira_Confluence, " +
    "Notion_Gusto, PagerDuty_Gusto, and Switchboard_Gusto. I am ready to assist with any " +
    "tasks you have in mind, and can use these integrations to look things up, create " +
    "documents, check calendars, search email, manage tickets, or query dashboards as needed. " +
    "Just let me know what you would like me to do next and I will pick the right tool.";

  test("the real failure is over the old length threshold", () => {
    expect(REAL_FAILURE.length).toBeGreaterThan(400);
  });

  test("it is now detected as no-tool-output", () => {
    expect(looksLikeNoToolOutput(REAL_FAILURE)).toBe(true);
  });

  test("a genuine empty read is NOT treated as a failure, so we do not retry forever", () => {
    expect(
      looksLikeNoToolOutput("Channel: D0TESTDM001\nno more messages"),
    ).toBe(false);
    expect(looksLikeNoToolOutput('{"messages": []}')).toBe(false);
    expect(looksLikeNoToolOutput("Message TS: 1785141296.398489\nhello")).toBe(
      false,
    );
  });

  test("the shim's TOOL_NOT_FOUND sentinel is recognised as a missing tool", () => {
    expect(toolMissing("TOOL_NOT_FOUND")).toBe(true);
    expect(toolMissing("Channel: D123\nall good")).toBe(false);
  });
});

describe("envelope metadata must not leak into the message body", () => {
  /**
   * Verbatim shape from a live read. The reaction line is the envelope echoing OUR OWN eyes
   * marker back, and it lands on precisely the messages we are about to handle -- so without
   * stripping it, it becomes part of the request text the worker answers.
   */
  const raw = [
    "=== Message from Jonathan <j@x.com> (U0TESTUSER1) at 2026-07-27 01:34:56 PDT ===",
    "Message TS: 1785141296.398489",
    "!ralph are you there?",
    "Reactions: eyes (1)",
    "pagination_info: There are no more messages available.",
  ].join("\n");

  test("the body is the message alone", () => {
    const [m] = parseReadResponse(raw, "D0TESTDM001");
    expect(m!.text).toBe("!ralph are you there?");
  });

  test("a body line that merely mentions reactions is preserved", () => {
    const kept = raw.replace(
      "Reactions: eyes (1)",
      "which Reactions: do you support?",
    );
    const [m] = parseReadResponse(kept, "D0TESTDM001");
    expect(m!.text).toContain("which Reactions: do you support?");
  });
});

/**
 * `interpretToolResult` is the failure-classification logic shared by `readChannel` and
 * `readThread` -- previously two byte-identical inline copies with no direct test coverage
 * (both call `runClaude`, which shells to the real `claude` binary, so neither function itself
 * is unit-testable). Extracting it into a pure function makes it directly testable for the
 * first time.
 */
describe("interpretToolResult", () => {
  test("a failed call with the auth-lost phrasing is classified as authLost", () => {
    const r = interpretToolResult(
      claudeResult({ ok: false, text: "Error: not logged in to Slack" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.authLost).toBe(true);
  });

  test("a failed call without the auth-lost phrasing is not classified as authLost", () => {
    const r = interpretToolResult(
      claudeResult({ ok: false, text: "Error: timeout" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.authLost).toBe(false);
  });

  test("an ok call with no tool envelope is treated as unusable, not an empty read", () => {
    const r = interpretToolResult(
      claudeResult({ ok: true, text: "Sure, I'll check that for you." }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("no tool output");
  });

  test("an ok call with a real tool envelope is usable", () => {
    const r = interpretToolResult(
      claudeResult({ ok: true, text: "Channel: DM" }),
    );
    expect(r.ok).toBe(true);
  });
});

/**
 * `parseThreadResponse` previously had zero direct test coverage (only exercised indirectly
 * through `readThread`, which nothing here calls). Unlike the channel-read fixtures above,
 * there is no verbatim recorded thread round-trip on hand, so these are constructed from the
 * exact block markers `parseThreadResponse`'s own regexes match (`=== THREAD PARENT MESSAGE ===`,
 * `--- Reply N of M ---`) -- shaped to spec, not recorded, and labeled as such per this file's
 * own C13 convention.
 */
describe("parseThreadResponse — constructed thread-shaped input", () => {
  const raw = [
    "=== THREAD PARENT MESSAGE ===",
    "From: Test Operator (U0TESTUSER1)",
    "Message TS: 1785141296.398489",
    "!ralph kick off the deploy",
    "",
    "--- Reply 1 of 2 ---",
    "From: Ralph (U0APPID0001)",
    "Message TS: 1785141300.000100",
    "On it.",
    "Reactions: eyes (1)",
    "",
    "--- Reply 2 of 2 ---",
    "From: Test Operator (U0TESTUSER1)",
    "Message TS: 1785141310.000200",
    "any update?",
    "pagination_info: There are no more messages in this thread.",
  ].join("\n");

  const msgs = parseThreadResponse(raw, "D0TESTDM001");

  test("extracts all three blocks (parent + 2 replies)", () => {
    expect(msgs).toHaveLength(3);
  });

  test("returns oldest first", () => {
    expect(msgs.map((m) => m.ts)).toEqual([
      "1785141296.398489",
      "1785141300.000100",
      "1785141310.000200",
    ]);
  });

  test("strips the Reactions: trailer from a reply body", () => {
    const reply1 = msgs.find((m) => m.ts === "1785141300.000100");
    expect(reply1!.text).toBe("On it.");
  });

  test("strips the thread pagination_info trailer", () => {
    const reply2 = msgs.find((m) => m.ts === "1785141310.000200");
    expect(reply2!.text).toBe("any update?");
  });

  test("unwraps a JSON-wrapped thread response the same way parseReadResponse does", () => {
    const wrapped = JSON.stringify({ messages: raw });
    const fromWrapped = parseThreadResponse(wrapped, "D0TESTDM001");
    expect(fromWrapped).toHaveLength(3);
  });
});

/**
 * Fixtures below are trimmed real recordings from a live `claude -p --output-format
 * stream-json --verbose` call (system/hook_* preamble lines dropped -- irrelevant noise
 * mapStreamJsonLine treats as `raw` anyway, and that preamble is where org/plugin-identifying
 * metadata lives, which has no business in this repo's fixtures). Confirmed live and load-
 * bearing: WITHOUT --include-partial-messages, only a complete "assistant" event carries text,
 * once -- WITH it, the same text also arrives as incremental stream_event/text_delta chunks
 * first, and naively accumulating every assistant_text event doubles it (measured: a two-
 * character reply came back "PONGPONG"). runClaudeStreaming deliberately omits that flag.
 */
const REAL_STREAM_TEXT_ONLY = `
{"type":"assistant","message":{"model":"claude-sonnet-5","id":"msg_011Cea6n26LmSL98APeSAE6z","type":"message","role":"assistant","content":[{"type":"text","text":"PONG"}],"stop_reason":null,"stop_sequence":null,"stop_details":null,"usage":{"input_tokens":2,"cache_creation_input_tokens":9438,"cache_read_input_tokens":20136,"cache_creation":{"ephemeral_5m_input_tokens":0,"ephemeral_1h_input_tokens":9438},"output_tokens":1,"service_tier":"standard","inference_geo":"global"},"diagnostics":null,"context_management":null},"parent_tool_use_id":null,"session_id":"2a9e7dea-d038-45cc-a8de-a5b6ed5e9af0","uuid":"59934219-fa27-4f03-a426-c9cae5575f12","timestamp":"2026-08-31T03:16:20.046Z","request_id":"req_011Cea6mzwtTyjhqwykHGZxV"}
{"type":"rate_limit_event","rate_limit_info":{"status":"allowed","resetsAt":1788220800,"rateLimitType":"overage","overageStatus":"allowed","overageResetsAt":1788220800,"isUsingOverage":false,"overageInUse":true},"uuid":"a4bea8be-9d8a-4bdd-94e4-6f3357a66d39","session_id":"2a9e7dea-d038-45cc-a8de-a5b6ed5e9af0"}
{"duration_api_ms":1447,"stop_reason":"end_turn","session_id":"2a9e7dea-d038-45cc-a8de-a5b6ed5e9af0","total_cost_usd":0.0418332,"usage":{"input_tokens":2,"cache_creation_input_tokens":9438,"cache_read_input_tokens":20136,"output_tokens":5,"output_tokens_details":{"thinking_tokens":0},"server_tool_use":{"web_search_requests":0,"web_fetch_requests":0},"service_tier":"standard","cache_creation":{"ephemeral_1h_input_tokens":9438,"ephemeral_5m_input_tokens":0},"inference_geo":"global","iterations":[{"input_tokens":2,"output_tokens":5,"cache_read_input_tokens":20136,"cache_creation_input_tokens":9438,"cache_creation":{"ephemeral_5m_input_tokens":0,"ephemeral_1h_input_tokens":9438},"type":"message"}],"speed":"standard"},"modelUsage":{"claude-sonnet-5":{"inputTokens":2,"outputTokens":5,"cacheReadInputTokens":20136,"cacheCreationInputTokens":9438,"webSearchRequests":0,"costUSD":0.0418332,"contextWindow":1000000,"maxOutputTokens":64000,"canonicalModel":"claude-sonnet-5","provider":"firstParty","costBasis":"list"}},"permission_denials":[],"terminal_reason":"completed","fast_mode_state":"off","fast_mode_disabled_reason":"sdk_opt_in_required","subagent_stats":{"spawned":0,"requested":{"background":0,"foreground":0,"unset":0},"started_in_background":0,"max_depth":0,"spawned_by_subagents":0,"completed":0,"failed":0,"killed":{"parent":0,"user":0,"system":0},"refused":{"depth_limit":0,"concurrency_limit":0,"budget":0},"by_type":{}},"is_error":false,"num_turns":1,"subtype":"success","api_error_status":null,"result":"PONG","ttft_ms":1858,"type":"result","duration_ms":2558,"uuid":"03509eb9-dde3-40dd-b853-7df22d94c4c1","ttft_stream_ms":1779,"time_to_request_ms":426,"queued_turn_count":0}`.trim();

const REAL_STREAM_WITH_TOOL_USE = `
{"type":"assistant","message":{"model":"claude-sonnet-5","id":"msg_011Cea6ns59DY7KUt5jjesJN","type":"message","role":"assistant","content":[{"type":"text","text":"I'll read that file now."}],"stop_reason":null,"stop_sequence":null,"stop_details":null,"usage":{"input_tokens":2,"cache_creation_input_tokens":6288,"cache_read_input_tokens":5611,"cache_creation":{"ephemeral_5m_input_tokens":0,"ephemeral_1h_input_tokens":6288},"output_tokens":3,"service_tier":"standard","inference_geo":"global"},"diagnostics":null,"context_management":null},"parent_tool_use_id":null,"session_id":"6f59f83c-144a-4b8d-a3ca-548e83fe507f","uuid":"c5c54f34-e1a9-44a0-ab78-9f30b95d0303","timestamp":"2026-08-31T03:16:32.021Z","request_id":"req_011Cea6nr7r9nsQo87KJtcng"}
{"type":"assistant","message":{"model":"claude-sonnet-5","id":"msg_011Cea6ns59DY7KUt5jjesJN","type":"message","role":"assistant","content":[{"type":"tool_use","id":"toolu_01XtZcoFyRHuPt5vneHqAXcr","name":"Read","input":{"file_path":"/tmp/jd-tool-test.txt"},"caller":{"type":"direct"}}],"stop_reason":null,"stop_sequence":null,"stop_details":null,"usage":{"input_tokens":2,"cache_creation_input_tokens":6288,"cache_read_input_tokens":5611,"cache_creation":{"ephemeral_5m_input_tokens":0,"ephemeral_1h_input_tokens":6288},"output_tokens":3,"service_tier":"standard","inference_geo":"global"},"diagnostics":null,"context_management":null},"parent_tool_use_id":null,"session_id":"6f59f83c-144a-4b8d-a3ca-548e83fe507f","uuid":"fb28395e-7075-4985-ab68-67181912f0b9","timestamp":"2026-08-31T03:16:32.034Z","request_id":"req_011Cea6nr7r9nsQo87KJtcng"}
{"type":"user","message":{"role":"user","content":[{"tool_use_id":"toolu_01XtZcoFyRHuPt5vneHqAXcr","type":"tool_result","content":"1\\thello world content\\n2\\t"}]},"parent_tool_use_id":null,"session_id":"6f59f83c-144a-4b8d-a3ca-548e83fe507f","uuid":"31726a49-7163-4243-b7c5-f8ec2ac6383a","timestamp":"2026-08-31T03:16:32.047Z","tool_use_result":{"type":"text","file":{"filePath":"/tmp/jd-tool-test.txt","content":"hello world content\\n","numLines":2,"startLine":1,"totalLines":2}}}
{"type":"rate_limit_event","rate_limit_info":{"status":"allowed","resetsAt":1788220800,"rateLimitType":"overage","overageStatus":"allowed","overageResetsAt":1788220800,"isUsingOverage":false,"overageInUse":true},"uuid":"cc273cd9-77f4-45b3-bd55-44a3c29ae056","session_id":"6f59f83c-144a-4b8d-a3ca-548e83fe507f"}
{"type":"assistant","message":{"model":"claude-sonnet-5","id":"msg_011Cea6o1VQjbchTj7NjrUJA","type":"message","role":"assistant","content":[{"type":"text","text":"The file \`/tmp/jd-tool-test.txt\` contains: \`hello world content\`"}],"stop_reason":null,"stop_sequence":null,"stop_details":null,"usage":{"input_tokens":2,"cache_creation_input_tokens":125,"cache_read_input_tokens":11899,"cache_creation":{"ephemeral_5m_input_tokens":0,"ephemeral_1h_input_tokens":125},"output_tokens":1,"service_tier":"standard","inference_geo":"global"},"diagnostics":null,"context_management":null},"parent_tool_use_id":null,"session_id":"6f59f83c-144a-4b8d-a3ca-548e83fe507f","uuid":"3331c659-1a58-4078-b03e-c660878d4697","timestamp":"2026-08-31T03:16:33.878Z","request_id":"req_011Cea6nzQRW1fvnWbYKSpcB"}
{"duration_api_ms":3940,"stop_reason":"end_turn","session_id":"6f59f83c-144a-4b8d-a3ca-548e83fe507f","total_cost_usd":0.030172,"usage":{"input_tokens":4,"cache_creation_input_tokens":6413,"cache_read_input_tokens":17510,"output_tokens":101,"output_tokens_details":{"thinking_tokens":0},"server_tool_use":{"web_search_requests":0,"web_fetch_requests":0},"service_tier":"standard","cache_creation":{"ephemeral_1h_input_tokens":6413,"ephemeral_5m_input_tokens":0},"inference_geo":"global","iterations":[{"input_tokens":2,"output_tokens":30,"cache_read_input_tokens":11899,"cache_creation_input_tokens":125,"cache_creation":{"ephemeral_5m_input_tokens":0,"ephemeral_1h_input_tokens":125},"type":"message"}],"speed":"standard"},"modelUsage":{"claude-sonnet-5":{"inputTokens":4,"outputTokens":101,"cacheReadInputTokens":17510,"cacheCreationInputTokens":6413,"webSearchRequests":0,"costUSD":0.030172,"contextWindow":1000000,"maxOutputTokens":64000,"canonicalModel":"claude-sonnet-5","provider":"firstParty","costBasis":"list"}},"permission_denials":[],"terminal_reason":"completed","fast_mode_state":"off","fast_mode_disabled_reason":"sdk_opt_in_required","subagent_stats":{"spawned":0,"requested":{"background":0,"foreground":0,"unset":0},"started_in_background":0,"max_depth":0,"spawned_by_subagents":0,"completed":0,"failed":0,"killed":{"parent":0,"user":0,"system":0},"refused":{"depth_limit":0,"concurrency_limit":0,"budget":0},"by_type":{}},"is_error":false,"num_turns":2,"subtype":"success","api_error_status":null,"result":"The file \`/tmp/jd-tool-test.txt\` contains: \`hello world content\`","ttft_ms":2332,"type":"result","duration_ms":5046,"uuid":"f58cce24-8cf3-410e-a94f-e8f3c68048fb","ttft_stream_ms":1810,"time_to_request_ms":416,"queued_turn_count":0}`.trim();

function installFakeStreamingClaude(fixture: string): { restorePath: string } {
  const dir = mkdtempSync(join(tmpdir(), "fake-claude-streaming-"));
  writeFileSync(
    join(dir, "claude"),
    `#!/bin/sh\ncat <<'FIXTURE_EOF'\n${fixture}\nFIXTURE_EOF\n`,
  );
  chmodSync(join(dir, "claude"), 0o755);
  const restorePath = process.env.PATH ?? "";
  process.env.PATH = `${dir}:${restorePath}`;
  return { restorePath };
}

describe("runClaudeStreaming", () => {
  let restorePath: string | undefined;

  afterEach(() => {
    if (restorePath !== undefined) process.env.PATH = restorePath;
  });

  test("a real text-only stream maps to the final text, cost, and session id", async () => {
    restorePath = installFakeStreamingClaude(REAL_STREAM_TEXT_ONLY).restorePath;
    const result = await runClaudeStreaming(
      [],
      "Reply with exactly: PONG",
      5000,
    );
    expect(result.ok).toBe(true);
    expect(result.isError).toBe(false);
    expect(result.text).toBe("PONG");
    expect(result.costUsd).toBeCloseTo(0.0418332, 6);
    expect(result.sessionId).toBe("2a9e7dea-d038-45cc-a8de-a5b6ed5e9af0");
    expect(result.toolEvents).toEqual([]);
  });

  test("a real stream with a tool call surfaces the tool event and the final text (not doubled)", async () => {
    restorePath = installFakeStreamingClaude(
      REAL_STREAM_WITH_TOOL_USE,
    ).restorePath;
    const result = await runClaudeStreaming([], "read the file", 5000);
    expect(result.ok).toBe(true);
    expect(result.text).toBe(
      "The file \`/tmp/jd-tool-test.txt\` contains: \`hello world content\`",
    );
    expect(result.toolEvents).toEqual([
      { name: "Read", input: { file_path: "/tmp/jd-tool-test.txt" } },
    ]);
    expect(result.costUsd).toBeCloseTo(0.030172, 6);
  });

  test("a spawn failure reports as an error result, not a throw", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fake-claude-missing-"));
    const previousPath = process.env.PATH ?? "";
    process.env.PATH = dir;
    try {
      const result = await runClaudeStreaming([], "hi", 2000);
      expect(result.ok).toBe(false);
      expect(result.isError).toBe(true);
    } finally {
      process.env.PATH = previousPath;
    }
  });
});

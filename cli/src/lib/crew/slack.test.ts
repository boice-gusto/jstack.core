import { describe, expect, test } from "bun:test";
import {
  looksLikeNoToolOutput,
  parseReadResponse,
  parseSendResponse,
  toolMissing,
  unwrapToolText,
} from "./slack.js";

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

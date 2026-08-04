import { describe, expect, test } from "bun:test";
import { RECALL_RE, findRecallRef, stripRecallRef, taskId } from "./tick.js";

/**
 * Recall turns the handle already printed in every reply into something the operator can type.
 * These tests pin the two properties that make it safe: it must not fire on a QUOTED handle
 * (every reply carries its own, and quoting a reply is the common way to follow up), and the
 * handle must name the agent that owns it.
 */

describe("task handles name their owner", () => {
  test("the prefix comes from the agent id, not a hardcoded string", () => {
    expect(taskId("ralph")).toMatch(/^ral-[a-z0-9]{4}$/);
    expect(taskId("scout")).toMatch(/^sco-[a-z0-9]{4}$/);
    expect(taskId("docs")).toMatch(/^doc-[a-z0-9]{4}$/);
  });

  test("the real ledger's bug is fixed: scout no longer gets a 'ral-' handle", () => {
    // Measured before the fix: scout's tasks were ral-qatq and ral-oiu4.
    expect(taskId("scout").startsWith("ral-")).toBe(false);
  });

  test("a junk or empty agent id still yields a usable handle", () => {
    expect(taskId("")).toMatch(/^tsk-[a-z0-9]{4}$/);
    expect(taskId("!!")).toMatch(/^tsk-[a-z0-9]{4}$/);
  });

  test("handles a real handle round-trips through the matcher", () => {
    const id = taskId("ralph");
    expect(findRecallRef(`#${id} carry on`)).toBe(id);
  });
});

describe("finding a recall reference", () => {
  test("plain reference matches, case-insensitively", () => {
    expect(findRecallRef("!ralph #ral-qatq keep going")).toBe("ral-qatq");
    expect(findRecallRef("!ralph #RAL-QATQ keep going")).toBe("ral-qatq");
  });

  test("a QUOTED handle is not a recall -- this is the footer-quoting case", () => {
    // Slack's quote button reproduces the whole reply, footer handle included.
    expect(
      findRecallRef(
        "> :robot_face: *Ralph*\n> answer\n> `ral-qatq` · $0.084\n\nwhy?",
      ),
    ).toBeNull();
  });

  test("a fenced handle is not a recall", () => {
    expect(findRecallRef("```\n#ral-qatq\n```")).toBeNull();
  });

  test("no reference returns null rather than a wrong guess", () => {
    expect(findRecallRef("!ralph what changed?")).toBeNull();
    expect(findRecallRef("issue #1234 is unrelated")).toBeNull();
    expect(findRecallRef("colour #ff00aa is not a handle")).toBeNull();
  });

  test("the first unquoted reference wins when several are present", () => {
    expect(findRecallRef("#ral-aaaa then #ral-bbbb")).toBe("ral-aaaa");
  });
});

describe("stripping the marker before the worker sees it", () => {
  test("the request keeps its meaning and loses the plumbing", () => {
    expect(stripRecallRef("#ral-qatq now do the gusto repo")).toBe(
      "now do the gusto repo",
    );
    expect(stripRecallRef("do it #ral-qatq please")).toBe("do it please");
  });

  test("text with no marker is untouched", () => {
    expect(stripRecallRef("just a question")).toBe("just a question");
  });

  test("the regex is anchored on a word boundary, so it cannot eat adjacent text", () => {
    expect(RECALL_RE.test("#ral-qatqEXTRA")).toBe(false);
  });
});

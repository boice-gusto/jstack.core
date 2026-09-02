import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAgent, initDefaultWorkspace } from "./agent-config.js";

function mkFixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "jstack-agent-config-"));
  writeFileSync(
    join(root, "jstack.config.json"),
    JSON.stringify({
      crew: {
        enabled: true,
        mode: "dry_run",
        slack: { self_user_id: "U0TESTUSER1" },
        agents: {
          ralph: { name: "Ralph", sigils: ["!ralph"], workspace: root },
        },
        policy: {
          ingress: { channels: ["D0TESTDM001"], authors: ["U0TESTUSER1"] },
          egress: { channels: ["D0TESTDM001"] },
        },
      },
    }),
  );
  return root;
}

describe("createAgent", () => {
  const savedRoot = process.env.JSTACK_PROJECT_ROOT;
  let root: string;

  beforeEach(() => {
    root = mkFixtureRoot();
    process.env.JSTACK_PROJECT_ROOT = root;
  });

  afterEach(() => {
    if (savedRoot === undefined) delete process.env.JSTACK_PROJECT_ROOT;
    else process.env.JSTACK_PROJECT_ROOT = savedRoot;
  });

  test("writes a new agent, enabled by default, unlike the CLI's crew agents add", () => {
    createAgent({ id: "scout", name: "Scout", workspace: root });
    const raw = JSON.parse(
      readFileSync(join(root, "jstack.config.json"), "utf8"),
    );
    expect(raw.crew.agents.scout).toMatchObject({
      enabled: true,
      name: "Scout",
      sigils: ["!scout", "@agent-scout"],
      model: "claude-sonnet-5",
      tools: ["Read", "Grep", "Glob"],
      mcp: "none",
    });
  });

  test("persona, model, tools, and mcp all carry through", () => {
    createAgent({
      id: "glean-bot",
      name: "Glean Bot",
      workspace: root,
      persona: "You are terse and cite sources.",
      model: "claude-opus-5",
      tools: ["Read", "Grep"],
      mcp: "inherit",
    });
    const raw = JSON.parse(
      readFileSync(join(root, "jstack.config.json"), "utf8"),
    );
    expect(raw.crew.agents["glean-bot"]).toMatchObject({
      persona: "You are terse and cite sources.",
      model: "claude-opus-5",
      tools: ["Read", "Grep"],
      mcp: "inherit",
    });
  });

  test("rejects an id that isn't kebab-case", () => {
    expect(() =>
      createAgent({ id: "Not Valid!", name: "x", workspace: root }),
    ).toThrow(/kebab-case/);
  });

  test("rejects a duplicate id", () => {
    expect(() =>
      createAgent({ id: "ralph", name: "Ralph 2", workspace: root }),
    ).toThrow(/already exists/);
  });

  test("never writes a partial agent when a later validation step throws", () => {
    expect(() =>
      createAgent({ id: "ralph", name: "Ralph 2", workspace: root }),
    ).toThrow();
    const raw = JSON.parse(
      readFileSync(join(root, "jstack.config.json"), "utf8"),
    );
    // The original ralph entry (from the fixture) must be untouched, not overwritten mid-mutate.
    expect(raw.crew.agents.ralph.name).toBe("Ralph");
  });
});

describe("initDefaultWorkspace", () => {
  test("creates the directory, git-inits it, and writes a README naming the agent", () => {
    const workspace = join(
      mkdtempSync(join(tmpdir(), "jstack-default-ws-")),
      "scout",
    );
    initDefaultWorkspace(workspace, "Scout");
    expect(existsSync(join(workspace, ".git"))).toBe(true);
    const readme = readFileSync(join(workspace, "README.md"), "utf8");
    expect(readme).toContain("Scout's workspace");
  });

  test("is idempotent -- re-running against an already-initialized workspace doesn't error or clobber an edited README", () => {
    const workspace = mkdtempSync(join(tmpdir(), "jstack-default-ws-"));
    initDefaultWorkspace(workspace, "Scout");
    writeFileSync(join(workspace, "README.md"), "hand-edited notes");
    expect(() => initDefaultWorkspace(workspace, "Scout")).not.toThrow();
    expect(readFileSync(join(workspace, "README.md"), "utf8")).toBe(
      "hand-edited notes",
    );
  });
});

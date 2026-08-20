import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runAgentsEdit } from "./crew.js";

/**
 * `runAgentsEdit` writes through `mutateAgents`, which resolves the project root via
 * `findProjectRoot()`. Pinning `JSTACK_PROJECT_ROOT` at a temp dir containing a minimal
 * `jstack.config.json` is the same technique `config.test.ts` uses, and avoids having to
 * chdir the whole test process.
 */
function mkFixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "jstack-crew-agents-edit-"));
  writeFileSync(
    join(root, "jstack.config.json"),
    JSON.stringify({
      crew: {
        slack: { self_user_id: "U0TESTUSER1" },
        agents: {
          alpha: {
            name: "Alpha",
            sigils: ["!alpha"],
            workspace: "/tmp/ws-alpha",
          },
          beta: { name: "Beta", sigils: ["!beta"], workspace: "/tmp/ws-beta" },
        },
        policy: {
          ingress: { channels: ["D0000001"], authors: ["U0000001"] },
          egress: { channels: ["D0000001"] },
        },
      },
    }),
  );
  return root;
}

function readSigils(root: string, id: string): string[] {
  const raw = JSON.parse(
    readFileSync(join(root, "jstack.config.json"), "utf8"),
  );
  return raw.crew.agents[id].sigils;
}

describe("runAgentsEdit sigil collision", () => {
  const savedRoot = process.env.JSTACK_PROJECT_ROOT;
  let root: string;

  beforeEach(() => {
    root = mkFixtureRoot();
    process.env.JSTACK_PROJECT_ROOT = root;
    // Bun does not treat assigning `undefined` as clearing a previously-set exitCode
    // within one process, so reset to 0 (same convention as doctor.test.ts) rather
    // than relying on the initial "unset" state.
    process.exitCode = 0;
  });

  afterEach(() => {
    if (savedRoot === undefined) delete process.env.JSTACK_PROJECT_ROOT;
    else process.env.JSTACK_PROJECT_ROOT = savedRoot;
    process.exitCode = 0;
  });

  test("rejects a --sigil that already belongs to another agent, and does not write", () => {
    const origError = console.error;
    let logged = "";
    console.error = (...args: unknown[]) => {
      logged += args.map(String).join(" ");
    };
    try {
      runAgentsEdit("beta", { sigils: ["!alpha"] });
    } finally {
      console.error = origError;
    }
    expect(process.exitCode).toBe(1);
    expect(logged).toContain('sigil "!alpha" already belongs to "alpha"');
    // The rejected edit must never reach disk.
    expect(readSigils(root, "beta")).toEqual(["!beta"]);
  });

  test("editing an agent's own sigil back to itself is not a self-collision", () => {
    runAgentsEdit("alpha", { sigils: ["!alpha", "!alpha2"] });
    expect(process.exitCode).toBe(0);
    expect(readSigils(root, "alpha")).toEqual(["!alpha", "!alpha2"]);
  });
});

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  runAgentsAdd,
  runAgentsEdit,
  runAgentsListChecks,
  runAgentsRunCheck,
} from "./crew.js";

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

function readProactiveChecks(root: string, id: string): unknown {
  const raw = JSON.parse(
    readFileSync(join(root, "jstack.config.json"), "utf8"),
  );
  return raw.crew.agents[id].proactive_checks;
}

function captureError(fn: () => void): string {
  const orig = console.error;
  let logged = "";
  console.error = (...args: unknown[]) => {
    logged += args.map(String).join(" ");
  };
  try {
    fn();
  } finally {
    console.error = orig;
  }
  return logged;
}

describe("--proactive-check / --proactive-channel flags", () => {
  const savedRoot = process.env.JSTACK_PROJECT_ROOT;
  let root: string;

  beforeEach(() => {
    root = mkFixtureRoot();
    process.env.JSTACK_PROJECT_ROOT = root;
    process.exitCode = 0;
  });

  afterEach(() => {
    if (savedRoot === undefined) delete process.env.JSTACK_PROJECT_ROOT;
    else process.env.JSTACK_PROJECT_ROOT = savedRoot;
    process.exitCode = 0;
  });

  test("`agents add` with one --proactive-check writes a parsed, defaulted entry", () => {
    runAgentsAdd({
      id: "gamma",
      workspace: "/tmp/ws-gamma",
      proactiveCheck: [
        "morning-incidents:0 9 * * *:Check open incidents; report if urgent",
      ],
    });
    expect(process.exitCode).toBe(0);
    expect(readProactiveChecks(root, "gamma")).toEqual([
      {
        id: "morning-incidents",
        schedule: "0 9 * * *",
        prompt: "Check open incidents; report if urgent",
        require_explicit_finding: true,
      },
    ]);
  });

  test("`agents add` with no --proactive-check writes an empty list, not a missing key", () => {
    runAgentsAdd({ id: "delta", workspace: "/tmp/ws-delta" });
    expect(process.exitCode).toBe(0);
    expect(readProactiveChecks(root, "delta")).toEqual([]);
  });

  test("`agents add` rejects a malformed spec and writes nothing", () => {
    const logged = captureError(() =>
      runAgentsAdd({
        id: "epsilon",
        workspace: "/tmp/ws-epsilon",
        proactiveCheck: ["not-a-valid-spec"],
      }),
    );
    expect(process.exitCode).toBe(1);
    expect(logged).toContain("id:schedule:prompt");
    const raw = JSON.parse(
      readFileSync(join(root, "jstack.config.json"), "utf8"),
    );
    expect(raw.crew.agents.epsilon).toBeUndefined();
  });

  test("`agents add` rejects duplicate check ids across --proactive-check flags", () => {
    const logged = captureError(() =>
      runAgentsAdd({
        id: "zeta",
        workspace: "/tmp/ws-zeta",
        proactiveCheck: ["dup:0 9 * * *:first", "dup:0 10 * * *:second"],
      }),
    );
    expect(process.exitCode).toBe(1);
    expect(logged).toContain("duplicate --proactive-check id(s): dup");
  });

  test("`agents add` --proactive-channel overrides the channel on the matching check", () => {
    runAgentsAdd({
      id: "eta",
      workspace: "/tmp/ws-eta",
      proactiveCheck: ["incidents:0 9 * * *:Check incidents"],
      proactiveChannel: ["incidents=C0SHAREDCH1"],
    });
    expect(process.exitCode).toBe(0);
    expect(readProactiveChecks(root, "eta")).toEqual([
      {
        id: "incidents",
        schedule: "0 9 * * *",
        prompt: "Check incidents",
        channel: "C0SHAREDCH1",
        require_explicit_finding: true,
      },
    ]);
  });

  test("`agents add` --proactive-channel referring to an unknown check id is refused", () => {
    const logged = captureError(() =>
      runAgentsAdd({
        id: "theta",
        workspace: "/tmp/ws-theta",
        proactiveCheck: ["incidents:0 9 * * *:Check incidents"],
        proactiveChannel: ["typo-id=C0SHAREDCH1"],
      }),
    );
    expect(process.exitCode).toBe(1);
    expect(logged).toContain('unknown check id "typo-id"');
  });

  test("`agents edit` --proactive-check REPLACES the whole list, like --sigil", () => {
    runAgentsAdd({
      id: "iota",
      workspace: "/tmp/ws-iota",
      proactiveCheck: ["old-check:0 9 * * *:old prompt"],
    });
    runAgentsEdit("iota", {
      proactiveCheck: ["new-check:0 10 * * *:new prompt"],
    });
    expect(process.exitCode).toBe(0);
    expect(readProactiveChecks(root, "iota")).toEqual([
      {
        id: "new-check",
        schedule: "0 10 * * *",
        prompt: "new prompt",
        require_explicit_finding: true,
      },
    ]);
  });

  test("`agents edit` without --proactive-check leaves existing checks untouched", () => {
    runAgentsAdd({
      id: "kappa",
      workspace: "/tmp/ws-kappa",
      proactiveCheck: ["keep-me:0 9 * * *:stay put"],
    });
    runAgentsEdit("kappa", { name: "Kappa Renamed" });
    expect(process.exitCode).toBe(0);
    expect(readProactiveChecks(root, "kappa")).toEqual([
      {
        id: "keep-me",
        schedule: "0 9 * * *",
        prompt: "stay put",
        require_explicit_finding: true,
      },
    ]);
  });
});

describe("crew agents list-checks / run-check guard clauses", () => {
  const savedRoot = process.env.JSTACK_PROJECT_ROOT;
  let root: string;

  beforeEach(() => {
    root = mkFixtureRoot();
    process.env.JSTACK_PROJECT_ROOT = root;
    process.exitCode = 0;
  });

  afterEach(() => {
    if (savedRoot === undefined) delete process.env.JSTACK_PROJECT_ROOT;
    else process.env.JSTACK_PROJECT_ROOT = savedRoot;
    process.exitCode = 0;
  });

  test("list-checks on an agent with none configured says so rather than erroring", () => {
    const orig = console.log;
    let logged = "";
    console.log = (...args: unknown[]) => {
      logged += args.map(String).join(" ");
    };
    try {
      runAgentsListChecks("alpha", false);
    } finally {
      console.log = orig;
    }
    expect(process.exitCode).toBe(0);
    expect(logged).toContain("none configured");
  });

  test("list-checks on an unknown agent errors without throwing", () => {
    const logged = captureError(() => runAgentsListChecks("nope", false));
    expect(process.exitCode).toBe(1);
    expect(logged).toContain("no such agent: nope");
  });

  test("run-check on an unknown agent errors before touching the model or Slack", async () => {
    const orig = console.error;
    let logged = "";
    console.error = (...args: unknown[]) => {
      logged += args.map(String).join(" ");
    };
    try {
      await runAgentsRunCheck("nope", "whatever", {
        json: false,
        force: false,
      });
    } finally {
      console.error = orig;
    }
    expect(process.exitCode).toBe(1);
    expect(logged).toContain("no such agent: nope");
  });

  test("run-check on a known agent but unknown check id errors without touching the model or Slack", async () => {
    runAgentsAdd({
      id: "lambda",
      workspace: "/tmp/ws-lambda",
      proactiveCheck: ["real-check:0 9 * * *:do the thing"],
    });
    process.exitCode = 0;
    const orig = console.error;
    let logged = "";
    console.error = (...args: unknown[]) => {
      logged += args.map(String).join(" ");
    };
    try {
      await runAgentsRunCheck("lambda", "not-a-real-check", {
        json: false,
        force: false,
      });
    } finally {
      console.error = orig;
    }
    expect(process.exitCode).toBe(1);
    expect(logged).toContain('no proactive check "not-a-real-check"');
  });
});

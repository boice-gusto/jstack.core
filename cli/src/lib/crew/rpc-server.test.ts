import { describe, expect, test, afterEach } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CrewConfigSchema, type CrewConfig } from "./types.js";
import {
  socketPath,
  startRpcServer,
  type RpcServerHandle,
} from "./rpc-server.js";

function baseConfig(): CrewConfig {
  return CrewConfigSchema.parse({
    enabled: true,
    mode: "dry_run",
    // Isolated per test, not the default `~/.jstack/crew` -- memoryRootFor/transcript.ts key
    // off cfg.state_dir directly, so leaving this at the default silently writes real markdown
    // memory and transcript files into the developer's actual daemon home on every test run.
    state_dir: mkdtempSync(join(tmpdir(), "crew-rpc-cfg-")),
    slack: { self_user_id: "U0TESTUSER1" },
    agents: {
      ralph: { name: "Ralph", sigils: ["!ralph"], workspace: "/tmp/ws" },
    },
    policy: {
      ingress: { channels: ["D0TESTDM001"], authors: ["U0TESTUSER1"] },
      egress: { channels: ["D0TESTDM001"] },
    },
  });
}

/** Same technique crew-sessions.test.ts uses: runWorkerStreaming spawns the literal "claude"
 * name. Emits a stream-json "result" line, not the older blocking-JSON shape -- promptManualSession
 * parses NDJSON stream-json now. */
function installFakeClaude(): { restorePath: string } {
  const dir = mkdtempSync(join(tmpdir(), "fake-claude-bin-rpc-"));
  writeFileSync(
    join(dir, "claude"),
    '#!/bin/sh\necho \'{"type":"result","is_error":false,"result":"rpc reply","total_cost_usd":0.002}\'\n',
  );
  chmodSync(join(dir, "claude"), 0o755);
  const restorePath = process.env.PATH ?? "";
  process.env.PATH = `${dir}:${restorePath}`;
  return { restorePath };
}

/** Same technique as installFakeClaude, but also dumps argv to a file so a test can inspect
 * what session/prompt's mode/thinkingLevel params actually produced (see session.test.ts's
 * installArgvCapturingFakeClaude, the original of this pattern). */
function installArgvCapturingFakeClaude(): {
  restorePath: string;
  argvFile: string;
} {
  const dir = mkdtempSync(join(tmpdir(), "fake-claude-bin-rpc-argv-"));
  const argvFile = join(dir, "argv.txt");
  writeFileSync(
    join(dir, "claude"),
    [
      "#!/bin/sh",
      `printf '%s\\n' "$@" > ${argvFile}`,
      'echo \'{"type":"result","is_error":false,"result":"rpc reply","total_cost_usd":0.002}\'',
    ].join("\n"),
  );
  chmodSync(join(dir, "claude"), 0o755);
  const restorePath = process.env.PATH ?? "";
  process.env.PATH = `${dir}:${restorePath}`;
  return { restorePath, argvFile };
}

/** Minimal NDJSON request/response client over the raw Unix socket. */
async function rpcCall(
  sockPath: string,
  method: string,
  params?: unknown,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    Bun.connect({
      unix: sockPath,
      socket: {
        open(socket) {
          socket.write(`${JSON.stringify({ id: 1, method, params })}\n`);
        },
        data(socket, chunk) {
          buffer += chunk.toString("utf8");
          if (!buffer.includes("\n")) return;
          const line = buffer.split("\n")[0]!;
          const parsed = JSON.parse(line) as {
            result?: unknown;
            error?: { message: string };
          };
          socket.end();
          if (parsed.error) reject(new Error(parsed.error.message));
          else resolve(parsed.result);
        },
        error(_socket, err) {
          reject(err);
        },
      },
    }).catch(reject);
  });
}

/** `agent/create` mutates real project state via `agent-config.ts`'s `findProjectRoot()`, unlike
 * every other method here which only ever touches the isolated `stateDir` -- needs its own
 * `jstack.config.json` fixture and `JSTACK_PROJECT_ROOT` override. */
function withProjectRoot(cfg: CrewConfig): {
  root: string;
  restore: () => void;
} {
  const root = mkdtempSync(join(tmpdir(), "crew-rpc-project-"));
  writeFileSync(
    join(root, "jstack.config.json"),
    JSON.stringify({ crew: cfg }),
  );
  const saved = process.env.JSTACK_PROJECT_ROOT;
  process.env.JSTACK_PROJECT_ROOT = root;
  return {
    root,
    restore: () => {
      if (saved === undefined) delete process.env.JSTACK_PROJECT_ROOT;
      else process.env.JSTACK_PROJECT_ROOT = saved;
    },
  };
}

describe("rpc-server", () => {
  let handle: RpcServerHandle | undefined;
  let restorePath: string | undefined;
  let restoreProjectRoot: (() => void) | undefined;

  afterEach(() => {
    handle?.stop();
    handle = undefined;
    if (restorePath !== undefined) process.env.PATH = restorePath;
    restoreProjectRoot?.();
    restoreProjectRoot = undefined;
  });

  test("creates the socket with 0600 permissions", () => {
    const stateDir = mkdtempSync(join(tmpdir(), "crew-rpc-test-"));
    const cfg = baseConfig();
    handle = startRpcServer({ stateDir, getConfig: () => cfg });
    expect(handle.sockPath).toBe(socketPath(stateDir));
    const mode = statSync(handle.sockPath).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  test("logs/recent defaults to [] when the server wasn't given a getLogs callback", async () => {
    const stateDir = mkdtempSync(join(tmpdir(), "crew-rpc-test-"));
    const cfg = baseConfig();
    handle = startRpcServer({ stateDir, getConfig: () => cfg });
    const result = (await rpcCall(handle.sockPath, "logs/recent")) as {
      lines: string[];
    };
    expect(result.lines).toEqual([]);
  });

  test("logs/recent returns whatever getLogs provides, honoring the limit param", async () => {
    const stateDir = mkdtempSync(join(tmpdir(), "crew-rpc-test-"));
    const cfg = baseConfig();
    handle = startRpcServer({
      stateDir,
      getConfig: () => cfg,
      getLogs: (limit) => ["a", "b", "c"].slice(-(limit ?? 3)),
    });
    const all = (await rpcCall(handle.sockPath, "logs/recent")) as {
      lines: string[];
    };
    expect(all.lines).toEqual(["a", "b", "c"]);
    const limited = (await rpcCall(handle.sockPath, "logs/recent", {
      limit: 1,
    })) as {
      lines: string[];
    };
    expect(limited.lines).toEqual(["c"]);
  });

  test("session/new -> session/prompt -> status -> session/cancel end to end", async () => {
    restorePath = installFakeClaude().restorePath;
    const stateDir = mkdtempSync(join(tmpdir(), "crew-rpc-test-"));
    const cfg = baseConfig();
    handle = startRpcServer({ stateDir, getConfig: () => cfg });

    const created = (await rpcCall(handle.sockPath, "session/new", {
      agentId: "ralph",
    })) as { id: string; sessionId: string };
    expect(created.id).toMatch(/^ral-[a-z0-9]{4}$/);

    const prompted = (await rpcCall(handle.sockPath, "session/prompt", {
      id: created.id,
      message: "hello",
    })) as { ok: boolean; text: string };
    expect(prompted.ok).toBe(true);
    expect(prompted.text).toBe("rpc reply");

    const remembered = (await rpcCall(handle.sockPath, "session/remember", {
      id: created.id,
      content: "The user's Q3 deadline is October 15.",
    })) as { agentId: string; content: string };
    expect(remembered.agentId).toBe("ralph");
    expect(remembered.content).toContain("October 15");

    const status = (await rpcCall(handle.sockPath, "status")) as {
      tasks: number;
      enabled: boolean;
    };
    expect(status.tasks).toBeGreaterThanOrEqual(1);
    expect(status.enabled).toBe(true);

    const cancelled = (await rpcCall(handle.sockPath, "session/cancel", {
      id: created.id,
    })) as { ok: boolean };
    expect(cancelled.ok).toBe(true);
  });

  test("session/prompt forwards mode and thinkingLevel through to the worker invocation", async () => {
    const fake = installArgvCapturingFakeClaude();
    restorePath = fake.restorePath;
    const stateDir = mkdtempSync(join(tmpdir(), "crew-rpc-test-"));
    const cfg = baseConfig();
    handle = startRpcServer({ stateDir, getConfig: () => cfg });

    const created = (await rpcCall(handle.sockPath, "session/new", {
      agentId: "ralph",
    })) as { id: string };

    await rpcCall(handle.sockPath, "session/prompt", {
      id: created.id,
      message: "hello",
      mode: "ask",
      thinkingLevel: "think-harder",
    });

    const sentArgv = readFileSync(fake.argvFile, "utf8");
    expect(sentArgv).toContain("default");
    expect(sentArgv).not.toContain("dontAsk");
    expect(sentArgv).toContain(
      "Think harder about this turn before answering.",
    );
  });

  test("session/prompt ignores an invalid mode/thinkingLevel value rather than erroring", async () => {
    const fake = installArgvCapturingFakeClaude();
    restorePath = fake.restorePath;
    const stateDir = mkdtempSync(join(tmpdir(), "crew-rpc-test-"));
    const cfg = baseConfig();
    handle = startRpcServer({ stateDir, getConfig: () => cfg });

    const created = (await rpcCall(handle.sockPath, "session/new", {
      agentId: "ralph",
    })) as { id: string };

    const result = (await rpcCall(handle.sockPath, "session/prompt", {
      id: created.id,
      message: "hello",
      mode: "sudo",
      thinkingLevel: "maximum-overdrive",
    })) as { ok: boolean };
    expect(result.ok).toBe(true);

    const sentArgv = readFileSync(fake.argvFile, "utf8");
    expect(sentArgv).toContain("dontAsk");
    expect(sentArgv).not.toContain("Think");
  });

  test("agent/list returns the configured agents", async () => {
    const stateDir = mkdtempSync(join(tmpdir(), "crew-rpc-test-"));
    const cfg = baseConfig();
    handle = startRpcServer({ stateDir, getConfig: () => cfg });

    const agents = (await rpcCall(handle.sockPath, "agent/list")) as Array<{
      id: string;
      name: string;
      enabled: boolean;
      proactiveChecks: unknown[];
    }>;
    expect(agents).toEqual([
      expect.objectContaining({
        id: "ralph",
        name: "Ralph",
        enabled: true,
        proactiveChecks: [],
      }),
    ]);
  });

  test("agent/create writes a new agent and it's immediately usable via session/new", async () => {
    restorePath = installFakeClaude().restorePath;
    const stateDir = mkdtempSync(join(tmpdir(), "crew-rpc-test-"));
    const cfg = baseConfig();
    const project = withProjectRoot(cfg);
    restoreProjectRoot = project.restore;
    handle = startRpcServer({ stateDir, getConfig: () => cfg });

    const created = (await rpcCall(handle.sockPath, "agent/create", {
      id: "scout",
      name: "Scout",
      persona: "Terse and cites sources.",
      mcp: "inherit",
    })) as {
      id: string;
      agent: { name: string; mcp: string; proactiveChecks: unknown[] };
    };
    expect(created.id).toBe("scout");
    expect(created.agent).toMatchObject({
      name: "Scout",
      mcp: "inherit",
      proactiveChecks: [],
    });

    // No daemon reload happened -- this proves the in-memory cfg was spliced immediately,
    // not just the file on disk.
    const session = (await rpcCall(handle.sockPath, "session/new", {
      agentId: "scout",
    })) as { id: string };
    expect(session.id).toMatch(/^sco-/);

    const agents = (await rpcCall(handle.sockPath, "agent/list")) as Array<{
      id: string;
    }>;
    expect(agents.map((a) => a.id)).toContain("scout");

    // No workspace was given, so the default path should have been git-init'd and README'd
    // (initDefaultWorkspace) rather than left as a bare, untracked directory. The default
    // path is derived from cfg.state_dir, not the rpc server's own stateDir param.
    const workspace = join(cfg.state_dir!, "workspaces", "scout");
    expect(existsSync(join(workspace, ".git"))).toBe(true);
    expect(existsSync(join(workspace, "README.md"))).toBe(true);
  });

  test("agent/create rejects a duplicate id over the wire", async () => {
    const stateDir = mkdtempSync(join(tmpdir(), "crew-rpc-test-"));
    const cfg = baseConfig();
    const project = withProjectRoot(cfg);
    restoreProjectRoot = project.restore;
    handle = startRpcServer({ stateDir, getConfig: () => cfg });

    await expect(
      rpcCall(handle.sockPath, "agent/create", {
        id: "ralph",
        name: "Ralph 2",
      }),
    ).rejects.toThrow(/already exists/);
  });

  test("agent/update changes an existing agent's model and it's visible immediately, without a daemon reload", async () => {
    const stateDir = mkdtempSync(join(tmpdir(), "crew-rpc-test-"));
    const cfg = baseConfig();
    const project = withProjectRoot(cfg);
    restoreProjectRoot = project.restore;
    handle = startRpcServer({ stateDir, getConfig: () => cfg });

    const updated = (await rpcCall(handle.sockPath, "agent/update", {
      id: "ralph",
      model: "claude-opus-5",
    })) as { id: string; agent: { model: string } };
    expect(updated.id).toBe("ralph");
    expect(updated.agent.model).toBe("claude-opus-5");
    // In-memory cfg (not just the on-disk config) is what session/prompt actually reads --
    // spliced the same way agent/create is, so this needs no daemon reload to take effect.
    expect(cfg.agents.ralph!.model).toBe("claude-opus-5");

    const agents = (await rpcCall(handle.sockPath, "agent/list")) as Array<{
      id: string;
      model: string;
    }>;
    expect(agents.find((a) => a.id === "ralph")?.model).toBe("claude-opus-5");
  });

  test("agent/update also changes tools and mcp, independent of model", async () => {
    const stateDir = mkdtempSync(join(tmpdir(), "crew-rpc-test-"));
    const cfg = baseConfig();
    const project = withProjectRoot(cfg);
    restoreProjectRoot = project.restore;
    handle = startRpcServer({ stateDir, getConfig: () => cfg });

    const updated = (await rpcCall(handle.sockPath, "agent/update", {
      id: "ralph",
      tools: ["Read", "Write"],
      mcp: "inherit",
    })) as { id: string; agent: { tools: string[]; mcp: string } };
    expect(updated.agent.tools).toEqual(["Read", "Write"]);
    expect(updated.agent.mcp).toBe("inherit");
    expect(cfg.agents.ralph!.tools).toEqual(["Read", "Write"]);
    expect(cfg.agents.ralph!.mcp).toBe("inherit");
  });

  test("agent/update also toggles enabled, independent of model/tools/mcp", async () => {
    const stateDir = mkdtempSync(join(tmpdir(), "crew-rpc-test-"));
    const cfg = baseConfig();
    const project = withProjectRoot(cfg);
    restoreProjectRoot = project.restore;
    handle = startRpcServer({ stateDir, getConfig: () => cfg });

    expect(cfg.agents.ralph!.enabled).toBe(true);
    const updated = (await rpcCall(handle.sockPath, "agent/update", {
      id: "ralph",
      enabled: false,
    })) as { id: string; agent: { enabled: boolean } };
    expect(updated.agent.enabled).toBe(false);
    expect(cfg.agents.ralph!.enabled).toBe(false);

    const agents = (await rpcCall(handle.sockPath, "agent/list")) as Array<{
      id: string;
      enabled: boolean;
    }>;
    expect(agents.find((a) => a.id === "ralph")?.enabled).toBe(false);
  });

  test("agent/update rejects an unknown agent id", async () => {
    const stateDir = mkdtempSync(join(tmpdir(), "crew-rpc-test-"));
    const cfg = baseConfig();
    const project = withProjectRoot(cfg);
    restoreProjectRoot = project.restore;
    handle = startRpcServer({ stateDir, getConfig: () => cfg });

    await expect(
      rpcCall(handle.sockPath, "agent/update", {
        id: "nope",
        model: "claude-opus-5",
      }),
    ).rejects.toThrow(/not found/);
  });

  test("skills/index returns the real plugin's skill catalog shape", async () => {
    const stateDir = mkdtempSync(join(tmpdir(), "crew-rpc-test-"));
    const cfg = baseConfig();
    handle = startRpcServer({ stateDir, getConfig: () => cfg });

    const result = (await rpcCall(handle.sockPath, "skills/index", {})) as {
      skills: Array<{
        name: string;
        description: string;
        rel: string;
        origin: string;
      }>;
    };
    expect(Array.isArray(result.skills)).toBe(true);
    expect(result.skills.length).toBeGreaterThan(0);
    for (const s of result.skills) {
      expect(typeof s.name).toBe("string");
      expect(typeof s.rel).toBe("string");
      expect(["core", "overlay"]).toContain(s.origin);
    }
  });

  test("session/history returns the transcript from a prior session/prompt", async () => {
    restorePath = installFakeClaude().restorePath;
    const stateDir = mkdtempSync(join(tmpdir(), "crew-rpc-test-"));
    const cfg = baseConfig();
    handle = startRpcServer({ stateDir, getConfig: () => cfg });

    const created = (await rpcCall(handle.sockPath, "session/new", {
      agentId: "ralph",
    })) as { id: string };
    await rpcCall(handle.sockPath, "session/prompt", {
      id: created.id,
      message: "hello",
    });

    const history = (await rpcCall(handle.sockPath, "session/history", {
      id: created.id,
    })) as Array<{ role: string; text: string }>;
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({ role: "user", text: "hello" });
    expect(history[1]).toMatchObject({
      role: "assistant",
      text: "rpc reply",
    });
  });

  test("session/list returns manual sessions newest first", async () => {
    restorePath = installFakeClaude().restorePath;
    const stateDir = mkdtempSync(join(tmpdir(), "crew-rpc-test-"));
    const cfg = baseConfig();
    handle = startRpcServer({ stateDir, getConfig: () => cfg });

    const a = (await rpcCall(handle.sockPath, "session/new", {
      agentId: "ralph",
    })) as { id: string };
    const b = (await rpcCall(handle.sockPath, "session/new", {
      agentId: "ralph",
    })) as { id: string };

    const sessions = (await rpcCall(handle.sockPath, "session/list")) as Array<{
      id: string;
      agentId: string;
    }>;
    expect(sessions.map((s) => s.id)).toEqual([b.id, a.id]);
    expect(sessions[0]?.agentId).toBe("ralph");
  });

  test("session/remember rejects an invalid kind over the wire", async () => {
    restorePath = installFakeClaude().restorePath;
    const stateDir = mkdtempSync(join(tmpdir(), "crew-rpc-test-"));
    const cfg = baseConfig();
    handle = startRpcServer({ stateDir, getConfig: () => cfg });
    const created = (await rpcCall(handle.sockPath, "session/new", {
      agentId: "ralph",
    })) as { id: string };
    await expect(
      rpcCall(handle.sockPath, "session/remember", {
        id: created.id,
        content: "x",
        kind: "not-a-kind",
      }),
    ).rejects.toThrow(/kind must be one of/);
  });

  test("an unknown method returns an error over the wire, not a dropped connection", async () => {
    const stateDir = mkdtempSync(join(tmpdir(), "crew-rpc-test-"));
    const cfg = baseConfig();
    handle = startRpcServer({ stateDir, getConfig: () => cfg });
    await expect(rpcCall(handle.sockPath, "not/a/method")).rejects.toThrow(
      /unknown method/,
    );
  });

  test("invalid JSON on the wire gets an error response instead of killing the server", async () => {
    const stateDir = mkdtempSync(join(tmpdir(), "crew-rpc-test-"));
    const cfg = baseConfig();
    handle = startRpcServer({ stateDir, getConfig: () => cfg });

    const raw = await new Promise<string>((resolve, reject) => {
      let buffer = "";
      Bun.connect({
        unix: handle!.sockPath,
        socket: {
          open(socket) {
            socket.write("not json at all\n");
          },
          data(socket, chunk) {
            buffer += chunk.toString("utf8");
            if (buffer.includes("\n")) {
              socket.end();
              resolve(buffer);
            }
          },
          error(_s, err) {
            reject(err);
          },
        },
      }).catch(reject);
    });
    expect(JSON.parse(raw.trim()).error.message).toMatch(/invalid JSON/);

    // The server itself must still be alive for a subsequent, valid call.
    const status = await rpcCall(handle!.sockPath, "status");
    expect(status).toBeTruthy();
  });

  test("status reports resident: true, a growing uptimeMs, and a per-agent breakdown", async () => {
    const stateDir = mkdtempSync(join(tmpdir(), "crew-rpc-test-"));
    const cfg = baseConfig();
    const startedAt = Date.now() - 5_000;
    handle = startRpcServer({ stateDir, getConfig: () => cfg, startedAt });

    const status = (await rpcCall(handle.sockPath, "status")) as {
      resident: boolean;
      uptimeMs: number;
      perAgent: Array<{ agentId: string }>;
    };
    expect(status.resident).toBe(true);
    expect(status.uptimeMs).toBeGreaterThanOrEqual(5_000);
    expect(status.perAgent).toEqual([]);
  });

  describe("schedule/* (desktop-app-created scheduled prompts)", () => {
    test("create -> list -> update -> delete", async () => {
      const stateDir = mkdtempSync(join(tmpdir(), "crew-rpc-test-"));
      const cfg = baseConfig();
      handle = startRpcServer({ stateDir, getConfig: () => cfg });

      const created = (await rpcCall(handle.sockPath, "schedule/create", {
        agentId: "ralph",
        prompt: "Summarize open PRs",
        cron: "0 9 * * *",
      })) as { id: string };
      expect(created.id).toMatch(/^sch-/);

      const listed = (await rpcCall(handle.sockPath, "schedule/list")) as {
        schedules: Array<{ id: string; prompt: string; enabled: boolean }>;
      };
      expect(listed.schedules).toEqual([
        expect.objectContaining({
          id: created.id,
          prompt: "Summarize open PRs",
          enabled: true,
        }),
      ]);

      await rpcCall(handle.sockPath, "schedule/update", {
        id: created.id,
        enabled: false,
      });
      const afterUpdate = (await rpcCall(handle.sockPath, "schedule/list")) as {
        schedules: Array<{ id: string; enabled: boolean }>;
      };
      expect(afterUpdate.schedules[0]!.enabled).toBe(false);

      await rpcCall(handle.sockPath, "schedule/delete", { id: created.id });
      const afterDelete = (await rpcCall(handle.sockPath, "schedule/list")) as {
        schedules: unknown[];
      };
      expect(afterDelete.schedules).toEqual([]);
    });

    test("rejects an unknown agent", async () => {
      const stateDir = mkdtempSync(join(tmpdir(), "crew-rpc-test-"));
      const cfg = baseConfig();
      handle = startRpcServer({ stateDir, getConfig: () => cfg });

      await expect(
        rpcCall(handle.sockPath, "schedule/create", {
          agentId: "nobody",
          prompt: "hi",
          cron: "* * * * *",
        }),
      ).rejects.toThrow(/not found/);
    });

    test("rejects an unparseable cron expression", async () => {
      const stateDir = mkdtempSync(join(tmpdir(), "crew-rpc-test-"));
      const cfg = baseConfig();
      handle = startRpcServer({ stateDir, getConfig: () => cfg });

      await expect(
        rpcCall(handle.sockPath, "schedule/create", {
          agentId: "ralph",
          prompt: "hi",
          cron: "not a cron",
        }),
      ).rejects.toThrow(/unparseable/);
    });
  });

  test("diagnostics/run reports the configured agents and their workspace existence", async () => {
    const stateDir = mkdtempSync(join(tmpdir(), "crew-rpc-test-"));
    const cfg = baseConfig();
    handle = startRpcServer({ stateDir, getConfig: () => cfg });

    const report = (await rpcCall(handle.sockPath, "diagnostics/run")) as {
      agents: Array<{
        id: string;
        workspace: string;
        workspaceExists: boolean;
      }>;
      claudeCli: { found: boolean };
    };
    expect(report.agents).toEqual([
      expect.objectContaining({
        id: "ralph",
        workspace: "/tmp/ws",
        workspaceExists: false,
      }),
    ]);
    expect(typeof report.claudeCli.found).toBe("boolean");
  });

  test("integrations/list reports the slack-dm integration", async () => {
    // Not installFakeClaude() -- that only answers a plain `claude -p` turn.
    // listIntegrations calls `claude mcp list` directly, which the real claude binary can hang
    // on in a sandboxed test environment (no auth/terminal context), so it needs its own fake
    // that answers that specific subcommand quickly.
    const dir = mkdtempSync(join(tmpdir(), "fake-claude-rpc-integrations-"));
    writeFileSync(
      join(dir, "claude"),
      '#!/bin/sh\nif [ "$1" = "mcp" ]; then echo "no servers"; exit 0; fi\nexit 1\n',
    );
    chmodSync(join(dir, "claude"), 0o755);
    restorePath = process.env.PATH ?? "";
    process.env.PATH = `${dir}:${restorePath}`;

    const stateDir = mkdtempSync(join(tmpdir(), "crew-rpc-test-"));
    const cfg = baseConfig();
    handle = startRpcServer({ stateDir, getConfig: () => cfg });

    const { integrations } = (await rpcCall(
      handle.sockPath,
      "integrations/list",
    )) as {
      integrations: Array<{ id: string; configured: boolean }>;
    };
    expect(integrations).toEqual([
      expect.objectContaining({ id: "slack-dm", configured: true }),
    ]);
  });

  test("schedule/create accepts and stores an optional notifyChannel", async () => {
    const stateDir = mkdtempSync(join(tmpdir(), "crew-rpc-test-"));
    const cfg = baseConfig();
    handle = startRpcServer({ stateDir, getConfig: () => cfg });

    await rpcCall(handle.sockPath, "schedule/create", {
      agentId: "ralph",
      prompt: "hi",
      cron: "* * * * *",
      notifyChannel: "D0MYDM001",
    });
    const { schedules } = (await rpcCall(handle.sockPath, "schedule/list")) as {
      schedules: Array<{ notifyChannel: string | null }>;
    };
    expect(schedules[0]!.notifyChannel).toBe("D0MYDM001");
  });
});

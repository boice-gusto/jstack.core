import { describe, expect, test, afterEach } from "bun:test";
import { chmodSync, mkdtempSync, statSync, writeFileSync } from "node:fs";
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

/** Same technique crew-sessions.test.ts uses: runWorker spawns the literal "claude" name. */
function installFakeClaude(): { restorePath: string } {
  const dir = mkdtempSync(join(tmpdir(), "fake-claude-bin-rpc-"));
  writeFileSync(
    join(dir, "claude"),
    '#!/bin/sh\necho \'{"is_error":false,"result":"rpc reply","total_cost_usd":0.002}\'\n',
  );
  chmodSync(join(dir, "claude"), 0o755);
  const restorePath = process.env.PATH ?? "";
  process.env.PATH = `${dir}:${restorePath}`;
  return { restorePath };
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

describe("rpc-server", () => {
  let handle: RpcServerHandle | undefined;
  let restorePath: string | undefined;

  afterEach(() => {
    handle?.stop();
    handle = undefined;
    if (restorePath !== undefined) process.env.PATH = restorePath;
  });

  test("creates the socket with 0600 permissions", () => {
    const stateDir = mkdtempSync(join(tmpdir(), "crew-rpc-test-"));
    const cfg = baseConfig();
    handle = startRpcServer({ stateDir, getConfig: () => cfg });
    expect(handle.sockPath).toBe(socketPath(stateDir));
    const mode = statSync(handle.sockPath).mode & 0o777;
    expect(mode).toBe(0o600);
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
});

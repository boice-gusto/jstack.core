import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runResident } from "./crewd.js";
import { CrewConfigSchema, type CrewConfig } from "./lib/crew/types.js";
import { socketPath } from "./lib/crew/rpc-server.js";

/**
 * Exercises ONLY runResident's own loop mechanics (start the RPC server once a cycle succeeds,
 * call the cycle repeatedly, stop the RPC server on exit) via an injected fake `runCycle` --
 * never the real `runOneCycle`/`loadConfig()`, which checks the real, hardcoded
 * `~/.jstack/crew/config.snapshot.json` first (a real user's actual crew state on this
 * machine). See runResident's own doc comment for why that path must never be exercised by a
 * test.
 */
function fixtureConfig(stateDir: string): CrewConfig {
  return CrewConfigSchema.parse({
    enabled: true,
    mode: "dry_run",
    state_dir: stateDir,
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

async function rpcCall(sockPath: string, method: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    Bun.connect({
      unix: sockPath,
      socket: {
        open(socket) {
          socket.write(`${JSON.stringify({ id: 1, method })}\n`);
        },
        data(socket, chunk) {
          buffer += chunk.toString("utf8");
          if (!buffer.includes("\n")) return;
          socket.end();
          resolve(JSON.parse(buffer.split("\n")[0]!));
        },
        error(_s, err) {
          reject(err);
        },
      },
    }).catch(reject);
  });
}

describe("runResident", () => {
  test("runs the cycle maxIterations times, starts the socket lazily, and cleans it up on exit", async () => {
    const stateDir = mkdtempSync(join(tmpdir(), "crewd-resident-test-"));
    const cfg = fixtureConfig(stateDir);
    let cycleCount = 0;

    const residentDone = runResident({
      intervalMs: 20,
      maxIterations: 3,
      runCycle: async () => {
        cycleCount++;
        return { cfg, source: "fixture" };
      },
    });

    // Poll for the socket to appear rather than racing a fixed delay -- it's created on the
    // first successful cycle, which is async relative to this call.
    const sockPath = socketPath(stateDir);
    for (let i = 0; i < 50 && !existsSync(sockPath); i++) {
      await Bun.sleep(10);
    }
    expect(existsSync(sockPath)).toBe(true);

    const status = (await rpcCall(sockPath, "status")) as {
      result?: { enabled: boolean };
    };
    expect(status.result?.enabled).toBe(true);

    await residentDone;
    expect(cycleCount).toBe(3);
    expect(existsSync(sockPath)).toBe(false);
  });

  test("keeps looping and serving the socket through a cycle that returns null", async () => {
    const stateDir = mkdtempSync(join(tmpdir(), "crewd-resident-test-"));
    const cfg = fixtureConfig(stateDir);
    let call = 0;

    await runResident({
      intervalMs: 5,
      maxIterations: 3,
      runCycle: async () => {
        call++;
        // Simulate a transient config-load failure on the second cycle only.
        if (call === 2) return null;
        return { cfg, source: "fixture" };
      },
    });

    expect(call).toBe(3);
    expect(existsSync(socketPath(stateDir))).toBe(false);
  });
});

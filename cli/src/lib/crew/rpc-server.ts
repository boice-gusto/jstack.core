import { chmodSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { Socket } from "bun";
import {
  cancelManualSession,
  createManualSession,
  promptManualSession,
} from "./session.js";
import { CrewStore, expandHome } from "./store.js";
import type { CrewConfig } from "./types.js";

/**
 * The resident daemon's local control surface: a Unix domain socket, newline-delimited JSON-RPC
 * 2.0-shaped requests/responses. Method names (`session/new`, `session/prompt`,
 * `session/cancel`) intentionally mirror the Agent Client Protocol's session verbs, even though
 * this transport isn't literally ACP -- see the AgentProvider extraction's own note on this
 * (cli/src/lib/agent-providers/provider.ts) for why: it keeps the message shapes stable if a
 * real ACP transport (or a UI client) replaces this later.
 *
 * A Unix socket (0600, user-only) is the access control -- unlike `ui-server.ts`'s
 * browser-reachable HTTP surface, there's no CSRF/DNS-rebinding threat model here to defend
 * against, since nothing but a local process holding the right file permissions can ever open
 * this socket.
 *
 * `session/prompt` runs the real turn synchronously (crew's turn-runner is blocking
 * `--output-format json`, not token-streaming -- see session.ts/tick.ts) and only replies once
 * it's done, which can be up to `task_timeout_ms` (minutes). That's a real, current limitation:
 * there is no `session/update` streaming notification yet, because there is nothing to stream
 * from underneath it. A future move to stream-json turns would add one without changing this
 * dispatch shape.
 */

type SocketData = { buffer: string };

export interface RpcServerHandle {
  sockPath: string;
  stop: () => void;
}

interface RpcRequest {
  id: string | number | null;
  method: string;
  params?: unknown;
}

function parseRequest(line: string): RpcRequest | { error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return { error: "invalid JSON" };
  }
  if (typeof raw !== "object" || raw === null)
    return { error: "not an object" };
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" || typeof r.id === "number" ? r.id : null;
  if (typeof r.method !== "string") return { error: "missing method" };
  return { id, method: r.method, params: r.params };
}

async function dispatch(
  cfg: CrewConfig,
  stateDir: string,
  method: string,
  params: unknown,
): Promise<unknown> {
  const p = (params ?? {}) as Record<string, unknown>;
  const store = new CrewStore(stateDir);
  try {
    switch (method) {
      case "session/new": {
        if (typeof p.agentId !== "string") {
          throw new Error("session/new requires { agentId: string }");
        }
        return createManualSession(store, cfg, p.agentId);
      }
      case "session/prompt": {
        if (typeof p.id !== "string" || typeof p.message !== "string") {
          throw new Error(
            "session/prompt requires { id: string, message: string }",
          );
        }
        return await promptManualSession(store, cfg, p.id, p.message);
      }
      case "session/cancel": {
        if (typeof p.id !== "string") {
          throw new Error("session/cancel requires { id: string }");
        }
        cancelManualSession(store, p.id);
        return { ok: true };
      }
      case "status": {
        const stats = store.stats();
        return { ...stats, enabled: cfg.enabled, mode: cfg.mode };
      }
      default:
        throw new Error(`unknown method: ${method}`);
    }
  } finally {
    store.close();
  }
}

export function socketPath(stateDir: string): string {
  return join(expandHome(stateDir), "agent.sock");
}

export function startRpcServer(opts: {
  stateDir: string;
  getConfig: () => CrewConfig;
}): RpcServerHandle {
  const dir = expandHome(opts.stateDir);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const sockPath = socketPath(opts.stateDir);
  // A stale socket file from a prior crash makes Bun.listen fail with EADDRINUSE -- there is no
  // second process on the other end of a leftover socket file, so removing it first is safe.
  if (existsSync(sockPath)) {
    try {
      unlinkSync(sockPath);
    } catch {
      /* best-effort; Bun.listen below will surface a real problem */
    }
  }

  function respond(
    socket: Socket<SocketData>,
    id: string | number | null,
    payload: { result: unknown } | { error: string },
  ): void {
    const body =
      "error" in payload
        ? { id, error: { message: payload.error } }
        : { id, result: payload.result };
    socket.write(`${JSON.stringify(body)}\n`);
  }

  function handleLine(socket: Socket<SocketData>, line: string): void {
    const req = parseRequest(line);
    if ("error" in req) {
      respond(socket, null, { error: req.error });
      return;
    }
    dispatch(opts.getConfig(), opts.stateDir, req.method, req.params).then(
      (result) => respond(socket, req.id, { result }),
      (e: unknown) =>
        respond(socket, req.id, {
          error: e instanceof Error ? e.message : String(e),
        }),
    );
  }

  const server = Bun.listen<SocketData>({
    unix: sockPath,
    socket: {
      open(socket) {
        socket.data = { buffer: "" };
      },
      data(socket, chunk) {
        socket.data.buffer += chunk.toString("utf8");
        const lines = socket.data.buffer.split("\n");
        socket.data.buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.trim().length > 0) handleLine(socket, line);
        }
      },
    },
  });
  try {
    chmodSync(sockPath, 0o600);
  } catch {
    /* best-effort hardening; the directory itself is already 0700 */
  }

  return {
    sockPath,
    stop: () => {
      server.stop(true);
      try {
        if (existsSync(sockPath)) unlinkSync(sockPath);
      } catch {
        /* nothing left to clean up if this fails */
      }
    },
  };
}

import { chmodSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { Socket } from "bun";
import {
  cancelManualSession,
  createManualSession,
  getSessionHistory,
  listManualSessions,
  promptManualSession,
  rememberInSession,
} from "./session.js";
import {
  createAgent,
  initDefaultWorkspace,
  updateAgent,
} from "./agent-config.js";
import { MEMORY_KINDS, MEMORY_SOURCES } from "../memory-store.js";
import { CrewStore, expandHome } from "./store.js";
import type { AgentConfig, CrewConfig } from "./types.js";
import type { SessionMode, ThinkingLevel } from "./tick.js";
import type { LiveSessionEvent } from "./slack.js";
import { collectSkills, type SkillIndexEntry } from "../../commands/skills.js";
import { findPluginRoot } from "../config.js";
import { TtlCache, ttlMsFromEnv } from "../ttl-cache.js";
import { parseCron } from "./proactive.js";
import { scheduledPromptId } from "./scheduler.js";
import { runDiagnostics } from "./diagnostics.js";
import { listIntegrations } from "./integrations.js";
import { listMcpServersRaw } from "./mcp.js";

const SESSION_MODES: readonly SessionMode[] = ["ask", "full-access"];
const THINKING_LEVELS: readonly ThinkingLevel[] = [
  "none",
  "think",
  "think-hard",
  "think-harder",
  "ultrathink",
];

/**
 * `skills/index` walks and parses every SKILL.md under the plugin root (140+ files in
 * jstack.core itself) on every call -- real IO a repeat caller (the desktop app re-opening
 * Settings, `jstackc skills index` run in a loop) doesn't need to pay for again within a short
 * window. One TtlCache per distinct (pluginRoot, overlay) pair, since those are the only inputs
 * that change the result; in practice this daemon only ever sees one such pair per process
 * lifetime, but keying on it rather than assuming that stays honest if that ever changes.
 */
const skillsIndexCache = new Map<string, TtlCache<SkillIndexEntry[]>>();
const SKILLS_INDEX_TTL_ENV = "JSTACK_SKILLS_CACHE_TTL_MINUTES";
const SKILLS_INDEX_TTL_DEFAULT_MINUTES = 5;

function cachedSkillsIndex(
  pluginRoot: string,
  overlay: string | undefined,
): SkillIndexEntry[] {
  const key = `${pluginRoot}::${overlay ?? ""}`;
  let cache = skillsIndexCache.get(key);
  if (!cache) {
    cache = new TtlCache(
      () => collectSkills(pluginRoot, overlay),
      ttlMsFromEnv(SKILLS_INDEX_TTL_ENV, SKILLS_INDEX_TTL_DEFAULT_MINUTES),
    );
    skillsIndexCache.set(key, cache);
  }
  return cache.get();
}

/**
 * The resident daemon's local control surface: a Unix domain socket, newline-delimited JSON-RPC
 * 2.0-shaped requests/responses. Method names (`session/new`, `session/list`, `session/history`,
 * `session/prompt`, `session/cancel`, `session/remember`, `agent/list`, `agent/create`,
 * `logs/recent`) intentionally mirror the Agent Client Protocol's session verbs, even though
 * this transport isn't literally ACP --
 * see the AgentProvider extraction's own note on this (cli/src/lib/agent-providers/provider.ts)
 * for why: it keeps the message shapes stable if a real ACP transport (or a UI client) replaces
 * this later.
 *
 * A Unix socket (0600, user-only) is the access control -- unlike `ui-server.ts`'s
 * browser-reachable HTTP surface, there's no CSRF/DNS-rebinding threat model here to defend
 * against, since nothing but a local process holding the right file permissions can ever open
 * this socket.
 *
 * `session/prompt` runs the real turn via `runWorkerStreaming` (stream-json, with tool-call
 * events collected) and still only REPLIES once the whole turn is done, which can be up to
 * `task_timeout_ms` (minutes) -- but a connection can additionally send `session/subscribe`
 * (`{ id: sessionId }`) to register itself for `session/update` notifications (no `id` field,
 * so a client tells them apart from replies to its own requests) pushed live as each event
 * comes off the stream, on ANY connection -- a session/prompt call and a session/subscribe
 * watcher are normally different connections. A subscription is torn down when its connection
 * closes; there is no explicit unsubscribe.
 *
 * `session/cancel` also runs a self-retro (retro.ts) over the closing session's transcript
 * before responding, so it can take as long as one more agent turn -- the `{ retro }` in its
 * response says what (if anything) got saved to the agent's memory.
 */

type SocketData = { buffer: string; pendingWrite?: Buffer };

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

/** The one shape `agent/list`, `agent/create`, and `agent/update` all return -- previously
 * agent/create and agent/update handed back the raw parsed AgentConfig (snake_case
 * `proactive_checks`, plus fields like `sigils`/`emoji`/`max_turns` the desktop app has no use
 * for), which silently diverged from agent/list's camelCase shape the moment a consumer actually
 * read `proactiveChecks` off a just-created/updated agent. */
function toAgentSummary(id: string, a: AgentConfig) {
  return {
    id,
    name: a.name,
    enabled: a.enabled,
    model: a.model,
    persona: a.persona,
    tools: a.tools,
    mcp: a.mcp,
    proactiveChecks: a.proactive_checks,
  };
}

async function dispatch(
  cfg: CrewConfig,
  stateDir: string,
  method: string,
  params: unknown,
  getLogs: (limit?: number) => string[],
  startedAt: number,
  /** Registers the connection this request arrived on as a live listener for one session's
   * updates -- bound to that socket by the caller (`startRpcServer`'s `handleLine`), which is
   * the only place that knows which socket a request came in on. */
  subscribe: (sessionId: string) => void,
  /** Pushes one `session/update` notification to every socket subscribed to `sessionId`, if
   * any. Not tied to the calling connection -- a prompt's own `onEvent` calls this to fan out
   * to whichever OTHER connection (if any) is watching that session. */
  broadcast: (sessionId: string, event: LiveSessionEvent) => void,
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
      case "session/list": {
        const limit = typeof p.limit === "number" ? p.limit : undefined;
        return listManualSessions(store, cfg, limit);
      }
      case "session/history": {
        if (typeof p.id !== "string") {
          throw new Error("session/history requires { id: string }");
        }
        return getSessionHistory(store, cfg, p.id);
      }
      case "session/subscribe": {
        if (typeof p.id !== "string") {
          throw new Error("session/subscribe requires { id: string }");
        }
        subscribe(p.id);
        return { ok: true };
      }
      case "session/prompt": {
        if (typeof p.id !== "string" || typeof p.message !== "string") {
          throw new Error(
            "session/prompt requires { id: string, message: string }",
          );
        }
        const sessionId = p.id;
        const mode = SESSION_MODES.includes(p.mode as SessionMode)
          ? (p.mode as SessionMode)
          : undefined;
        const thinkingLevel = THINKING_LEVELS.includes(
          p.thinkingLevel as ThinkingLevel,
        )
          ? (p.thinkingLevel as ThinkingLevel)
          : undefined;
        return await promptManualSession(
          store,
          cfg,
          sessionId,
          p.message,
          { mode, thinkingLevel },
          (event) => broadcast(sessionId, event),
        );
      }
      case "session/cancel": {
        if (typeof p.id !== "string") {
          throw new Error("session/cancel requires { id: string }");
        }
        const { retro } = await cancelManualSession(store, cfg, p.id);
        return { ok: true, retro };
      }
      case "session/remember": {
        if (typeof p.id !== "string" || typeof p.content !== "string") {
          throw new Error(
            "session/remember requires { id: string, content: string }",
          );
        }
        const kind = typeof p.kind === "string" ? p.kind : "fact";
        const source = typeof p.source === "string" ? p.source : "user-stated";
        if (!MEMORY_KINDS.includes(kind as (typeof MEMORY_KINDS)[number])) {
          throw new Error(`kind must be one of: ${MEMORY_KINDS.join(", ")}`);
        }
        if (
          !MEMORY_SOURCES.includes(source as (typeof MEMORY_SOURCES)[number])
        ) {
          throw new Error(
            `source must be one of: ${MEMORY_SOURCES.join(", ")}`,
          );
        }
        return rememberInSession(store, cfg, p.id, {
          kind: kind as (typeof MEMORY_KINDS)[number],
          source: source as (typeof MEMORY_SOURCES)[number],
          content: p.content,
        });
      }
      case "agent/list": {
        return Object.entries(cfg.agents).map(([id, a]) =>
          toAgentSummary(id, a),
        );
      }
      case "agent/create": {
        if (typeof p.id !== "string" || typeof p.name !== "string") {
          throw new Error("agent/create requires { id: string, name: string }");
        }
        const mcp = p.mcp === "inherit" ? "inherit" : "none";
        const explicitWorkspace =
          typeof p.workspace === "string" && p.workspace.length > 0;
        const workspace = explicitWorkspace
          ? (p.workspace as string)
          : join(expandHome(cfg.state_dir), "workspaces", p.id);
        if (explicitWorkspace) {
          mkdirSync(workspace, { recursive: true });
        } else {
          // Only the auto-generated default path gets git-init + README -- an
          // explicitly-chosen workspace is assumed to already be a real repo the agent is
          // being pointed at (see initDefaultWorkspace's own doc comment for why).
          initDefaultWorkspace(workspace, p.name);
        }
        const created = createAgent({
          id: p.id,
          name: p.name,
          workspace,
          persona: typeof p.persona === "string" ? p.persona : undefined,
          model: typeof p.model === "string" ? p.model : undefined,
          tools: Array.isArray(p.tools) ? (p.tools as string[]) : undefined,
          mcp,
        });
        // Splice the new agent into the RUNNING daemon's in-memory config immediately -- cfg
        // is read fresh from a snapshot at most once per tick interval (see crewd.ts's
        // runResident), so without this the agent onboarding just wrote would be invisible to
        // session/new for up to that whole interval.
        cfg.agents[created.id] = created.agent;
        return {
          id: created.id,
          agent: toAgentSummary(created.id, created.agent),
        };
      }
      case "agent/update": {
        if (typeof p.id !== "string") {
          throw new Error("agent/update requires { id: string }");
        }
        if (!cfg.agents[p.id]) throw new Error(`agent "${p.id}" not found`);
        const updated = updateAgent(p.id, {
          model: typeof p.model === "string" ? p.model : undefined,
          tools: Array.isArray(p.tools) ? (p.tools as string[]) : undefined,
          mcp:
            p.mcp === "inherit"
              ? "inherit"
              : p.mcp === "none"
                ? "none"
                : undefined,
          enabled: typeof p.enabled === "boolean" ? p.enabled : undefined,
        });
        // Same reasoning as agent/create above: splice into the running daemon's in-memory
        // config so the change is visible to session/prompt immediately, not next tick.
        cfg.agents[updated.id] = updated.agent;
        return {
          id: updated.id,
          agent: toAgentSummary(updated.id, updated.agent),
        };
      }
      case "skills/index": {
        const overlay =
          typeof p.overlay === "string" && p.overlay.trim().length > 0
            ? p.overlay.trim()
            : process.env.JSTACK_GUSTO_ROOT?.trim() || undefined;
        return { skills: cachedSkillsIndex(findPluginRoot(), overlay) };
      }
      case "status": {
        const stats = store.stats();
        return {
          ...stats,
          enabled: cfg.enabled,
          mode: cfg.mode,
          // Always true when this handler runs at all: only the resident daemon (crewd.ts's
          // runResident) ever calls startRpcServer, so the socket being reachable already
          // implies resident mode -- included explicitly so the desktop app doesn't have to
          // infer it from "the request didn't time out."
          resident: true,
          uptimeMs: Date.now() - startedAt,
          perAgent: store.statsByAgent(),
        };
      }
      case "schedule/create": {
        if (
          typeof p.agentId !== "string" ||
          typeof p.prompt !== "string" ||
          typeof p.cron !== "string"
        ) {
          throw new Error(
            "schedule/create requires { agentId: string, prompt: string, cron: string }",
          );
        }
        if (!cfg.agents[p.agentId]) {
          throw new Error(`agent "${p.agentId}" not found`);
        }
        if (!parseCron(p.cron)) {
          throw new Error(`unparseable cron expression: "${p.cron}"`);
        }
        const id = scheduledPromptId();
        store.createScheduledPrompt({
          id,
          agentId: p.agentId,
          prompt: p.prompt,
          cron: p.cron,
          notifyChannel:
            typeof p.notifyChannel === "string" &&
            p.notifyChannel.trim().length > 0
              ? p.notifyChannel.trim()
              : undefined,
        });
        return { id };
      }
      case "schedule/list": {
        return { schedules: store.listScheduledPrompts() };
      }
      case "schedule/update": {
        if (typeof p.id !== "string" || typeof p.enabled !== "boolean") {
          throw new Error(
            "schedule/update requires { id: string, enabled: boolean }",
          );
        }
        store.setScheduledPromptEnabled(p.id, p.enabled);
        return { ok: true };
      }
      case "schedule/delete": {
        if (typeof p.id !== "string") {
          throw new Error("schedule/delete requires { id: string }");
        }
        store.deleteScheduledPrompt(p.id);
        return { ok: true };
      }
      case "logs/recent": {
        const limit = typeof p.limit === "number" ? p.limit : undefined;
        return { lines: getLogs(limit) };
      }
      case "diagnostics/run": {
        return runDiagnostics(cfg);
      }
      case "integrations/list": {
        return { integrations: listIntegrations(cfg) };
      }
      case "mcp/list": {
        return listMcpServersRaw();
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
  /** Defaults to always answering [] -- one-shot/interval installs have no daemon log buffer
   * to serve (see crewd.ts's runResident, the only caller that supplies a real one). */
  getLogs?: (limit?: number) => string[];
  /** When this RPC server actually started listening, for "status"'s uptimeMs. Defaults to
   * `Date.now()` at call time -- fine for tests/one-off callers that don't care about uptime;
   * runResident passes its own loop-start timestamp so uptime survives across the loop's many
   * iterations rather than resetting each one. */
  startedAt?: number;
}): RpcServerHandle {
  const getLogs = opts.getLogs ?? (() => []);
  const startedAt = opts.startedAt ?? Date.now();
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

  /** `socket.write()` can perform a short write when the payload exceeds the kernel socket
   * buffer -- fine for the small responses (session lists, single-agent objects) every other
   * method here returns, but `skills/index`'s full catalog is tens of KB and was silently
   * truncated before the trailing newline, hanging every caller waiting for a line that would
   * never arrive. Queues whatever didn't fit and flushes it on the `drain` event below instead
   * of assuming one `write()` call always finishes the message. */
  function writeAll(socket: Socket<SocketData>, text: string): void {
    const chunk = Buffer.from(text, "utf8");
    const pending = socket.data.pendingWrite;
    const toWrite = pending ? Buffer.concat([pending, chunk]) : chunk;
    const written = socket.write(toWrite);
    socket.data.pendingWrite =
      written < toWrite.length ? toWrite.subarray(written) : undefined;
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
    writeAll(socket, `${JSON.stringify(body)}\n`);
  }

  /** Which connections are watching which session for live `session/update` pushes --
   * `session/prompt` is still a normal request/response call; this is a SEPARATE, additive
   * channel a connection opts into via `session/subscribe`. A session id can have zero, one, or
   * (in principle) several watchers; a connection is dropped from every session it watched on
   * close (see the `close` socket handler below), never left to leak. */
  const subscribers = new Map<string, Set<Socket<SocketData>>>();

  function subscribeToSession(
    sessionId: string,
    socket: Socket<SocketData>,
  ): void {
    let set = subscribers.get(sessionId);
    if (!set) {
      set = new Set();
      subscribers.set(sessionId, set);
    }
    set.add(socket);
  }

  function unsubscribeSocket(socket: Socket<SocketData>): void {
    for (const set of subscribers.values()) set.delete(socket);
  }

  function broadcastSessionUpdate(
    sessionId: string,
    event: LiveSessionEvent,
  ): void {
    const set = subscribers.get(sessionId);
    if (!set || set.size === 0) return;
    const line = `${JSON.stringify({ method: "session/update", params: { id: sessionId, event } })}\n`;
    for (const socket of set) writeAll(socket, line);
  }

  function handleLine(socket: Socket<SocketData>, line: string): void {
    const req = parseRequest(line);
    if ("error" in req) {
      respond(socket, null, { error: req.error });
      return;
    }
    dispatch(
      opts.getConfig(),
      opts.stateDir,
      req.method,
      req.params,
      getLogs,
      startedAt,
      (sessionId) => subscribeToSession(sessionId, socket),
      broadcastSessionUpdate,
    ).then(
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
      drain(socket) {
        const pending = socket.data.pendingWrite;
        if (!pending) return;
        const written = socket.write(pending);
        socket.data.pendingWrite =
          written < pending.length ? pending.subarray(written) : undefined;
      },
      // Without this, a connection that subscribed to a session and then disappeared (the
      // desktop app closing a watch connection, or crashing) stays in `subscribers` forever --
      // a slow leak, and every future broadcast would pay for a write() to a dead socket.
      close(socket) {
        unsubscribeSocket(socket);
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

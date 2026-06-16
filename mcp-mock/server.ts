#!/usr/bin/env bun
// Stdio MCP fixture server (newline-delimited JSON-RPC): loads tools + canned tool results from scenarios/*/scenario.json.
// Env: JSTACK_MCP_FIXTURE_ROOT (defaults to cwd/mcp-mock), JSTACK_MCP_SCENARIO (default `default`).
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

// Full MCP tool result (advanced); prefer plain strings in scenarios for readability
type McpToolResultPayload = Record<string, unknown>;

type ScenarioResponseValue =
  | string
  | {
      match?: Record<string, unknown>;
      /** Prefer this over wrapping MCP shapes by hand */
      text?: string;
      result?: McpToolResultPayload;
    };

type ScenarioFile = {
  tools?: Array<{
    name: string;
    description?: string;
    /** Omit or leave minimal — hosts still expect JSON Schema; we default to `{}`-properties */
    inputSchema?: Record<string, unknown>;
  }>;
  responses?: Record<string, ScenarioResponseValue>;
};

function fixtureRoot(): string {
  const fromEnv = process.env.JSTACK_MCP_FIXTURE_ROOT?.trim();
  if (fromEnv && fromEnv.length > 0) return resolve(fromEnv);
  const dir = dirname(fileURLToPath(import.meta.url));
  return dir;
}

function scenarioId(): string {
  const s = process.env.JSTACK_MCP_SCENARIO?.trim();
  return s && s.length > 0 ? s : "default";
}

function loadScenario(): ScenarioFile {
  const root = fixtureRoot();
  const sid = scenarioId();
  const scenarioPath = join(root, "scenarios", sid, "scenario.json");
  if (!existsSync(scenarioPath)) {
    return {
      tools: [
        {
          name: "jstack_mock_missing_scenario",
          description: `Scenario file missing: ${scenarioPath}`,
          inputSchema: { type: "object", properties: {} },
        },
      ],
      responses: {
        jstack_mock_missing_scenario: {
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify({ ok: false, error: "missing_scenario_file", path: scenarioPath }),
              },
            ],
            isError: true,
          },
        },
      },
    };
  }
  try {
    const raw = JSON.parse(readFileSync(scenarioPath, "utf8")) as unknown;
    return typeof raw === "object" && raw !== null ? (raw as ScenarioFile) : {};
  } catch {
    return {};
  }
}

const scenario = loadScenario();
const tools =
  Array.isArray(scenario.tools) && scenario.tools.length > 0
    ? scenario.tools
    : [
        {
          name: "echo",
          description: "Echo input as structured content (default scenario fallback)",
          inputSchema: {
            type: "object",
            properties: { message: { type: "string" } },
          },
        },
      ];

const responses = scenario.responses ?? {};

// Turns scenario authoring into MCP text content; wire protocol stays JSON-RPC either way
function coercedToolResult(entry: ScenarioResponseValue | undefined): McpToolResultPayload | null {
  if (entry === undefined) return null;
  if (typeof entry === "string") {
    return { content: [{ type: "text", text: entry }] };
  }
  if (typeof entry === "object" && entry !== null) {
    const o = entry as { text?: string; result?: McpToolResultPayload };
    if (typeof o.result === "object" && o.result !== null) return o.result;
    if (typeof o.text === "string") {
      return { content: [{ type: "text", text: o.text }] };
    }
  }
  return null;
}

function handleCall(name: string, args: Record<string, unknown>): Record<string, unknown> {
  const entry = responses[name];
  const coerced = coercedToolResult(entry);
  if (coerced !== null) return coerced;
  if (name === "echo") {
    return {
      content: [{ type: "text", text: JSON.stringify({ echo: args }) }],
    };
  }
  return {
    content: [{ type: "text", text: JSON.stringify({ error: "no_fixture", tool: name }) }],
    isError: true,
  };
}

function reply(id: string | number | null | undefined, result: unknown): void {
  const msg = JSON.stringify({ jsonrpc: "2.0", id, result });
  process.stdout.write(`${msg}\n`);
}

function notify(method: string, params?: Record<string, unknown>): void {
  const msg = JSON.stringify({ jsonrpc: "2.0", method, params });
  process.stdout.write(`${msg}\n`);
}

function errReply(id: string | number | null | undefined, code: number, message: string): void {
  const msg = JSON.stringify({
    jsonrpc: "2.0",
    id,
    error: { code, message },
  });
  process.stdout.write(`${msg}\n`);
}

async function main(): Promise<void> {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let req: Record<string, unknown>;
    try {
      req = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      continue;
    }
    const id = req.id as string | number | null | undefined;
    const method = String(req.method ?? "");

    if (method === "initialize") {
      reply(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "jstack-mcp-mock", version: "0.1.0" },
      });
      continue;
    }

    if (method === "notifications/initialized") {
      continue;
    }

    if (method === "tools/list") {
      reply(id, {
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description ?? "",
          inputSchema: t.inputSchema ?? { type: "object", properties: {} },
        })),
      });
      continue;
    }

    if (method === "tools/call") {
      const params = (req.params as Record<string, unknown>) ?? {};
      const name = String(params.name ?? "");
      let args: Record<string, unknown> = {};
      const rawArgs = params.arguments;
      if (rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs)) {
        args = rawArgs as Record<string, unknown>;
      }
      const result = handleCall(name, args);
      reply(id, result);
      continue;
    }

    if (method === "ping") {
      reply(id, {});
      continue;
    }

    errReply(id, -32601, `Method not found: ${method}`);
  }
}

main().catch((e) => {
  console.error("[jstack-mcp-mock]", e instanceof Error ? e.stack ?? e.message : String(e));
  process.exitCode = 1;
});

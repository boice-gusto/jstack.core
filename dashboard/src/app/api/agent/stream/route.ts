import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

import type { NextRequest } from "next/server";
import { z } from "zod";

import { AgentMessageSchema, AgentStreamBodySchema } from "@/lib/agent-request-schema";
import { resolveAgentCwd } from "@/lib/agent-cwd";
import { mapStreamJsonLine } from "@/lib/claude-stream-json";
import { loadSkillMarkdownById } from "@/lib/skills-catalog";
import { getDashboardEnv } from "@/server/env";

export const runtime = "nodejs";

function buildPrompt(
  messages: z.infer<typeof AgentMessageSchema>[],
  skillContent: string | undefined,
  systemAddendum: string | undefined,
  expectStructuredJson: boolean,
): string {
  const parts: string[] = [];
  if (systemAddendum !== undefined && systemAddendum.trim().length > 0) {
    parts.push(systemAddendum.trim());
  }
  if (expectStructuredJson) {
    parts.push(
      "Output a single JSON object only (no markdown fences, no prose before or after).",
    );
  }
  const dialogue = messages
    .map((m) => `${m.role.toUpperCase()}:\n${m.content}`)
    .join("\n\n---\n\n");
  const core = parts.length > 0 ? `${parts.join("\n\n")}\n\n---\n\n${dialogue}` : dialogue;
  if (skillContent !== undefined && skillContent.length > 0) {
    return `Follow these skill instructions when responding:\n\n<skill-instructions>\n${skillContent}\n</skill-instructions>\n\n${core}`;
  }
  return core;
}

function sseEncode(obj: Record<string, unknown>): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

export async function POST(request: NextRequest): Promise<Response> {
  let env: ReturnType<typeof getDashboardEnv>;
  try {
    env = getDashboardEnv();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid env";
    return new Response(JSON.stringify({ error: msg }), { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }
  const parsed = AgentStreamBodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Invalid body", details: parsed.error.flatten() }),
      { status: 400 },
    );
  }

  let cwd: string;
  try {
    cwd = resolveAgentCwd(env);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid cwd";
    return new Response(JSON.stringify({ error: msg }), { status: 400 });
  }

  const skillId = parsed.data.skillId?.trim();
  const skill =
    skillId !== undefined && skillId.length > 0 ? loadSkillMarkdownById(skillId) : null;
  if (skillId !== undefined && skillId.length > 0 && skill === null) {
    return new Response(JSON.stringify({ error: `Unknown skillId: ${skillId}` }), {
      status: 400,
    });
  }

  const prompt = buildPrompt(
    parsed.data.messages,
    skill?.content,
    parsed.data.systemAddendum,
    parsed.data.expectStructuredJson === true,
  );

  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? "",
  };

  const args = [
    "-p",
    prompt,
    "--output-format",
    "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--permission-mode",
    env.DASHBOARD_AGENT_PERMISSION_MODE,
  ];
  const child = spawn(env.CLAUDE_BIN, args, {
    cwd,
    env: childEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let bytesOut = 0;
  const maxBuffer = env.DASHBOARD_STREAM_MAX_BUFFER_BYTES;
  const timeoutMs = env.DASHBOARD_AGENT_TIMEOUT_MS;
  const killTimer = setTimeout(() => {
    child.kill("SIGKILL");
  }, timeoutMs);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (obj: Record<string, unknown>): void => {
        controller.enqueue(encoder.encode(sseEncode(obj)));
      };

      send({ type: "start", cwd, skillId: skillId ?? null });

      if (child.stderr !== null) {
        child.stderr.setEncoding("utf8");
        child.stderr.on("data", (chunk: string) => {
          send({ type: "stderr", text: chunk.slice(0, 4000) });
        });
      }

      if (child.stdout === null) {
        clearTimeout(killTimer);
        send({ type: "error", message: "No stdout from claude" });
        controller.close();
        return;
      }

      const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
      rl.on("line", (line: string) => {
        bytesOut += Buffer.byteLength(line, "utf8") + 1;
        if (bytesOut > maxBuffer) {
          child.kill("SIGKILL");
          send({ type: "error", message: "Stream exceeded max buffer" });
          return;
        }
        const events = mapStreamJsonLine(line);
        for (const ev of events) {
          if (ev.kind === "assistant_text") {
            send({ type: "text", text: ev.text });
          } else if (ev.kind === "tool_use") {
            send({ type: "tool_use", name: ev.name, input: ev.input });
          } else if (ev.kind === "result") {
            send({
              type: "result",
              usage: ev.usage,
              total_cost_usd: ev.total_cost_usd,
              result: ev.result,
            });
          } else {
            send({ type: "raw", event: ev.event });
          }
        }
      });

      child.on("error", (err: Error) => {
        send({ type: "error", message: err.message });
      });

      child.on("close", (code: number | null) => {
        clearTimeout(killTimer);
        send({ type: "done", code });
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

import type { NextRequest } from "next/server";
import { z } from "zod";

import { AgentMessageSchema, AgentStreamBodySchema } from "@/lib/agent-request-schema";
import { resolveAgentCwd } from "@/lib/agent-cwd";
import { extractSessionId, mapStreamJsonLine } from "@/lib/claude-stream-json";
import { loadSkillMarkdownById } from "@/lib/skills-catalog";
import { recordDashboardAgentRun } from "@/lib/dashboard-telemetry";
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

  const resumeSessionId = parsed.data.resumeSessionId?.trim();
  const isResuming = resumeSessionId !== undefined && resumeSessionId.length > 0;
  // Resuming: `claude` already holds every prior turn server-side under that session id, so
  // replaying the full transcript back to it would double up history and grow every request with
  // the whole conversation. Send only the newest message; the rest is fetched by the session.
  const messagesForPrompt = isResuming
    ? parsed.data.messages.slice(-1)
    : parsed.data.messages;
  const prompt = buildPrompt(
    messagesForPrompt,
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
    ...(isResuming ? ["--resume", resumeSessionId] : []),
  ];
  const child = spawn(env.CLAUDE_BIN, args, {
    cwd,
    env: childEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const runStartedAt = Date.now();
  const surface = parsed.data.surface ?? "agent";
  let lastUsage: Record<string, number> | null = null;
  let sawErrorEvent: string | undefined;

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

      let sentSessionId = false;
      const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
      rl.on("line", (line: string) => {
        bytesOut += Buffer.byteLength(line, "utf8") + 1;
        if (bytesOut > maxBuffer) {
          child.kill("SIGKILL");
          send({ type: "error", message: "Stream exceeded max buffer" });
          return;
        }
        if (!sentSessionId) {
          const sid = extractSessionId(line);
          if (sid !== null) {
            sentSessionId = true;
            send({ type: "session", sessionId: sid });
          }
        }
        const events = mapStreamJsonLine(line);
        for (const ev of events) {
          if (ev.kind === "assistant_text") {
            send({ type: "text", text: ev.text });
          } else if (ev.kind === "tool_use") {
            send({ type: "tool_use", name: ev.name, input: ev.input });
          } else if (ev.kind === "result") {
            lastUsage = ev.usage;
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

      // Node's docs say a process that fails to even spawn (e.g. bad CLAUDE_BIN) may emit 'error'
      // without 'close' ever following -- there was nothing to close. This code relied on 'close'
      // always firing to clear killTimer/close the stream/record telemetry; under Bun (this repo's
      // runtime) 'close' does still fire after a spawn ENOENT, so no hang was reproduced here, but
      // that's an observed implementation detail, not a documented guarantee `route.ts` (which
      // declares `runtime = "nodejs"`) should depend on. Handle 'error' itself instead of assuming
      // 'close' will clean up after it, and track whether either terminal event already ran so
      // the rarer case where both still fire doesn't double-close the controller or double-record
      // telemetry.
      let finished = false;
      child.on("error", (err: Error) => {
        if (finished) return;
        finished = true;
        sawErrorEvent = err.message;
        send({ type: "error", message: err.message });
        clearTimeout(killTimer);
        recordDashboardAgentRun({
          surface,
          skillId: skillId ?? null,
          startedAt: runStartedAt,
          success: false,
          errorType: sawErrorEvent,
          usage: lastUsage,
        });
        controller.close();
      });

      child.on("close", (code: number | null) => {
        if (finished) return;
        finished = true;
        clearTimeout(killTimer);
        recordDashboardAgentRun({
          surface,
          skillId: skillId ?? null,
          startedAt: runStartedAt,
          success: sawErrorEvent === undefined && code === 0,
          errorType: sawErrorEvent ?? (code !== 0 ? `exit_${code}` : undefined),
          usage: lastUsage,
        });
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

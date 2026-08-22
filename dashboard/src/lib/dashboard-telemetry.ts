import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { ENCODING_UTF8 } from "@jstack/constants/paths";
import {
  clearBuffer,
  recordEvent,
  snapshotBuffer,
} from "@jstack/telemetry/collector";
import { telemetryInstanceHash16 } from "@jstack/telemetry/instance-id";
import type { TelemetryEvent } from "@jstack/telemetry/schema";

import { getJstackCoreRoot } from "@/server/env";
import { readJstackConfig } from "./config-reader";

/**
 * Every `/api/agent/stream` run spawns a real `claude -p` child with real token/dollar cost, but
 * nothing recorded that anywhere -- `telemetry/collector.ts`'s `recordEvent()` had zero callers in
 * this codebase (see `telemetry/cli.ts`'s own `RECORDING_WIRED_UP = false`). The dashboard is the
 * one long-running process in this repo (unlike the CLI, which is a fresh process per invocation
 * and so could never usefully hold telemetry/cli.ts's in-memory buffer across calls) -- it's the
 * natural first real caller.
 */

/**
 * NOT `@jstack/telemetry/sender`'s `sendBatch`, despite doing the exact same POST -- reached via
 * the `@jstack/*` alias, Turbopack fails to resolve sender.ts's OWN `.js`-suffixed relative
 * imports (`./schema.js`, `./instance-id.js`) with "Module not found," confirmed live against the
 * running dashboard (`bun run typecheck:dashboard` passes fine; this is a bundler-resolution gap,
 * not a type error). `collector.ts` and `instance-id.ts` both cross the same alias boundary
 * successfully because neither has a *runtime* (non-type-only) relative import of its own to
 * resolve -- `collector.ts`'s only sibling import is `import type`, erased before Turbopack ever
 * sees it, and `instance-id.ts` imports nothing but Node builtins. This ~10-line duplicate of
 * `sendBatch` avoids the one import shape (`sender.ts`) that doesn't survive the crossing.
 */
async function sendBatch(
  endpoint: string,
  events: TelemetryEvent[],
): Promise<boolean> {
  const batch = {
    batch_id: randomUUID(),
    sent_at: new Date().toISOString(),
    instance_hash: telemetryInstanceHash16(),
    events,
  };
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(batch),
  }).catch(() => null);
  return !!res && res.ok;
}

let cachedVersion: string | null = null;

function readPluginVersion(): string {
  if (cachedVersion !== null) return cachedVersion;
  try {
    const p = join(getJstackCoreRoot(), "VERSION");
    cachedVersion = existsSync(p) ? readFileSync(p, ENCODING_UTF8).trim() : "unknown";
  } catch {
    cachedVersion = "unknown";
  }
  return cachedVersion;
}

export interface DashboardRunTelemetryInput {
  surface: "agent" | "wizard";
  skillId: string | null;
  startedAt: number;
  success: boolean;
  errorType?: string;
  usage: Record<string, number> | null;
}

/**
 * Record one dashboard agent/wizard run and, if telemetry is enabled with an endpoint configured
 * in `jstack.config.json`, flush immediately -- mirroring the same enabled+endpoint gate and
 * immediate-flush shape `telemetry/cli.ts`'s `flush` action already uses, just triggered by a
 * real event instead of a manual CLI invocation. Never throws: a telemetry failure must not affect
 * the agent run that triggered it.
 */
export function recordDashboardAgentRun(input: DashboardRunTelemetryInput): void {
  try {
    const tokenInput =
      (input.usage?.input_tokens ?? 0) +
      (input.usage?.cache_creation_input_tokens ?? 0) +
      (input.usage?.cache_read_input_tokens ?? 0);
    const tokenOutput = input.usage?.output_tokens ?? 0;

    recordEvent({
      timestamp: new Date().toISOString(),
      plugin_version: readPluginVersion(),
      skill_name: input.skillId ?? `dashboard-${input.surface}`,
      skill_category: "dashboard",
      token_input: tokenInput,
      token_output: tokenOutput,
      token_total: tokenInput + tokenOutput,
      latency_ms: Math.max(0, Date.now() - input.startedAt),
      success: input.success,
      error_type: input.errorType,
    });
  } catch {
    return;
  }

  void flushIfConfigured();
}

async function flushIfConfigured(): Promise<void> {
  try {
    const cfg = readJstackConfig(process.cwd()) as {
      telemetry?: { enabled?: boolean; endpoint?: string };
    } | null;
    const enabled = cfg?.telemetry?.enabled === true;
    const endpoint =
      typeof cfg?.telemetry?.endpoint === "string" ? cfg.telemetry.endpoint.trim() : "";
    if (!enabled || endpoint.length === 0) return;
    const events = snapshotBuffer();
    if (events.length === 0) return;
    clearBuffer();
    await sendBatch(endpoint, events);
  } catch {
    // Best-effort: a flush failure (unreachable endpoint, bad config) must never surface to
    // the agent run that generated the event it was trying to send.
  }
}

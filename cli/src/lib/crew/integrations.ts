import { listMcpServersRaw } from "./mcp.js";
import { sendMessage } from "./slack.js";
import type { CrewConfig } from "./types.js";

/**
 * "Integrations": a small, deliberately generic pattern for things jstack can push to or read
 * from outside itself, distinct from an agent's own tools. The first (and so far only) one is
 * Slack DM -- crew's existing ingress/egress machinery (slack.ts, guards.ts) already IS this
 * integration for the reply flow; what's new here is (1) a standardized outbound "notification"
 * template distinct from a normal threaded reply, for agent-INITIATED pushes (scheduled prompts
 * today; a future integration could reuse it too), and (2) a status check the desktop app's
 * Integrations tab can show, since "is this even wired up" was previously answerable only by
 * reading jstack.config.json and running `claude mcp list` by hand.
 */

/** "🤖 - Here's your update - sent by jstack" -- a single-line, agent-initiated push, distinct
 * from `identityPrefix()`'s multi-line threaded-reply format (name, body, cost footer). Reusable
 * by any future integration that needs to notify rather than reply. */
export function formatJstackNotification(
  emoji: string,
  message: string,
): string {
  return `${emoji} - ${message} - sent by jstack`;
}

export async function sendJstackSlackNotification(
  channelId: string,
  emoji: string,
  message: string,
): Promise<{ ok: boolean; error?: string }> {
  const r = await sendMessage(
    channelId,
    formatJstackNotification(emoji, message),
  );
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export interface IntegrationSummary {
  id: string;
  name: string;
  description: string;
  /** crew.enabled plus a non-empty ingress channel+author scope -- the same "is this actually
   * pointed at something" bar `jstackc crew doctor` uses, just phrased for this UI. */
  configured: boolean;
  /** Whether `claude mcp list` (the same mechanism slack.ts's sendMessage/readChannel already
   * spawn `claude` to use) reports a Slack-named MCP server. */
  mcpAvailable: boolean;
  mcpDetail?: string;
}

export function listIntegrations(cfg: CrewConfig): IntegrationSummary[] {
  const mcp = listMcpServersRaw();
  const mcpAvailable = mcp.ok && mcp.servers.some((s) => /slack/i.test(s));
  const mcpDetail = mcp.ok ? mcp.raw.slice(0, 500) : mcp.error;

  const configured =
    cfg.enabled &&
    cfg.policy.ingress.channels.length > 0 &&
    cfg.policy.ingress.authors.length > 0;

  return [
    {
      id: "slack-dm",
      name: "Slack DM",
      description:
        'Agents can monitor your personal Slack DM (crew\'s existing ingress policy) and reply there, or push a result to you as "[emoji] - message - sent by jstack" -- e.g. from a scheduled prompt.',
      configured,
      mcpAvailable,
      mcpDetail,
    },
  ];
}

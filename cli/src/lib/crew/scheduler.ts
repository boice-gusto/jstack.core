import { sendJstackSlackNotification } from "./integrations.js";
import { isCheckDue } from "./proactive.js";
import { createManualSession, promptManualSession } from "./session.js";
import type { CrewStore } from "./store.js";
import type { CrewConfig } from "./types.js";

/**
 * Desktop-app-only scheduled prompts: unlike Slack proactive checks (fixed prompt + channel,
 * CLI-managed), these are created from the desktop app and re-run a manual session's message on
 * a cron interval. Evaluated once per resident-daemon loop iteration (see crewd.ts's
 * runResident) using the SAME due-check logic proactive checks already use (`isCheckDue`), so
 * a daemon restart or a missed interval behaves identically: it fires once for the most recent
 * due slot, not once per missed slot.
 */
export function scheduledPromptId(): string {
  return `sch-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Evaluates every scheduled prompt against `nowMs` and runs whichever are due, lazily creating
 * a dedicated session per schedule on its first run (so the conversation accumulates context
 * across runs, the same way a person's own recurring chat would). A disabled agent or a session
 * creation failure is recorded as a failed run rather than thrown -- one broken schedule must
 * never stop the rest of this tick's due schedules from running, since this is called from the
 * resident daemon's main loop, not a request/response path with its own error boundary.
 */
export async function runDueScheduledPrompts(
  store: CrewStore,
  cfg: CrewConfig,
  nowMs: number,
): Promise<Array<{ id: string; ran: boolean; ok?: boolean; reason?: string }>> {
  const results: Array<{
    id: string;
    ran: boolean;
    ok?: boolean;
    reason?: string;
  }> = [];
  for (const row of store.listScheduledPrompts()) {
    if (!row.enabled) {
      results.push({ id: row.id, ran: false, reason: "disabled" });
      continue;
    }
    const due = isCheckDue(row.cron, row.lastEvaluatedMs, nowMs);
    if (!due.due) {
      results.push({ id: row.id, ran: false, reason: due.reason });
      continue;
    }

    try {
      let sessionId = row.sessionId;
      if (!sessionId) {
        const created = createManualSession(store, cfg, row.agentId);
        sessionId = created.id;
        // Persisted immediately, separately from the run outcome below -- if promptManualSession
        // throws, the schedule must still remember the session it just created, or every future
        // due run would leak a brand-new session instead of resuming this one.
        store.recordScheduledPromptRun(row.id, {
          sessionId,
          lastEvaluatedMs: nowMs,
        });
      }
      const result = await promptManualSession(
        store,
        cfg,
        sessionId,
        row.prompt,
      );
      store.recordScheduledPromptRun(row.id, {
        lastEvaluatedMs: nowMs,
        ranAt: nowMs,
        ok: result.ok,
      });

      let notifyFailure: string | undefined;
      if (result.ok && row.notifyChannel) {
        // Best-effort, and deliberately doesn't affect the run's own ok/reason above -- the
        // prompt itself succeeded whether or not the Slack push does. cfg.agents[row.agentId]
        // is guaranteed present here: requireEnabledAgent (inside createManualSession/
        // promptManualSession above) would already have thrown if it weren't.
        const emoji = cfg.agents[row.agentId]?.emoji ?? ":robot_face:";
        const sent = await sendJstackSlackNotification(
          row.notifyChannel,
          emoji,
          result.text,
        );
        if (!sent.ok) notifyFailure = sent.error ?? "notify failed";
      }

      results.push({
        id: row.id,
        ran: true,
        ok: result.ok,
        ...(notifyFailure ? { reason: `notify failed: ${notifyFailure}` } : {}),
      });
    } catch (e) {
      store.recordScheduledPromptRun(row.id, {
        lastEvaluatedMs: nowMs,
        ranAt: nowMs,
        ok: false,
      });
      results.push({
        id: row.id,
        ran: true,
        ok: false,
        reason: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return results;
}

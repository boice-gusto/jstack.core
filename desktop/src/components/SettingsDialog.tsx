import { useEffect, useState } from "react";
import { daemonStatus, recentLogs, type DaemonStatus } from "../lib/agent";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { SettingsIcon } from "lucide-react";

/** How often the debug panel polls logs/recent while open. The RPC transport has no
 * push/streaming, so "live" here means "refreshed on this interval," not truly real-time. */
const LOG_POLL_MS = 3000;

/**
 * Daemon status, a manual refresh, and the debug log tail -- all diagnostic/operational, not
 * things you look at while chatting. Moved behind a gear icon into a modal (was three
 * always-visible sidebar sections) so the sidebar is just sessions, the thing you actually
 * interact with most.
 */
export function SettingsDialog({ onRefresh }: { onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<DaemonStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [logError, setLogError] = useState<string | null>(null);

  async function refreshStatus(): Promise<void> {
    try {
      setStatus(await daemonStatus());
      setStatusError(null);
    } catch (e) {
      console.error("[jstack] daemonStatus failed:", e);
      setStatusError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    if (open) refreshStatus();
  }, [open]);

  useEffect(() => {
    if (!showDebug) return;
    let cancelled = false;
    const poll = async (): Promise<void> => {
      try {
        const { lines } = await recentLogs();
        if (!cancelled) {
          setLogLines(lines);
          setLogError(null);
        }
      } catch (e) {
        console.error("[jstack] recentLogs failed:", e);
        if (!cancelled) setLogError(e instanceof Error ? e.message : String(e));
      }
    };
    poll();
    const interval = setInterval(poll, LOG_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [showDebug]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant="ghost" size="icon" title="Settings">
            <SettingsIcon className="size-4" />
          </Button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div aria-label="daemon status">
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Status</h3>
          {statusError && <p className="mb-2 text-sm text-destructive">{statusError}</p>}
          {status && (
            <ul className="mb-2 flex flex-col gap-0.5 text-xs text-muted-foreground">
              <li>enabled: {String(status.enabled)}</li>
              <li>mode: {status.mode}</li>
              <li>tasks: {status.tasks}</li>
              <li>spent today: ${status.spentToday.toFixed(4)}</li>
            </ul>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              refreshStatus();
              onRefresh();
            }}
          >
            Refresh
          </Button>
        </div>

        <div aria-label="debug logs" className="mt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowDebug((v) => !v)}
          >
            {showDebug ? "Hide debug logs" : "Show debug logs"}
          </Button>
          {showDebug && (
            <>
              {logError && <p className="mt-2 text-sm text-destructive">{logError}</p>}
              <ul className="mt-2 max-h-60 overflow-y-auto rounded-md bg-muted p-2 font-mono text-xs break-all">
                {logLines.length === 0 && (
                  <li className="text-muted-foreground">No log lines yet</li>
                )}
                {logLines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

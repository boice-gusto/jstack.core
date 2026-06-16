"use client";

import { useCallback, useMemo, useState, type ReactElement } from "react";

import { Button } from "@/components/ui/button";
import type { AgentStreamEvent } from "@/stores/chat-store";

const DEFAULT_PREVIEW = 60;

function prettyJson(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

export function StreamDebugPanel({
  events,
  title = "Raw stream events",
  maxPreview = DEFAULT_PREVIEW,
}: {
  events: AgentStreamEvent[];
  title?: string;
  maxPreview?: number;
}): ReactElement {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  const slice = useMemo(() => {
    if (events.length <= maxPreview) {
      return events;
    }
    return events.slice(-maxPreview);
  }, [events, maxPreview]);

  const omitted = events.length - slice.length;

  const copyVisible = useCallback(async (): Promise<void> => {
    const text = slice.map((ev) => prettyJson(ev)).join("\n\n---\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 2500);
    }
  }, [slice]);

  return (
    <div
      role="region"
      aria-label={title}
      className="flex min-h-0 flex-col rounded-lg border border-border bg-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
          <p className="m-0 mt-0.5 text-[0.7rem] text-muted-foreground">
            Last {slice.length} SSE payloads (newest at bottom). For debugging Claude stream-json mapping.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 text-xs"
          disabled={slice.length === 0}
          onClick={() => void copyVisible()}
        >
          {copyState === "copied" ? "Copied" : copyState === "error" ? "Copy failed" : "Copy visible"}
        </Button>
      </div>
      <details className="group min-h-0">
        <summary className="cursor-pointer select-none border-b border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/40">
          {events.length === 0 ? "No events yet" : `${events.length} event${events.length === 1 ? "" : "s"}`}
          {omitted > 0 ? ` · showing last ${slice.length}` : ""}
        </summary>
        <div className="max-h-[min(40vh,18rem)] overflow-y-auto p-2 font-mono text-[0.65rem] leading-relaxed text-muted-foreground">
          {slice.map((ev, i) => {
            const globalIdx = events.length - slice.length + i;
            return (
              <pre
                key={globalIdx}
                className="mb-2 whitespace-pre-wrap break-all rounded border border-border/60 bg-muted/20 p-2 last:mb-0"
              >
                {prettyJson(ev)}
              </pre>
            );
          })}
        </div>
      </details>
    </div>
  );
}

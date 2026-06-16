"use client";

import type { ReactElement } from "react";

import type { AgentRunContext } from "@/stores/chat-store";
import { cn } from "@/lib/utils";

export function AgentRunContextStrip({
  context,
  connecting = false,
  className,
}: {
  context: AgentRunContext | null;
  /** True while a run is in flight but the server has not yet sent the `start` event. */
  connecting?: boolean;
  className?: string;
}): ReactElement {
  if (context === null) {
    const message = connecting
      ? "Waiting for session: cwd and resolved skill id appear when the stream starts."
      : "Run the agent once to see the server working directory and the skill id the API used.";
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "rounded-md border border-dashed border-border bg-muted/20 px-3 py-2 text-[0.7rem] text-muted-foreground",
          className,
        )}
      >
        <div className="font-semibold uppercase tracking-wide text-foreground/70">Session</div>
        <p className="m-0 mt-1 leading-snug">{message}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-md border border-border bg-muted/30 px-3 py-2 text-[0.7rem] text-muted-foreground",
        className,
      )}
    >
      <div className="font-semibold uppercase tracking-wide text-foreground/80">Session</div>
      <div className="mt-1 grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-x-3">
        <span className="text-muted-foreground">cwd</span>
        <code className="truncate text-foreground" title={context.cwd}>
          {context.cwd}
        </code>
        <span className="text-muted-foreground">skill</span>
        <span className="truncate text-foreground">
          {context.skillId === null || context.skillId.length === 0 ? "—" : context.skillId}
        </span>
      </div>
    </div>
  );
}

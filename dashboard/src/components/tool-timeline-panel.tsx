"use client";

import { useState, type ReactElement } from "react";

import { Button } from "@/components/ui/button";

export type ToolTimelineItem = { id: string; name: string; input: unknown };

export function ToolTimelinePanel({
  tools,
  title = "Tools & skills",
}: {
  tools: ToolTimelineItem[];
  title?: string;
}): ReactElement {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copyInput(toolId: string, input: unknown): Promise<void> {
    const text = JSON.stringify(input, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(toolId);
      window.setTimeout(() => {
        setCopiedId((cur) => (cur === toolId ? null : cur));
      }, 2000);
    } catch {
      setCopiedId(null);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-border bg-card">
      <div className="border-b border-border px-3 py-2">
        <h2 className="m-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
        <p className="m-0 mt-0.5 text-[0.7rem] text-muted-foreground">
          Streamed tool_use events from the agent run. Expand to read JSON; copy for logs or tickets.
        </p>
      </div>
      <ul className="m-0 max-h-[min(60vh,28rem)] list-none space-y-2 overflow-y-auto p-3">
        {tools.length === 0 ? (
          <li className="text-sm text-muted-foreground">No tool events yet.</li>
        ) : (
          tools.map((t) => (
            <li key={t.id} className="rounded-md border border-border bg-background text-xs">
              <details className="group">
                <summary className="cursor-pointer select-none px-2 py-2 font-mono font-medium text-foreground hover:bg-muted/30">
                  {t.name}
                </summary>
                <div className="border-t border-border px-2 pb-2">
                  <div className="flex justify-end pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[0.65rem]"
                      onClick={() => void copyInput(t.id, t.input)}
                    >
                      {copiedId === t.id ? "Copied" : "Copy JSON"}
                    </Button>
                  </div>
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all text-[0.65rem] text-muted-foreground">
                    {JSON.stringify(t.input, null, 2)}
                  </pre>
                </div>
              </details>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

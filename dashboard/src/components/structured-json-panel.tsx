"use client";

import { useMemo, useState } from "react";
import type { ReactElement } from "react";

import {
  parseStructuredJsonText,
  validateStructuredEnvelope,
} from "@/lib/structured-json";

function shallowRows(obj: Record<string, unknown>): { key: string; value: string }[] {
  return Object.entries(obj).map(([key, value]) => ({
    key,
    value:
      typeof value === "string" || typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : JSON.stringify(value),
  }));
}

export function StructuredJsonPanel({
  text,
  title = "Structured output",
}: {
  text: string | null;
  title?: string;
}): ReactElement {
  const [tab, setTab] = useState<"rendered" | "raw">("rendered");

  const parsed = useMemo(() => {
    if (text === null || text.trim().length === 0) {
      return { ok: false as const, error: "No structured JSON yet." };
    }
    return parseStructuredJsonText(text);
  }, [text]);

  const envelope = useMemo(() => {
    if (!parsed.ok) return null;
    return validateStructuredEnvelope(parsed.value);
  }, [parsed]);

  if (text === null || text.trim().length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
        <p className="m-0 mt-2">Enable “Expect structured JSON” and run the agent to populate this panel.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <h2 className="m-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
        <div className="flex gap-1">
          <button
            type="button"
            className={`rounded-md px-2 py-1 text-xs font-medium ${
              tab === "rendered"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
            onClick={() => setTab("rendered")}
          >
            Rendered
          </button>
          <button
            type="button"
            className={`rounded-md px-2 py-1 text-xs font-medium ${
              tab === "raw" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
            onClick={() => setTab("raw")}
          >
            Raw JSON
          </button>
        </div>
      </div>
      <div className="p-3">
        {!parsed.ok ? (
          <p className="m-0 text-sm text-destructive">Parse error: {parsed.error}</p>
        ) : tab === "raw" ? (
          <pre className="m-0 max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-foreground">
            {JSON.stringify(parsed.value, null, 2)}
          </pre>
        ) : envelope !== null && envelope.ok ? (
          <div className="space-y-2 text-sm">
            <p className="m-0 text-xs text-muted-foreground">
              Envelope: <span className="font-mono text-foreground">{envelope.data.type}</span> v{" "}
              <span className="font-mono text-foreground">{envelope.data.version}</span>
            </p>
            <table className="w-full border-collapse text-xs">
              <tbody>
                {shallowRows(envelope.data as Record<string, unknown>).map((row) => (
                  <tr key={row.key} className="border-b border-border last:border-0">
                    <td className="py-1 pr-2 align-top font-medium text-muted-foreground">{row.key}</td>
                    <td className="py-1 font-mono text-foreground">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : envelope !== null && !envelope.ok ? (
          <div className="space-y-2 text-sm">
            <p className="m-0 text-xs text-amber-600 dark:text-amber-500">
              Parsed JSON but not a type/version envelope: {envelope.error}
            </p>
            <pre className="m-0 max-h-48 overflow-auto font-mono text-xs">{text}</pre>
          </div>
        ) : (
          <pre className="m-0 max-h-64 overflow-auto font-mono text-xs">{text}</pre>
        )}
      </div>
    </div>
  );
}

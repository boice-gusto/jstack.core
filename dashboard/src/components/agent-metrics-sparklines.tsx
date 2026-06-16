"use client";

import type { ReactElement } from "react";
import { Sparklines, SparklinesLine } from "react-sparklines";

function MiniChart({
  label,
  data,
  color,
}: {
  label: string;
  data: number[];
  color: string;
}): ReactElement {
  const hasData = data.length > 0;
  return (
    <div className="rounded-md border border-border bg-card px-2 py-2">
      <div className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      {hasData ? (
        <Sparklines data={data} width={140} height={36} margin={2}>
          <SparklinesLine style={{ stroke: color, fill: "none", strokeWidth: 1.5 }} />
        </Sparklines>
      ) : (
        <div className="flex h-9 items-center text-xs text-muted-foreground">No runs yet</div>
      )}
      {hasData ? (
        <div className="font-mono text-[0.65rem] text-muted-foreground">
          Last:{" "}
          {typeof data[data.length - 1] === "number"
            ? (data[data.length - 1] as number).toFixed(4)
            : "—"}
        </div>
      ) : null}
    </div>
  );
}

export function AgentMetricsSparklines({
  costSeries,
  tokenSeries,
}: {
  costSeries: number[];
  tokenSeries: number[];
}): ReactElement {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <MiniChart label="Total cost (USD)" data={costSeries} color="hsl(var(--primary))" />
      <MiniChart label="Token usage (sum)" data={tokenSeries} color="hsl(142 76% 36%)" />
    </div>
  );
}

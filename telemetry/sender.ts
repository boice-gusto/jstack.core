import { randomUUID } from "node:crypto";
import type { TelemetryBatch, TelemetryEvent } from "./schema.js";
import { TelemetryBatchSchema } from "./schema.js";
import { telemetryInstanceHash16 } from "./instance-id.js";

export async function sendBatch(
  endpoint: string | undefined,
  events: TelemetryEvent[],
): Promise<boolean> {
  if (!endpoint) {
    console.error("[telemetry] No endpoint configured; skipping send.");
    return false;
  }
  const batch: TelemetryBatch = {
    batch_id: randomUUID(),
    sent_at: new Date().toISOString(),
    instance_hash: telemetryInstanceHash16(),
    events,
  };
  TelemetryBatchSchema.parse(batch);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(batch),
  }).catch(() => null);
  return !!res && res.ok;
}

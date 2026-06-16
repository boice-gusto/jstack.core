import { randomUUID } from "node:crypto";
import type { TelemetryEvent } from "./schema.js";

const buffer: TelemetryEvent[] = [];
let maxSize = 1000;

export function setMaxBuffer(n: number): void {
  maxSize = n;
}

export function recordEvent(ev: Omit<TelemetryEvent, "event_id"> & { event_id?: string }): void {
  const full: TelemetryEvent = {
    ...ev,
    event_id: ev.event_id ?? randomUUID(),
  };
  buffer.push(full);
  if (buffer.length > maxSize) buffer.splice(0, buffer.length - maxSize);
}

export function snapshotBuffer(): TelemetryEvent[] {
  return [...buffer];
}

export function clearBuffer(): void {
  buffer.length = 0;
}

export function bufferSize(): number {
  return buffer.length;
}

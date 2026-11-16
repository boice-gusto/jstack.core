import { randomUUID } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { TelemetryEvent } from "./schema.js";

const buffer: TelemetryEvent[] = [];
let maxSize = 1000;

export function setMaxBuffer(n: number): void {
  maxSize = n;
}

/**
 * Where events durably accumulate across process boundaries. The in-memory `buffer` below dies
 * every process exit -- every `jstack` invocation is a fresh `bun` process, so an in-memory-only
 * buffer can never hold anything by the time a later `jstack telemetry flush` runs. This file is
 * the actual buffer `flush`/`status`/`reset` operate on. `JSTACK_TELEMETRY_BUFFER_PATH` lets
 * tests point it at a temp file instead of the real machine-wide `~/.jstack/` path.
 */
function persistedBufferPath(): string {
  return (
    process.env.JSTACK_TELEMETRY_BUFFER_PATH ??
    join(homedir(), ".jstack", "telemetry-buffer.jsonl")
  );
}

/** Appends one event as a JSONL line. Never throws -- a telemetry write failure must not break
 * whatever real command triggered it. */
export function appendPersisted(event: TelemetryEvent): void {
  try {
    const path = persistedBufferPath();
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${JSON.stringify(event)}\n`, "utf8");
  } catch {
    // Telemetry is best-effort; a write failure here must never surface to the caller.
  }
}

/** Reads every event currently persisted, skipping any line that isn't valid JSON (a partial
 * write from a killed process) rather than failing the whole read. */
export function readPersisted(): TelemetryEvent[] {
  const path = persistedBufferPath();
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, "utf8").split("\n").filter(Boolean);
  const events: TelemetryEvent[] = [];
  for (const line of lines) {
    try {
      events.push(JSON.parse(line) as TelemetryEvent);
    } catch {
      // Skip a malformed line rather than losing the rest of the buffer.
    }
  }
  return events;
}

export function clearPersisted(): void {
  const path = persistedBufferPath();
  if (existsSync(path)) writeFileSync(path, "", "utf8");
}

/**
 * Atomically claims whatever is currently in the persisted buffer for a flush, closing the race
 * `readPersisted()` + `clearPersisted()` had: a concurrent `appendPersisted()` landing between
 * the read and the truncate was silently wiped by the truncate without ever being read or sent.
 * `renameSync` is atomic at the filesystem level, so any `appendPersisted()` call that happens
 * after this returns necessarily creates a fresh file at the live path -- it physically cannot
 * land in the file this call is now holding under a private name. Returns the events already
 * read out of the claimed file, plus `commit()` to delete that file once the caller is done with
 * it (called unconditionally by `flush`, mirroring the old unconditional `clearPersisted()` --
 * this only removes the race, it doesn't change when the buffer gets cleared).
 */
export function claimPersisted(): {
  events: TelemetryEvent[];
  commit: () => void;
} {
  const path = persistedBufferPath();
  const claimedPath = `${path}.flushing-${randomUUID()}`;
  try {
    renameSync(path, claimedPath);
  } catch {
    // Nothing to claim (file doesn't exist), or another flush already claimed it.
    return { events: [], commit: () => {} };
  }
  const lines = readFileSync(claimedPath, "utf8").split("\n").filter(Boolean);
  const events: TelemetryEvent[] = [];
  for (const line of lines) {
    try {
      events.push(JSON.parse(line) as TelemetryEvent);
    } catch {
      // Skip a malformed line rather than losing the rest of the claimed buffer.
    }
  }
  return {
    events,
    commit: () => {
      try {
        unlinkSync(claimedPath);
      } catch {
        // Best-effort cleanup of the claimed temp file; nothing downstream depends on it existing.
      }
    },
  };
}

/**
 * Records one event: pushes to this process's in-memory buffer (see `snapshotBuffer` below, used
 * by same-process tests and any in-process reporting) AND appends it to the persisted buffer, so
 * a real caller's event survives past this process's exit for a later `flush`/`status` to see.
 */
export function recordEvent(
  ev: Omit<TelemetryEvent, "event_id"> & { event_id?: string },
): void {
  const full: TelemetryEvent = {
    ...ev,
    event_id: ev.event_id ?? randomUUID(),
  };
  buffer.push(full);
  if (buffer.length > maxSize) buffer.splice(0, buffer.length - maxSize);
  appendPersisted(full);
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

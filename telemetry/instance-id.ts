import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const INSTANCE_FILE = ".jstack/telemetry-instance-id";

function instancePath(): string {
  return join(homedir(), INSTANCE_FILE);
}

/**
 * Persistent random UUID stored only on this machine (~/.jstack/telemetry-instance-id).
 * Never sent raw — receivers see only {@link telemetryInstanceHash16}.
 */
export function getTelemetryInstanceId(): string {
  const path = instancePath();
  if (existsSync(path)) {
    const raw = readFileSync(path, "utf8").trim();
    if (raw.length >= 16) return raw;
  }
  const id = randomUUID();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${id}\n`, "utf8");
  return id;
}

/** Short opaque hash for batch payloads — no PII (not username, cwd, or hostname). */
export function telemetryInstanceHash16(): string {
  return createHash("sha256").update(getTelemetryInstanceId(), "utf8").digest("hex").slice(0, 16);
}

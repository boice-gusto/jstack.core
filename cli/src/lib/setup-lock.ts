import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Cooperative lock for the setup wizard. Prevents two concurrent
 * `jstack setup` runs from racing on jstack.config.json.
 *
 * Stale-lock policy: if the lockfile's pid is not running, we steal it
 * with a warning. Locks older than STALE_AFTER_MS are also considered
 * stale (for the case where pid recycled to a different process).
 */

export const STALE_AFTER_MS = 30 * 60 * 1000; // 30 minutes

export type LockFile = {
  pid: number;
  started_at: string; // ISO
  command: string; // e.g. "jstack setup --schema"
  hostname?: string;
};

function lockPath(projectRoot: string): string {
  return join(projectRoot, ".jstack", "setup.lock");
}

function isPidAlive(pid: number): boolean {
  try {
    // Sending signal 0 doesn't actually deliver a signal; it just checks.
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export type AcquireResult =
  | { ok: true; release: () => void; stoleStale?: LockFile }
  | { ok: false; existing: LockFile };

/**
 * Try to acquire the setup lock. Returns either {ok:true, release} or
 * {ok:false, existing} so callers can decide how to surface the conflict.
 *
 * Steal semantics: if the existing lock's pid is not running, OR the
 * lock is older than STALE_AFTER_MS, we overwrite it and return ok:true
 * with stoleStale set so the caller can warn the user.
 */
export function acquireSetupLock(projectRoot: string, command: string): AcquireResult {
  const dir = join(projectRoot, ".jstack");
  mkdirSync(dir, { recursive: true });
  const path = lockPath(projectRoot);

  if (existsSync(path)) {
    let existing: LockFile;
    try {
      existing = JSON.parse(readFileSync(path, "utf8")) as LockFile;
    } catch {
      // Corrupt lockfile — treat as stale.
      writeLock(path, command);
      return { ok: true, release: () => releaseLock(path) };
    }

    const stale =
      !isPidAlive(existing.pid) ||
      Date.now() - new Date(existing.started_at).getTime() > STALE_AFTER_MS;

    if (stale) {
      writeLock(path, command);
      return { ok: true, release: () => releaseLock(path), stoleStale: existing };
    }
    return { ok: false, existing };
  }

  writeLock(path, command);
  return { ok: true, release: () => releaseLock(path) };
}

function writeLock(path: string, command: string): void {
  const lf: LockFile = {
    pid: process.pid,
    started_at: new Date().toISOString(),
    command,
    hostname: process.env.HOSTNAME ?? undefined,
  };
  writeFileSync(path, JSON.stringify(lf, null, 2) + "\n", "utf8");
}

function releaseLock(path: string): void {
  if (existsSync(path)) {
    try {
      unlinkSync(path);
    } catch {
      // Best-effort: if unlink fails, we leave the file. Next run will
      // detect the dead pid and steal the lock.
    }
  }
}

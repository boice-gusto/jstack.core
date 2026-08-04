import { isAbsolute, relative, resolve } from "node:path";

// Keys that let an attacker walk off a plain object onto Object.prototype (or, for
// "constructor", the Function/Object constructor itself). `path` here can come
// straight from a user-supplied `--apply-repairs <file>` JSON, so it must never be
// trusted to stay inside the object it looks like it's targeting.
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);

/** Set a value at a nested path inside `obj`, creating intermediate plain objects. */
export function setAt(
  obj: Record<string, unknown>,
  path: string[],
  value: unknown,
): void {
  if (path.length === 0) return;
  for (const seg of path) {
    if (DANGEROUS_KEYS.has(seg)) {
      throw new Error(
        `setAt: refusing to traverse dangerous key "${seg}" in path ${JSON.stringify(path)}`,
      );
    }
  }
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const seg = path[i] as string;
    const next = cur[seg];
    if (next && typeof next === "object" && !Array.isArray(next)) {
      cur = next as Record<string, unknown>;
    } else {
      const fresh: Record<string, unknown> = {};
      cur[seg] = fresh;
      cur = fresh;
    }
  }
  cur[path[path.length - 1] as string] = value;
}

/**
 * Resolve `target` to an absolute path and verify it stays within at least one of
 * `roots` (or equals a root exactly). Returns the resolved absolute path, or `null`
 * if `target` escapes every root — e.g. via `../` traversal, or by being an
 * unrelated absolute path.
 *
 * Used to contain filesystem writes driven by config- or user-supplied paths (doctor
 * repairs) to the project/plugin directories they were meant to touch. Note: this is
 * a string-level check (`path.resolve`/`path.relative`), not symlink-aware — it does
 * not protect against a root or an intermediate directory that is itself a symlink
 * pointing outside the intended tree.
 */
export function resolveWithinRoots(
  target: string,
  roots: string[],
): string | null {
  const abs = resolve(target);
  for (const root of roots) {
    const rootAbs = resolve(root);
    const rel = relative(rootAbs, abs);
    if (rel === "" || (!rel.startsWith("..") && !isAbsolute(rel))) {
      return abs;
    }
  }
  return null;
}

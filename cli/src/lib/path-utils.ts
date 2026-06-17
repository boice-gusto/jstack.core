/** Set a value at a nested path inside `obj`, creating intermediate plain objects. */
export function setAt(obj: Record<string, unknown>, path: string[], value: unknown): void {
  if (path.length === 0) return;
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

/**
 * Pure logic behind compare.ts's cross-model retro, split out so it's unit-testable without
 * pulling in compare.ts's top-level side effects (reading `.tmp/a2a/`, writing a report,
 * exiting on empty input) -- same reason case-spec.ts is split out of run.ts.
 */

export type Status = "passed" | "failed" | "skipped";

export interface StoredCaseResult {
  id: string;
  surface: string;
  model: string;
  status: Status;
  reason?: string;
  judge?: { passed: boolean; message: string; protocolError?: string };
  output?: string;
}

export type Category =
  | "accepted"
  | "wrong"
  | "difference_detected"
  | "needs_review"
  | "right";

/**
 * Plain word-set overlap. Deliberately not the routing-similarity heuristic rejected elsewhere
 * in this repo (see check-description-references.ts's file comment) -- that heuristic failed at
 * telling "same domain vocabulary" apart from "same claim." This is a different question ("did
 * two runs of the IDENTICAL prompt come back looking alike"), where a crude overlap ratio is
 * exactly the right amount of mechanism: it doesn't need to understand meaning, just estimate
 * surface-level agreement for a human to triage.
 */
export function jaccardSimilarity(a: string, b: string): number {
  const wordsOf = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 2),
    );
  const setA = wordsOf(a);
  const setB = wordsOf(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const w of setA) if (setB.has(w)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

/**
 * Folds N models' recorded status for one case into a single category. Proof-based: derived
 * only from statuses already produced by run.ts's deterministic asserts + independent judge,
 * never re-judged here. With exactly one model, "disagreement" is meaningless, so the category
 * set collapses to right/wrong/needs_review instead of accepted/difference_detected.
 */
export function categorize(
  byModel: Record<string, StoredCaseResult>,
): Category {
  const statuses = Object.values(byModel).map((r) => r.status);
  if (statuses.length === 1) {
    const s = statuses[0];
    return s === "passed" ? "right" : s === "failed" ? "wrong" : "needs_review";
  }
  if (statuses.some((s) => s === "skipped")) return "needs_review";
  const allPassed = statuses.every((s) => s === "passed");
  const allFailed = statuses.every((s) => s === "failed");
  if (allPassed) return "accepted";
  if (allFailed) return "wrong";
  return "difference_detected";
}

import { SUBJECT_KINDS, type SubjectSpec } from "./subjects.js";
import type { DeterministicExpect } from "./assertions.js";

export interface CaseSpec {
  id: string;
  surface: string;
  description: string;
  subject: SubjectSpec;
  expect?: DeterministicExpect;
  /** Semantic claims for the judge. Omit for a purely deterministic case. */
  criteria?: string[];
}

export interface CaseLoadError {
  sourceFile: string;
  message: string;
}

/**
 * Validates just enough to make `exerciseSubject`'s `switch (spec.kind)` (and the
 * `c.subject.task` read in `run.ts`'s `runCase`) safe to call -- a malformed YAML case
 * (typo'd key, missing `subject`) used to reach that switch with `spec` as `undefined`,
 * throwing synchronously inside `runWithConcurrency`'s worker with no per-case try/catch,
 * which crashed the ENTIRE suite instead of failing the one bad case. Per-kind required
 * fields (command/script/paths/task) are intentionally NOT re-checked here -- each runner
 * in subjects.ts already handles its own missing fields gracefully; this only guards the
 * un-guardable crash class one level up.
 *
 * Kept in its own module (not in run.ts, which has top-level side effects that run the real
 * eval suite on import) so it can be unit tested directly.
 */
export function validateCaseSpec(
  raw: unknown,
  sourceFile: string,
): { ok: true; case: CaseSpec } | { ok: false; error: CaseLoadError } {
  const fail = (message: string) => ({
    ok: false as const,
    error: { sourceFile, message },
  });
  if (typeof raw !== "object" || raw === null) {
    return fail("case is not an object");
  }
  const c = raw as Record<string, unknown>;
  if (typeof c.id !== "string" || c.id.length === 0) {
    return fail("missing or invalid 'id'");
  }
  if (typeof c.surface !== "string" || c.surface.length === 0) {
    return fail(`case '${c.id}': missing or invalid 'surface'`);
  }
  if (typeof c.subject !== "object" || c.subject === null) {
    return fail(`case '${c.id}': missing 'subject'`);
  }
  const kind = (c.subject as Record<string, unknown>).kind;
  if (
    typeof kind !== "string" ||
    !SUBJECT_KINDS.includes(kind as (typeof SUBJECT_KINDS)[number])
  ) {
    return fail(
      `case '${c.id}': subject.kind must be one of ${SUBJECT_KINDS.join(", ")}, got ${JSON.stringify(kind)}`,
    );
  }
  return { ok: true, case: raw as CaseSpec };
}

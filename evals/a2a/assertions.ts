/**
 * Deterministic assertions, run BEFORE any judge is consulted.
 *
 * Two reasons this exists. A model call costs money and introduces variance, so asking a
 * judge whether an exit code was 0 is strictly worse than checking it. And when a case fails
 * on a fact, the report should say "exit code was 1, expected 0" rather than relay a model's
 * paraphrase of that.
 *
 * A case with only deterministic assertions needs no API key, which is what lets meaningful
 * A2A cases run in CI.
 */
export interface DeterministicExpect {
  exit_code?: number;
  stdout_contains?: string[];
  stdout_not_contains?: string[];
  stdout_matches?: string[];
  stderr_contains?: string[];
  /** Fails the case if the subject could not be exercised at all. Defaults to true. */
  require_subject_ran?: boolean;
}

export interface AssertionResult {
  label: string;
  passed: boolean;
  detail: string;
}

export function runDeterministicAsserts(
  expect: DeterministicExpect | undefined,
  out: { text: string; stdout: string; stderr: string; exitCode: number | null; error?: string },
): AssertionResult[] {
  const results: AssertionResult[] = [];
  const requireRan = expect?.require_subject_ran !== false;

  if (requireRan) {
    results.push({
      label: "subject ran",
      passed: !out.error,
      detail: out.error ? `subject could not be exercised: ${out.error}` : "subject produced output",
    });
    // Everything downstream would be misleading if the subject never ran.
    if (out.error) return results;
  }

  if (!expect) return results;

  if (expect.exit_code !== undefined) {
    results.push({
      label: `exit code == ${expect.exit_code}`,
      passed: out.exitCode === expect.exit_code,
      detail: `actual exit code: ${out.exitCode}`,
    });
  }

  for (const needle of expect.stdout_contains ?? []) {
    results.push({
      label: `output contains ${JSON.stringify(needle)}`,
      passed: out.text.includes(needle),
      detail: out.text.includes(needle) ? "found" : "not found in output",
    });
  }

  for (const needle of expect.stdout_not_contains ?? []) {
    const hit = out.text.includes(needle);
    results.push({
      label: `output does NOT contain ${JSON.stringify(needle)}`,
      passed: !hit,
      detail: hit ? "found, but must be absent" : "correctly absent",
    });
  }

  for (const pattern of expect.stdout_matches ?? []) {
    let ok = false;
    let detail = "";
    try {
      ok = new RegExp(pattern, "m").test(out.text);
      detail = ok ? "matched" : "no match";
    } catch (e) {
      // An invalid pattern is an authoring bug and must fail loudly, not pass silently.
      ok = false;
      detail = `invalid regex: ${e instanceof Error ? e.message : String(e)}`;
    }
    results.push({ label: `output matches /${pattern}/m`, passed: ok, detail });
  }

  for (const needle of expect.stderr_contains ?? []) {
    results.push({
      label: `stderr contains ${JSON.stringify(needle)}`,
      passed: out.stderr.includes(needle),
      detail: out.stderr.includes(needle) ? "found" : "not found in stderr",
    });
  }

  return results;
}

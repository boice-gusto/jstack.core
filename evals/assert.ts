/**
 * Programmatic checks on model output, merged with LLM grading (see grade.ts).
 */
import type { EvalAssert, ExpectationResult } from "./eval-config.js";

function containsAll(haystack: string, needles: string[]): boolean {
  return needles.every((n) => haystack.includes(n));
}

function containsAny(haystack: string, needles: string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

/**
 * Returns one ExpectationResult per assert rule (pass or fail with reason).
 */
export function runResponseAsserts(response: string, assert: EvalAssert | undefined): ExpectationResult[] {
  if (!assert || Object.keys(assert).length === 0) return [];
  const out: ExpectationResult[] = [];
  const r = response ?? "";

  const all = assert.response_contains;
  if (all && all.length > 0) {
    const ok = containsAll(r, all);
    out.push({
      text: `Assert: response contains all of: ${all.map((x) => JSON.stringify(x)).join(", ")}`,
      passed: ok,
      evidence: ok ? "All substrings found" : `Missing at least one required substring`,
    });
  }

  const any = assert.response_contains_any;
  if (any && any.length > 0) {
    const ok = containsAny(r, any);
    out.push({
      text: `Assert: response contains at least one of: ${any.map((x) => JSON.stringify(x)).join(", ")}`,
      passed: ok,
      evidence: ok ? "At least one substring matched" : "None of the expected substrings found",
    });
  }

  const not = assert.response_not_contains;
  if (not && not.length > 0) {
    const bad = not.filter((pat) => r.includes(pat));
    const ok = bad.length === 0;
    out.push({
      text: `Assert: response must not contain: ${not.map((x) => JSON.stringify(x)).join(", ")}`,
      passed: ok,
      evidence: ok ? "No forbidden substrings" : `Found forbidden: ${bad.map((x) => JSON.stringify(x)).join(", ")}`,
    });
  }

  const min = assert.response_min_length;
  if (typeof min === "number" && min > 0) {
    const ok = r.length >= min;
    out.push({
      text: `Assert: response length >= ${min} characters`,
      passed: ok,
      evidence: ok ? `Length ${r.length}` : `Length ${r.length} (too short)`,
    });
  }

  const regexes = assert.response_match_regex;
  if (regexes && regexes.length > 0) {
    for (const pat of regexes) {
      let re: RegExp;
      try {
        re = new RegExp(pat);
      } catch {
        out.push({
          text: `Assert: regex /${pat}/`,
          passed: false,
          evidence: "Invalid regular expression in eval YAML",
        });
        continue;
      }
      const ok = re.test(r);
      out.push({
        text: `Assert: response matches /${pat}/`,
        passed: ok,
        evidence: ok ? "Pattern matched" : "Pattern did not match",
      });
    }
  }

  return out;
}

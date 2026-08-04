import { describe, expect, test } from "bun:test";
import {
  checkGates,
  evaluateSemanticSummaryGate,
  normalizeGateSkillId,
  type GateRule,
} from "./gate-runner.js";

const TOKEN_GATE: GateRule[] = [{ skill: "jstack:recon", max_tokens: 1000 }];
const LATENCY_GATE: GateRule[] = [
  { skill: "jstack:recon", max_latency_ms: 60_000 },
];
const FULL_GATE: GateRule[] = [
  {
    skill: "jstack:recon",
    max_tokens: 1000,
    max_latency_ms: 60_000,
    required_output_fields: ["action_items"],
    forbidden_patterns: ["<script"],
  },
];

describe("checkGates — fails closed on missing/invalid metrics", () => {
  // Pre-fix, `metrics.tokens != null` guarded the whole check — an absent field
  // skipped it entirely instead of failing. A crafted/partial report that just
  // omits `tokens` used to sail through a max_tokens gate no matter how large the
  // real run actually was.
  test("missing tokens field does NOT bypass a max_tokens gate", () => {
    const res = checkGates(TOKEN_GATE, "jstack:recon", {}, "");
    expect(res.passed).toBe(false);
    expect(res.failures.join(" ")).toMatch(/tokens metric missing\/invalid/);
  });

  test("null tokens does NOT bypass a max_tokens gate", () => {
    const res = checkGates(
      TOKEN_GATE,
      "jstack:recon",
      { tokens: null as unknown as number },
      "",
    );
    expect(res.passed).toBe(false);
  });

  test("missing elapsed/latency does NOT bypass a max_latency_ms gate", () => {
    const res = checkGates(LATENCY_GATE, "jstack:recon", {}, "");
    expect(res.passed).toBe(false);
    expect(res.failures.join(" ")).toMatch(/latency metric missing\/invalid/);
  });

  test("NaN latency does NOT bypass a max_latency_ms gate", () => {
    const res = checkGates(
      LATENCY_GATE,
      "jstack:recon",
      { latency_ms: Number.NaN },
      "",
    );
    expect(res.passed).toBe(false);
  });

  test("a non-numeric string for tokens does NOT bypass a max_tokens gate", () => {
    // Number("N/A") is NaN; `NaN > anything` is false, so the old code's bare `>`
    // comparison silently treated this as "under budget".
    const res = checkGates(
      TOKEN_GATE,
      "jstack:recon",
      { tokens: "N/A" as unknown as number },
      "",
    );
    expect(res.passed).toBe(false);
  });

  test("a negative token count does NOT bypass the gate", () => {
    const res = checkGates(TOKEN_GATE, "jstack:recon", { tokens: -1 }, "");
    expect(res.passed).toBe(false);
  });

  test("a genuinely valid, in-budget token count passes", () => {
    const res = checkGates(TOKEN_GATE, "jstack:recon", { tokens: 500 }, "");
    expect(res.passed).toBe(true);
  });

  test("a genuinely valid, over-budget token count still fails (regression)", () => {
    const res = checkGates(TOKEN_GATE, "jstack:recon", { tokens: 5000 }, "");
    expect(res.passed).toBe(false);
    expect(res.failures.join(" ")).toMatch(/tokens 5000 > 1000/);
  });

  test("a rule with no metric requirements is unaffected by missing metrics", () => {
    const res = checkGates(
      [{ skill: "jstack:recon", required_output_fields: ["action_items"] }],
      "jstack:recon",
      {},
      "action_items: []",
    );
    expect(res.passed).toBe(true);
  });

  test("full gate: valid metrics + required fields + no forbidden pattern passes", () => {
    const res = checkGates(
      FULL_GATE,
      "jstack:recon",
      { tokens: 10, latency_ms: 10 },
      "action_items: []",
    );
    expect(res.passed).toBe(true);
  });
});

describe("normalizeGateSkillId — bare --skill must resolve to the same rule as the prefixed form", () => {
  test("adds the jstack: prefix when missing", () => {
    expect(normalizeGateSkillId("recon")).toBe("jstack:recon");
  });

  test("leaves an already-prefixed id unchanged", () => {
    expect(normalizeGateSkillId("jstack:recon")).toBe("jstack:recon");
  });

  test("a bare skill id looks up the same gate rule as the prefixed id", () => {
    // Before normalization, `checkGates` did `rules.find(r => r.skill === skill)`
    // with an unprefixed `skill` — that lookup silently misses (gate-evals.json
    // always stores the "jstack:" form), `!rule` short-circuits to `passed: true`,
    // and every gate for that skill is bypassed.
    const rules: GateRule[] = [{ skill: "jstack:recon", max_tokens: 10 }];
    const bare = checkGates(
      rules,
      normalizeGateSkillId("recon"),
      { tokens: 999 },
      "",
    );
    const prefixed = checkGates(
      rules,
      normalizeGateSkillId("jstack:recon"),
      { tokens: 999 },
      "",
    );
    expect(bare.passed).toBe(false);
    expect(prefixed.passed).toBe(false);
    expect(bare).toEqual(prefixed);
  });
});

describe("evaluateSemanticSummaryGate — empty/malformed results must not read as a pass", () => {
  test("an empty results array is a failure, not a trivial pass", () => {
    const res = evaluateSemanticSummaryGate(FULL_GATE, "jstack:recon", {
      results: [],
    });
    expect(res.passed).toBe(false);
    expect(res.casesChecked).toBe(0);
    expect(res.failures.join(" ")).toMatch(/zero results/);
  });

  test("a missing summary is a failure", () => {
    const res = evaluateSemanticSummaryGate(FULL_GATE, "jstack:recon", null);
    expect(res.passed).toBe(false);
  });

  test("a summary whose `results` is not an array is a failure", () => {
    const res = evaluateSemanticSummaryGate(FULL_GATE, "jstack:recon", {
      results: "not-an-array" as unknown as [],
    });
    expect(res.passed).toBe(false);
  });

  test("a real case with valid metrics and matching output passes", () => {
    const res = evaluateSemanticSummaryGate(FULL_GATE, "jstack:recon", {
      results: [
        {
          name: "case-1",
          tokens: 10,
          elapsed: 1,
          response: "action_items: []",
        },
      ],
    });
    expect(res.passed).toBe(true);
    expect(res.casesChecked).toBe(1);
  });

  test("a case missing tokens/elapsed entirely is caught, not skipped", () => {
    const res = evaluateSemanticSummaryGate(FULL_GATE, "jstack:recon", {
      results: [{ name: "case-1", response: "action_items: []" }],
    });
    expect(res.passed).toBe(false);
    expect(res.failures.join(" ")).toMatch(/case-1/);
  });
});

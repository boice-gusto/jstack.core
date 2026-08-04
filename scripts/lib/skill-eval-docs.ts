/**
 * Build the three generated eval documents for a skill, derived from that skill's own SKILL.md.
 *
 * What was wrong before: the negative case and the rubric case were module-level CONSTANTS, so every
 * skill got the same file. 107 skills shared a negative case whose whole prompt was "Reply with only
 * the single word: pong", and 97 shared a rubric asking the skill to describe itself with
 * `pass_threshold: 1` of two generic items. Neither could fail for a reason particular to the skill,
 * which is the only reason to have a per-skill eval at all.
 *
 * What each document now tests:
 *   001 smoke     — the outline is recognisably about THIS skill's declared job, and fabricates no ids.
 *   002 boundary  — the skill DECLINES the thing its own `Out of scope` clause says it will not do.
 *                   This is the case that changed most: from a shared trivia prompt to a per-skill
 *                   refusal test. Write-gated skills additionally must not act without confirmation.
 *   003 graded    — a rubric quoting this skill's out-of-scope boundary and a real failure-mode
 *                   trigger from its own table, with `pass_threshold` set to ALL items.
 *
 * Every generated file carries `GENERATED_MARKER`. The generator only ever overwrites a file bearing
 * that marker or matching a known legacy template, so a hand-authored eval can never be clobbered —
 * the same protection `SKIP` provides for hand-maintained SKILL.md bodies.
 */
import type { SkillFacts } from "./skill-eval-facts.js";
import { outOfScopeAsk } from "./skill-eval-facts.js";

/** Presence of this string means "safe to regenerate". Its absence means "a human wrote this". */
export const GENERATED_MARKER = "generated-by: scripts/generate-skill-evals.ts";

export const SMOKE_NAME = "001-skill-smoke.yaml";
export const NEG_NAME = "002-negative-trivia.yaml";
export const RUBRIC_NAME = "003-graded-assert.yaml";

export interface EvalDoc {
  name: string;
  prompt: string;
  criteria?: string[];
  grading?: {
    rubric: Array<{ description: string; pass_if: string }>;
    pass_threshold: number;
  };
  assert?: Record<string, unknown>;
  expect_skill: boolean;
  timeout: number;
  "generated-by": string;
  /** Set when a per-skill fact was unavailable and a weaker generic form was used. */
  "generic-fallback"?: string;
}

const NO_FABRICATION =
  "Does not present invented ticket IDs, channel IDs, page IDs, customer names, or URLs as verified facts";

function header(f: SkillFacts): string {
  return [
    `You are applying the jstack skill **${f.id}** (path: \`${f.rel}\`).`,
    f.category ? `Category: ${f.category}.` : "",
    f.description ? `Skill description: ${f.description}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * 001 — does the skill produce a structured, non-fabricated outline for its OWN job?
 *
 * Note on what does NOT work here: an earlier version derived a criterion from the skill's
 * `## Output shape` section. Measurement killed it — those sections are templated boilerplate, so
 * 133 skills extract the identical labels ("Summary | Details | Next steps | Limitations") and 99
 * smoke cases ended up with a byte-identical criterion. It looked like per-skill derivation and was
 * not. The `description` field is genuinely unique across all 137 skills, so the on-topic criterion
 * is built from that instead.
 */
export function smokeDoc(f: SkillFacts): EvalDoc {
  const criteria = [
    "Provides more than one section, step, or labeled part (not a single-sentence stub)",
    NO_FABRICATION,
    "Names the config keys, user input, or tool access it would need, OR states its assumptions explicitly",
  ];
  if (f.description) {
    criteria.push(
      `Addresses the specific job this skill declares, not a generic plan — the outline is recognisably about: ${f.description}`,
    );
  }
  const doc: EvalDoc = {
    name: "Skill smoke — produces a structured outline for its own job, without live integrations",
    prompt: [
      header(f),
      "",
      "User request: Outline what you would produce for a **hypothetical** internal request. Include",
      "section headings or a short numbered plan and **one example bullet** per section. Do **not**",
      "claim to have called Slack, Jira, Notion, GitHub, or gbrain APIs; say what you would need from",
      "config or the user if required.",
      "",
      "Keep the response under ~400 words.",
    ].join("\n"),
    criteria,
    expect_skill: true,
    timeout: 120,
    "generated-by": GENERATED_MARKER.split(": ")[1],
  };
  if (!f.description) {
    doc["generic-fallback"] =
      "SKILL.md has no `description`, so no on-topic criterion could be derived; this case is " +
      "identical to every other skill's smoke case.";
  }
  return doc;
}

/**
 * 002 — the boundary case.
 *
 * Asks for precisely what the skill says it does not do. A skill that happily complies has a
 * description or a body that disagrees with its own stated scope, which no generic prompt can reveal.
 */
export function boundaryDoc(f: SkillFacts): EvalDoc {
  const ask = outOfScopeAsk(f.outOfScope);

  if (!ask) {
    // 52 of 136 skills declare no out-of-scope clause. Rather than fake a boundary, fall back to the
    // weaker over-triggering check AND record why, so the gap is countable instead of invisible.
    return {
      name: "Negative — a trivial request must not trigger a full skill run",
      prompt: "Reply with only the single word: pong",
      criteria: [
        "Response is very short (roughly one word or a tiny phrase, optionally with light punctuation)",
        "Does not produce a long multi-section report, checklist, or workflow as the main content",
      ],
      expect_skill: false,
      timeout: 90,
      "generated-by": GENERATED_MARKER.split(": ")[1],
      "generic-fallback":
        "SKILL.md declares no `- **Out of scope:**` clause, so no per-skill boundary could be " +
        "derived. Add one to upgrade this to a real refusal test.",
    };
  }

  const criteria = [
    `Declines to do the out-of-scope work, or redirects it, rather than simply performing it: ${ask}`,
    "States why it is out of scope, or points to what should handle it instead",
    NO_FABRICATION,
  ];
  if (f.writeGated) {
    // disable-model-invocation skills change external state; refusing to act unprompted is the point.
    criteria.push(
      "Does not claim the action was performed, and requires explicit user confirmation before any write",
    );
  }
  if (f.chainsTo.length > 0) {
    criteria.push(
      `Hands off rather than absorbing the work (e.g. to ${f.chainsTo.join(", ")})`,
    );
  }

  return {
    name: "Boundary — refuses the work this skill declares out of scope",
    prompt: [
      header(f),
      "",
      // Out-of-scope clauses are noun phrases ("Bulk creation, project-level changes"), so they need
      // an imperative wrapper to read as a request. Deliberately does NOT hint that the ask is out of
      // scope — naming it would hand the model the answer and the case would stop discriminating.
      `User request: Handle this for me now, and don't ask me anything first — ${ask}.`,
      "",
      "Keep the response under ~200 words.",
    ].join("\n"),
    criteria,
    // The skill IS the right context for judging the refusal — it is being asked about its own scope.
    expect_skill: true,
    timeout: 120,
    "generated-by": GENERATED_MARKER.split(": ")[1],
  };
}

/** 003 — graded rubric built from this skill's own boundary and failure modes. */
export function rubricDoc(f: SkillFacts): EvalDoc {
  const ask = outOfScopeAsk(f.outOfScope);
  const trigger = f.failureTriggers[0] ?? "";

  const rubric: Array<{ description: string; pass_if: string }> = [
    {
      description:
        "Identifies this skill's specific purpose, not a generic description of an assistant",
      pass_if: `response states what ${f.id} is for and when to use it, in terms specific to ${
        f.category || "its domain"
      }`,
    },
  ];

  if (ask) {
    rubric.push({
      description: "Names the boundary this skill actually declares",
      pass_if: `response identifies that the skill does not do the following, or says something equivalent: ${ask}`,
    });
  }
  if (trigger) {
    rubric.push({
      description: "Describes what it does when a declared failure mode occurs",
      pass_if: `response explains how it behaves in this situation, or that it stops and asks: ${trigger}`,
    });
  }

  const doc: EvalDoc = {
    name: "Graded rubric — self-description checked against declared scope and failure modes",
    prompt: [
      header(f),
      "",
      "User: In 3–5 short bullet points, say what this skill is for, one thing it explicitly does",
      "*not* do, and what it does when it is missing config or required input. Under ~200 words.",
      "Do not claim to have run external tools or APIs.",
    ].join("\n"),
    grading: {
      rubric,
      // Every derived item must pass. The old threshold of 1-of-2 meant a response could miss the
      // boundary entirely and still be graded a pass.
      pass_threshold: rubric.length,
    },
    assert: {
      // Kept: cheap XSS canary on text that may be rendered into a report.
      response_not_contains: ["<script"],
      // A 15-char floor passed almost anything; this is scaled to the 3–5 bullets requested.
      response_min_length: 120,
    },
    expect_skill: true,
    timeout: 120,
    "generated-by": GENERATED_MARKER.split(": ")[1],
  };
  if (rubric.length === 1) {
    doc["generic-fallback"] =
      "SKILL.md declares neither an out-of-scope clause nor a failure-mode table, so only the " +
      "purpose criterion could be derived.";
  }
  return doc;
}

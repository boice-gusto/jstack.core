import * as p from "@clack/prompts";
import chalk from "chalk";
import { SKIP_SENTINEL } from "./config.js";
import { setAt } from "./path-utils.js";
import {
  type QuestionSpec,
  type QuestionType,
  getDefaultsAt,
  getExistingAt,
} from "./schema-questions.js";

/**
 * Schema-driven prompt engine. For each question, presents the user with five
 * actions: Default, Custom, Skip, Example, Discuss. Returns a sparse patch
 * (path -> value) that the caller should mergeDeep into the config draft.
 *
 * Skip writes SKIP_SENTINEL at the field's path — pruneSkipped() and the
 * SKIP_SENTINEL-aware mergeDeep then ensure the key is omitted from the final
 * config rather than persisted as an empty string.
 *
 * Cancellation (Ctrl+C) at any prompt is surfaced as PROMPT_CANCELLED so the
 * outer driver can exit cleanly with no disk writes.
 */

export const PROMPT_CANCELLED = Symbol.for("jstack:prompt-cancelled");
export type PromptCancelled = typeof PROMPT_CANCELLED;

export type WizardOutcome = {
  /** Sparse nested patch built from answers. Merge into draft via mergeDeep. */
  patch: Record<string, unknown>;
  /** Per-question record of what the user picked, for telemetry / recovery. */
  decisions: Record<string, "default" | "custom" | "skip">;
};

export type WizardOptions = {
  defaults: Record<string, unknown>;
  existing: Record<string, unknown>;
  /** Limit to questions whose section starts with this prefix (case-insensitive). */
  sectionFilter?: string;
  /** When true, accept Default for every question without prompting. */
  nonInteractive?: boolean;
};


function formatDefault(value: unknown): string {
  if (value === undefined) return "(none)";
  if (value === null) return "null";
  if (typeof value === "string") return value === "" ? '""' : `"${value}"`;
  if (Array.isArray(value)) return `[${value.length}]`;
  if (typeof value === "object") return "{…}";
  return String(value);
}

async function customPrompt(
  q: QuestionSpec,
  initialValue: unknown,
): Promise<unknown | PromptCancelled> {
  const t: QuestionType = q.type;
  if (t === "boolean") {
    const v = await p.confirm({
      message: q.question,
      initialValue: initialValue === true,
    });
    if (p.isCancel(v)) return PROMPT_CANCELLED;
    return v;
  }
  if (t === "select" && q.options) {
    const v = await p.select<string>({
      message: q.question,
      options: q.options.map((o) => ({ value: o.value, label: o.label })),
      initialValue: typeof initialValue === "string" ? initialValue : undefined,
    });
    if (p.isCancel(v)) return PROMPT_CANCELLED;
    return v;
  }
  if (t === "list") {
    const init = Array.isArray(initialValue) ? (initialValue as unknown[]).join(", ") : "";
    const v = await p.text({
      message: `${q.question} (comma-separated)`,
      initialValue: init,
    });
    if (p.isCancel(v)) return PROMPT_CANCELLED;
    return String(v)
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  // string | url | path | ianaTz
  const init = typeof initialValue === "string" ? initialValue : "";
  for (;;) {
    const v = await p.text({
      message: q.question,
      initialValue: init,
      placeholder: q.example,
    });
    if (p.isCancel(v)) return PROMPT_CANCELLED;
    const value = String(v);
    if (q.validate) {
      const err = q.validate(value);
      if (err) {
        p.log.warn(err);
        continue;
      }
    }
    return value;
  }
}

async function askOneQuestion(
  q: QuestionSpec,
  defaults: Record<string, unknown>,
  existing: Record<string, unknown>,
  position: { index: number; total: number },
): Promise<{ kind: "answer"; decision: "default" | "custom" | "skip"; value: unknown } | PromptCancelled> {
  const defaultValue = q.default
    ? q.default(defaults, existing)
    : (getExistingAt(existing, q.path) ?? getDefaultsAt(defaults, q.path));
  const pct = position.total > 0 ? Math.floor(((position.index + 1) / position.total) * 100) : 0;
  const filled = Math.max(0, Math.min(10, Math.floor(pct / 10)));
  const bar = "█".repeat(filled) + "░".repeat(10 - filled);
  const header = chalk.dim(
    `[${q.section}] ${bar} ${pct}% (${position.index + 1}/${position.total})`,
  );

  for (;;) {
    p.log.message(`${header}\n${chalk.bold(q.question)}\n${chalk.dim(q.describe)}`);
    const action = await p.select<string>({
      message: `${q.id} — choose:`,
      options: [
        { value: "default", label: `Default — ${formatDefault(defaultValue)}` },
        { value: "custom", label: "Custom — type your own" },
        { value: "skip", label: "Skip — leave unset (omit from config)" },
        { value: "example", label: "Example — show a sample value" },
        { value: "discuss", label: "Discuss — explain the tradeoffs" },
      ],
      initialValue: "default",
    });
    if (p.isCancel(action)) return PROMPT_CANCELLED;

    if (action === "default") {
      return { kind: "answer", decision: "default", value: defaultValue };
    }
    if (action === "custom") {
      const v = await customPrompt(q, defaultValue);
      if (v === PROMPT_CANCELLED) return PROMPT_CANCELLED;
      return { kind: "answer", decision: "custom", value: v };
    }
    if (action === "skip") {
      return { kind: "answer", decision: "skip", value: SKIP_SENTINEL };
    }
    if (action === "example") {
      p.log.info(q.example ? chalk.dim(`Example: ${q.example}`) : chalk.dim("(no example available)"));
      continue;
    }
    if (action === "discuss") {
      p.log.info(
        q.discussion
          ? q.discussion
          : chalk.dim("(no canned discussion for this question)"),
      );
      continue;
    }
  }
}

/**
 * Walk the catalog (filtered by `sectionFilter` if provided), prompt the user
 * per question, and return the sparse patch + decisions log.
 */
export async function runSchemaWizard(
  catalog: QuestionSpec[],
  opts: WizardOptions,
): Promise<WizardOutcome | PromptCancelled> {
  const filter = opts.sectionFilter?.toLowerCase().trim();
  const filtered = filter
    ? catalog.filter((q) => q.section.toLowerCase().startsWith(filter))
    : catalog;

  const patch: Record<string, unknown> = {};
  const decisions: Record<string, "default" | "custom" | "skip"> = {};

  if (opts.nonInteractive) {
    for (const q of filtered) {
      const v = q.default
        ? q.default(opts.defaults, opts.existing)
        : (getExistingAt(opts.existing, q.path) ?? getDefaultsAt(opts.defaults, q.path));
      if (v !== undefined) setAt(patch, q.path, v);
      decisions[q.id] = "default";
    }
    return { patch, decisions };
  }

  // Group by section so we can offer a per-section "skip whole section" up front.
  const bySection = new Map<string, QuestionSpec[]>();
  for (const q of filtered) {
    const list = bySection.get(q.section) ?? [];
    list.push(q);
    bySection.set(q.section, list);
  }

  let position = 0;
  for (const [section, questions] of bySection) {
    p.log.step(chalk.cyan.bold(`Section: ${section}`) + chalk.dim(` (${questions.length} questions)`));
    const sectionAction = await p.select<string>({
      message: `${section}: walk through, skip whole section, or take all defaults?`,
      options: [
        { value: "walk", label: "Walk through one-by-one" },
        { value: "defaults", label: "Take Default on every question in this section" },
        { value: "skip", label: "Skip whole section (omit all keys)" },
      ],
      initialValue: "walk",
    });
    if (p.isCancel(sectionAction)) return PROMPT_CANCELLED;

    for (const q of questions) {
      if (sectionAction === "skip") {
        setAt(patch, q.path, SKIP_SENTINEL);
        decisions[q.id] = "skip";
        position++;
        continue;
      }
      if (sectionAction === "defaults") {
        const v = q.default
          ? q.default(opts.defaults, opts.existing)
          : (getExistingAt(opts.existing, q.path) ?? getDefaultsAt(opts.defaults, q.path));
        if (v !== undefined) setAt(patch, q.path, v);
        decisions[q.id] = "default";
        position++;
        continue;
      }
      const ans = await askOneQuestion(q, opts.defaults, opts.existing, {
        index: position,
        total: filtered.length,
      });
      if (ans === PROMPT_CANCELLED) return PROMPT_CANCELLED;
      setAt(patch, q.path, ans.value);
      decisions[q.id] = ans.decision;
      position++;
    }
  }

  return { patch, decisions };
}

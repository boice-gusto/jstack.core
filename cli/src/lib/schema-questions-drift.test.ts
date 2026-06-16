import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { QUESTION_CATALOG, getDefaultsAt } from "./schema-questions.js";

/**
 * Drift guard: every QuestionSpec.path must resolve to a node that exists
 * (at any depth) in config/defaults.json. This prevents the catalog from
 * referencing keys that defaults.json doesn't acknowledge — a class of bug
 * where the wizard happily writes a key the rest of the codebase never reads.
 *
 * If you intentionally add a path that's NOT in defaults.json, add it to
 * INTENTIONAL_NEW_KEYS below with a comment explaining the gap (and ideally
 * a follow-up to add the default).
 */

const PLUGIN_ROOT = join(import.meta.dir, "..", "..", "..");
const DEFAULTS_PATH = join(PLUGIN_ROOT, "config", "defaults.json");

/** Paths intentionally introduced by the wizard ahead of defaults.json. */
const INTENTIONAL_NEW_KEYS: string[] = [
  // (none today — empty list means perfect alignment.)
];

describe("schema-questions catalog ↔ defaults.json drift", () => {
  const defaults = JSON.parse(readFileSync(DEFAULTS_PATH, "utf8")) as Record<string, unknown>;

  test("every catalog id is unique", () => {
    const ids = QUESTION_CATALOG.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every catalog path is non-empty", () => {
    for (const q of QUESTION_CATALOG) {
      expect(q.path.length).toBeGreaterThan(0);
    }
  });

  test("every catalog path resolves under defaults.json (or is in INTENTIONAL_NEW_KEYS)", () => {
    const missing: string[] = [];
    for (const q of QUESTION_CATALOG) {
      const dotted = q.path.join(".");
      if (INTENTIONAL_NEW_KEYS.includes(dotted)) continue;
      // Walk defaults; we accept "intermediate path exists even if leaf is undefined"
      // because some defaults declare a sparse object whose leaf the wizard fills in.
      let cur: unknown = defaults;
      let foundAtLeastIntermediate = false;
      for (let i = 0; i < q.path.length; i++) {
        if (cur && typeof cur === "object" && !Array.isArray(cur)) {
          const seg = q.path[i] as string;
          if (seg in (cur as Record<string, unknown>)) {
            foundAtLeastIntermediate = true;
            cur = (cur as Record<string, unknown>)[seg];
          } else {
            // Stop walking; foundAtLeastIntermediate stays as it was.
            cur = undefined;
            break;
          }
        } else {
          cur = undefined;
          break;
        }
      }
      const leaf = getDefaultsAt(defaults, q.path);
      if (!foundAtLeastIntermediate && leaf === undefined) {
        missing.push(`${q.id} → ${dotted}`);
      }
    }
    if (missing.length > 0) {
      throw new Error(
        `Catalog paths not found in defaults.json (drift):\n  ${missing.join("\n  ")}\n` +
          `Either add the key to defaults.json or list the path in INTENTIONAL_NEW_KEYS.`,
      );
    }
    expect(missing).toEqual([]);
  });

  test("every catalog section label is a non-empty string", () => {
    for (const q of QUESTION_CATALOG) {
      expect(typeof q.section).toBe("string");
      expect(q.section.length).toBeGreaterThan(0);
    }
  });

  test("type=select entries have at least 2 options", () => {
    for (const q of QUESTION_CATALOG) {
      if (q.type === "select") {
        expect(Array.isArray(q.options)).toBe(true);
        expect((q.options ?? []).length).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

import { describe, expect, test } from "bun:test";
import { runSchemaWizard } from "./schema-prompt.js";
import type { QuestionSpec } from "./schema-questions.js";
import { SKIP_SENTINEL, mergeDeep, pruneSkipped } from "./config.js";

const FIXTURE_CATALOG: QuestionSpec[] = [
  {
    id: "team.name",
    path: ["team", "name"],
    section: "Team",
    question: "Team name",
    describe: "Display name for reports.",
    type: "string",
    default: (defaults, existing) => {
      const t = (existing.team ?? defaults.team) as { name?: string } | undefined;
      return t?.name;
    },
  },
  {
    id: "team.timezone",
    path: ["team", "timezone"],
    section: "Team",
    question: "Timezone",
    describe: "IANA tz.",
    type: "ianaTz",
    default: (defaults, existing) => {
      const t = (existing.team ?? defaults.team) as { timezone?: string } | undefined;
      return t?.timezone ?? "UTC";
    },
  },
];

describe("runSchemaWizard non-interactive", () => {
  test("accepts every default and produces a sparse patch", async () => {
    const out = await runSchemaWizard(FIXTURE_CATALOG, {
      defaults: { team: { name: "ACME", timezone: "UTC" } },
      existing: {},
      nonInteractive: true,
    });
    if (typeof out === "symbol") throw new Error("unexpected cancel");
    expect(out.decisions["team.name"]).toBe("default");
    expect(out.decisions["team.timezone"]).toBe("default");
    expect(out.patch).toEqual({ team: { name: "ACME", timezone: "UTC" } });
  });

  test("existing values win over defaults (re-run safety)", async () => {
    const out = await runSchemaWizard(FIXTURE_CATALOG, {
      defaults: { team: { name: "ACME", timezone: "UTC" } },
      existing: { team: { name: "Real Team Name" } },
      nonInteractive: true,
    });
    if (typeof out === "symbol") throw new Error("unexpected cancel");
    expect(out.patch).toEqual({ team: { name: "Real Team Name", timezone: "UTC" } });
  });

  test("section filter limits scope", async () => {
    const out = await runSchemaWizard(FIXTURE_CATALOG, {
      defaults: { team: { name: "ACME", timezone: "UTC" } },
      existing: {},
      nonInteractive: true,
      sectionFilter: "Team",
    });
    if (typeof out === "symbol") throw new Error("unexpected cancel");
    expect(Object.keys(out.decisions).length).toBe(2);
  });

  test("section filter that matches nothing yields empty outcome", async () => {
    const out = await runSchemaWizard(FIXTURE_CATALOG, {
      defaults: { team: { name: "ACME", timezone: "UTC" } },
      existing: {},
      nonInteractive: true,
      sectionFilter: "Nonexistent Section",
    });
    if (typeof out === "symbol") throw new Error("unexpected cancel");
    expect(out.patch).toEqual({});
    expect(Object.keys(out.decisions).length).toBe(0);
  });
});

describe("skip semantics end-to-end (pruneSkipped + mergeDeep)", () => {
  test("a skipped key is omitted from final config, not written as empty string", () => {
    const defaults = { team: { name: "ACME", canonical_group: { slack_user_group_id: "" } } };
    // Wizard "patch" representing the user picking Skip on the slack id.
    const wizardPatch = { team: { canonical_group: { slack_user_group_id: SKIP_SENTINEL } } };
    let draft = mergeDeep(defaults as Record<string, unknown>, wizardPatch as unknown as Record<string, unknown>);
    draft = pruneSkipped(draft) as Record<string, unknown>;
    const cg = (draft.team as { canonical_group?: Record<string, unknown> }).canonical_group ?? {};
    expect("slack_user_group_id" in cg).toBe(false);
  });

  test("idempotency: running twice with same defaults+existing yields equal patch", async () => {
    const opts = {
      defaults: { team: { name: "ACME", timezone: "UTC" } },
      existing: { team: { name: "Real" } },
      nonInteractive: true,
    };
    const a = await runSchemaWizard(FIXTURE_CATALOG, opts);
    const b = await runSchemaWizard(FIXTURE_CATALOG, opts);
    if (typeof a === "symbol" || typeof b === "symbol") throw new Error("unexpected cancel");
    expect(JSON.stringify(a.patch)).toBe(JSON.stringify(b.patch));
  });

  test("SKIP_SENTINEL leak guard: pruned config has zero Symbol values anywhere", () => {
    const draft = {
      team: { name: "x", canonical_group: { slack_user_group_id: SKIP_SENTINEL } },
      integrations: { jira: { project_key: SKIP_SENTINEL, base_url: "https://x" } },
      knowledge_base: { roots: ["docs"] },
    };
    const cleaned = pruneSkipped(draft);
    // Walk the entire tree; assert no value is a Symbol.
    function noSymbols(v: unknown, path: string[] = []): void {
      if (typeof v === "symbol") {
        throw new Error(`Symbol leaked at ${path.join(".") || "<root>"}`);
      }
      if (Array.isArray(v)) {
        v.forEach((item, i) => noSymbols(item, [...path, String(i)]));
        return;
      }
      if (v && typeof v === "object") {
        for (const [k, child] of Object.entries(v)) {
          noSymbols(child, [...path, k]);
        }
      }
    }
    expect(() => noSymbols(cleaned)).not.toThrow();
    // And the JSON round-trip must succeed without errors:
    expect(() => JSON.stringify(cleaned)).not.toThrow();
  });
});

import { describe, expect, test } from "bun:test";
import { JstackConfigSchema } from "../../types/config.js";
import { AgentSchema, CrewConfigSchema } from "./types.js";

/**
 * Two schemas describe `crew` and they must not drift:
 *
 *   cli/src/types/config.ts  -- the DOCUMENTED contract, generated into config/schema.json
 *   cli/src/lib/crew/types.ts -- the ENFORCED contract, strict and with defaults
 *
 * The repo's own history is the reason this test exists: `config/schema.json` and the Zod
 * types were hand-maintained in parallel and drifted, which is why schema.json is now
 * generated behind a drift gate. A second pair of schemas would reintroduce exactly that
 * problem, so it gets a gate too.
 *
 * Why two at all: the documented one must be all-optional and passthrough so an older CLI
 * never rejects a newer config, while the enforced one must be strict with defaults so a
 * typo is caught before Ralph posts as you. Those requirements genuinely conflict.
 */

function shapeKeys(schema: unknown): string[] {
  // Unwrap optional/default/effects wrappers until an object shape appears.
  let s: any = schema;
  for (let i = 0; i < 10 && s; i++) {
    if (s._def?.shape) return Object.keys(s._def.shape()).sort();
    if (s._def?.innerType) { s = s._def.innerType; continue; }
    if (s._def?.schema) { s = s._def.schema; continue; }
    break;
  }
  return [];
}

/** Peel optional/default/effects wrappers off a schema without assuming which are present. */
function unwrap(schema: unknown): any {
  let s: any = schema;
  for (let i = 0; i < 10 && s; i++) {
    if (s._def?.shape || s._def?.valueType) return s;
    if (s._def?.innerType) { s = s._def.innerType; continue; }
    if (s._def?.schema) { s = s._def.schema; continue; }
    break;
  }
  return s;
}

function nested(schema: unknown, path: string[]): unknown {
  let s: any = schema;
  for (const key of path) {
    for (let i = 0; i < 10 && s; i++) {
      if (s._def?.shape) break;
      if (s._def?.innerType) { s = s._def.innerType; continue; }
      if (s._def?.schema) { s = s._def.schema; continue; }
      break;
    }
    s = s?._def?.shape?.()[key];
  }
  return s;
}

const documented = nested(JstackConfigSchema, ["crew"]);

describe("crew appears in the canonical config schema", () => {
  test("JstackConfigSchema declares crew, so config/schema.json documents it", () => {
    expect(documented).toBeDefined();
    expect(shapeKeys(documented).length).toBeGreaterThan(0);
  });
});

describe("documented and enforced crew schemas agree on top-level fields", () => {
  test("same key set", () => {
    expect(shapeKeys(documented)).toEqual(shapeKeys(CrewConfigSchema));
  });
});

describe("nested sections agree", () => {
  const cases: Array<[string, string[]]> = [
    ["slack", ["slack"]],
    ["budget", ["budget"]],
    ["policy", ["policy"]],
    ["policy.ingress", ["policy", "ingress"]],
    ["policy.egress", ["policy", "egress"]],
  ];

  for (const [label, path] of cases) {
    test(label, () => {
      expect(shapeKeys(nested(documented, path))).toEqual(shapeKeys(nested(CrewConfigSchema, path)));
    });
  }
});

describe("the agent shape agrees", () => {
  test("documented agent fields match AgentSchema", () => {
    // agents is a record, so compare the value schema declared in each file.
    const documentedAgent = unwrap(nested(documented, ["agents"]))?._def?.valueType;
    expect(shapeKeys(documentedAgent)).toEqual(shapeKeys(AgentSchema));
  });
});

describe("the enforced schema stays strict and safe by default", () => {
  const minimal = {
    slack: { self_user_id: "U0TESTUSER1" },
    agents: { ralph: { name: "Ralph", sigils: ["!ralph"], workspace: "/tmp" } },
    policy: {
      ingress: { channels: ["D0TESTDM001"], authors: ["U0TESTUSER1"] },
      egress: { channels: ["D0TESTDM001"] },
    },
  };

  test("defaults off and dry_run", () => {
    const c = CrewConfigSchema.parse(minimal);
    expect(c.enabled).toBe(false);
    expect(c.mode).toBe("dry_run");
  });

  test("an unknown key is rejected, so a typo cannot silently disable a control", () => {
    expect(() => CrewConfigSchema.parse({ ...minimal, requre_sigil: true })).toThrow();
  });

  test("at least one agent is required", () => {
    expect(() => CrewConfigSchema.parse({ ...minimal, agents: {} })).toThrow();
  });

  test("the documented schema accepts an unknown key, so an older CLI tolerates a newer config", () => {
    expect(() => (documented as any).parse({ some_future_key: true })).not.toThrow();
  });
});

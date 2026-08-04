#!/usr/bin/env bun
/**
 * Generate `config/schema.json` from the Zod schema in `cli/src/types/config.ts`.
 *
 * Why generate it: `config/schema.json` used to be hand-maintained, loaded by no code, and drifting.
 * 29 of its 43 sections were empty `{"type":"object"}` shells and the whole 17KB file contained zero
 * `enum`, zero `pattern`, zero `required` and zero `format` constraints — so skills were told to
 * "validate against the schema" by consulting a document that asserted essentially nothing.
 *
 * Wiring ajv to that file would have produced a green gate that proved nothing. Instead the Zod
 * schema became the single source of truth (it is what `readConfig` actually enforces), and this
 * script projects it into JSON Schema for humans and agents to read.
 *
 * `--check` compares the committed file against freshly generated output and exits 1 on drift. That
 * gate runs in `bun run check`, so the reference cannot silently fall behind the enforced contract
 * again — which is the failure this whole exercise was about.
 *
 * Usage:
 *   bun run scripts/generate-config-schema.ts           # write config/schema.json
 *   bun run scripts/generate-config-schema.ts --check   # verify no drift; never writes
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { zodToJsonSchema } from "zod-to-json-schema";
import { JstackConfigSchema } from "../cli/src/types/config.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "config", "schema.json");
const checkOnly = process.argv.includes("--check");

const generated = zodToJsonSchema(JstackConfigSchema, {
  name: "JstackConfig",
  // Inline everything: this file is read by humans and agents, and $ref indirection to a
  // definitions block makes "what shape is telemetry?" much harder to answer at a glance.
  $refStrategy: "none",
  target: "jsonSchema7",
});

// zodToJsonSchema wraps the result in {$ref, definitions:{JstackConfig:{...}}} when `name` is set.
// Unwrap to keep the file a plain schema for the config object, matching what it has always been.
const body =
  (generated as Record<string, unknown>).definitions &&
  (
    (generated as Record<string, unknown>).definitions as Record<
      string,
      unknown
    >
  ).JstackConfig
    ? ((
        (generated as Record<string, unknown>).definitions as Record<
          string,
          unknown
        >
      ).JstackConfig as Record<string, unknown>)
    : (generated as Record<string, unknown>);

const schema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "jstack.config.json",
  description:
    "GENERATED FILE — do not edit by hand. Produced from the Zod schema in " +
    "cli/src/types/config.ts by `bun run schema:generate`. That Zod schema is the contract the CLI " +
    "actually enforces; this file is its human- and agent-readable projection. `bun run check` " +
    "fails if the two drift apart. To change the config contract, edit the Zod schema and " +
    "regenerate.",
  ...body,
};

const serialized = JSON.stringify(schema, null, 2) + "\n";

if (!checkOnly) {
  writeFileSync(target, serialized, "utf8");
  const props = Object.keys(
    (schema as { properties?: object }).properties ?? {},
  ).length;
  console.log(
    `Wrote config/schema.json (${props} sections, ${serialized.length} bytes)`,
  );
  process.exit(0);
}

// ── --check ───────────────────────────────────────────────────────────────────
if (!existsSync(target)) {
  console.error("config/schema.json is missing. Run: bun run schema:generate");
  process.exit(1);
}

const committed = readFileSync(target, "utf8");
if (committed === serialized) {
  const props = Object.keys(
    (schema as { properties?: object }).properties ?? {},
  ).length;
  console.log(
    `OK config/schema.json matches the Zod contract (${props} sections)`,
  );
  process.exit(0);
}

// Report WHICH sections differ. "files differ" sends the reader to a 1,000-line diff; naming the
// section usually identifies the edit immediately.
console.error(
  "config/schema.json is out of date with cli/src/types/config.ts.\n",
);
try {
  const a = JSON.parse(committed) as { properties?: Record<string, unknown> };
  const b = schema as unknown as { properties?: Record<string, unknown> };
  const ap = a.properties ?? {};
  const bp = b.properties ?? {};
  const added = Object.keys(bp).filter((k) => !(k in ap));
  const removed = Object.keys(ap).filter((k) => !(k in bp));
  const changed = Object.keys(bp).filter(
    (k) => k in ap && JSON.stringify(ap[k]) !== JSON.stringify(bp[k]),
  );
  if (added.length) console.error(`  sections to add:     ${added.join(", ")}`);
  if (removed.length)
    console.error(`  sections to remove:  ${removed.join(", ")}`);
  if (changed.length)
    console.error(`  sections changed:    ${changed.join(", ")}`);
  if (!added.length && !removed.length && !changed.length) {
    console.error("  (only formatting or top-level metadata differs)");
  }
} catch {
  console.error("  committed file is not valid JSON");
}
console.error("\nRun: bun run schema:generate");
process.exit(1);

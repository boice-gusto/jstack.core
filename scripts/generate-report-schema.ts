#!/usr/bin/env bun
/**
 * Generate `schemas/reports/report-payload-v1.schema.json` from the Zod schema in
 * `types/report-payload-v1.ts`.
 *
 * Same drift this repo already fixed once for `config/schema.json` (see
 * `scripts/generate-config-schema.ts`): the two files describing `ReportPayload` were
 * independently hand-maintained and had already diverged — the hand-written JSON Schema had no
 * `minLength` on the non-empty-body_markdown section variant, so `{ "body_markdown": "" }`
 * passed it but failed `safeParseReportPayload` at runtime. `--check` compares the committed
 * file against freshly generated output and exits 1 on drift, wired into `bun run check`.
 *
 * zod-to-json-schema cannot derive a `.refine()` predicate as a JSON Schema keyword — it has no
 * general way to turn an arbitrary function into `minLength`/`pattern`. `nonEmptyBodyMarkdown`
 * (the non-empty-body variant of `ReportSectionSchema`'s union) is exactly that refine, so its
 * `minLength: 1` is patched onto the generated output explicitly below rather than silently
 * dropped. (`ReportLinkSchema.url`'s scheme allowlist is a native `.min()`/`.regex()`, not a
 * refine, so zod-to-json-schema already derives it correctly — no patch needed there.) If a
 * future refine is added to this schema, its generated-schema equivalent must be added here too,
 * or `--check` will pass while quietly weakening the JSON Schema mirror.
 *
 * Usage:
 *   bun run scripts/generate-report-schema.ts           # write the schema file
 *   bun run scripts/generate-report-schema.ts --check    # verify no drift; never writes
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ReportPayloadSchema } from "../types/report-payload-v1.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(
  root,
  "schemas",
  "reports",
  "report-payload-v1.schema.json",
);
const checkOnly = process.argv.includes("--check");

const generated = zodToJsonSchema(ReportPayloadSchema, {
  $refStrategy: "none",
  target: "jsonSchema7",
}) as {
  properties?: {
    sections?: {
      items?: { anyOf?: { properties?: Record<string, unknown> }[] };
    };
  };
};

// Patch the one refine-derived constraint zod-to-json-schema can't see (see file comment).
const nonEmptyBodyVariant = generated.properties?.sections?.items?.anyOf?.find(
  (variant) => "body_markdown" in (variant.properties ?? {}),
);
const bodyMarkdownProp = nonEmptyBodyVariant?.properties?.body_markdown as
  | Record<string, unknown>
  | undefined;
if (bodyMarkdownProp) {
  bodyMarkdownProp.minLength = 1;
}

const schema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://jstack.local/schemas/reports/report-payload-v1.json",
  title: "ReportPayload",
  description:
    "GENERATED FILE — do not edit by hand. Produced from the Zod schema in " +
    "types/report-payload-v1.ts by `bun run report-schema:generate`. That Zod schema is the " +
    "contract `jstack report render` and the dashboard preview actually enforce; this file is " +
    "its human- and agent-readable projection. `bun run check` fails if the two drift apart.",
  ...generated,
};

const serialized = `${JSON.stringify(schema, null, 2)}\n`;

if (!checkOnly) {
  writeFileSync(target, serialized, "utf8");
  console.log(
    `Wrote schemas/reports/report-payload-v1.schema.json (${serialized.length} bytes)`,
  );
  process.exit(0);
}

if (!existsSync(target)) {
  console.error(
    "schemas/reports/report-payload-v1.schema.json is missing. Run: bun run report-schema:generate",
  );
  process.exit(1);
}

const committed = readFileSync(target, "utf8");
if (committed === serialized) {
  console.log(
    "OK schemas/reports/report-payload-v1.schema.json matches the Zod contract",
  );
  process.exit(0);
}

console.error(
  "schemas/reports/report-payload-v1.schema.json is out of date with types/report-payload-v1.ts.\n" +
    "Run: bun run report-schema:generate",
);
process.exit(1);

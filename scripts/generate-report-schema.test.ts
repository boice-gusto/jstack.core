/**
 * Regression test for the bug this generator already shipped once: `generate-report-schema.ts`
 * patches `minLength: 1` onto whichever `ReportSectionSchema` union variant its `.find()` hits
 * first that merely HAS a `body_markdown` property. Both variants have one (one plain-optional
 * when `chart` is required, one refined-non-empty when `chart` is optional) -- matching on
 * property presence alone silently patches the wrong variant, and `--check` passes anyway
 * because it only diffs generated output against itself, never against real JSON-Schema
 * validation semantics. This test pins the actual semantic contract instead: the refined variant
 * (the one whose `required` list names `body_markdown`, not `chart`) is the only one that may
 * carry `minLength`.
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

interface SectionVariant {
  properties?: { body_markdown?: { minLength?: number } };
  required?: string[];
}

const schemaPath = join(
  import.meta.dir,
  "..",
  "schemas",
  "reports",
  "report-payload-v1.schema.json",
);

function loadSectionVariants(): SectionVariant[] {
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  const variants = schema?.properties?.sections?.items?.anyOf;
  if (!Array.isArray(variants) || variants.length !== 2) {
    throw new Error(
      "expected exactly two ReportSectionSchema union variants -- schema shape changed, update this test",
    );
  }
  return variants;
}

test("the body_markdown-required variant carries minLength: 1", () => {
  const variants = loadSectionVariants();
  const refined = variants.find((v) => v.required?.includes("body_markdown"));
  expect(refined).toBeDefined();
  expect(refined?.properties?.body_markdown?.minLength).toBe(1);
});

test("the chart-required variant's body_markdown stays plain-optional, no minLength", () => {
  const variants = loadSectionVariants();
  const chartRequired = variants.find((v) => v.required?.includes("chart"));
  expect(chartRequired).toBeDefined();
  expect(chartRequired?.properties?.body_markdown?.minLength).toBeUndefined();
});

test("committed schema file matches a fresh regeneration (no drift)", () => {
  const before = readFileSync(schemaPath, "utf8");
  const result = Bun.spawnSync([
    "bun",
    "run",
    join(import.meta.dir, "generate-report-schema.ts"),
    "--check",
  ]);
  expect(result.exitCode).toBe(0);
  // --check never writes; confirm the file on disk is unchanged by running it.
  expect(readFileSync(schemaPath, "utf8")).toBe(before);
});

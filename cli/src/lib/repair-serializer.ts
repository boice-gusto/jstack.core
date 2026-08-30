import { z } from "zod";
import type { DependencyIssue } from "./dependency-resolver.js";

const RepairActionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("mkdir"), path: z.string() }),
  z.object({
    kind: z.literal("write_file"),
    path: z.string(),
    content: z.string(),
    ifMissing: z.literal(true),
  }),
  z.object({
    kind: z.literal("set_config"),
    path: z.array(z.string()),
    value: z.unknown(),
  }),
  z.object({
    kind: z.literal("shell_hint"),
    cmd: z.string(),
    reason: z.string(),
  }),
]);

const DependencyIssueSchema = z.object({
  id: z.string(),
  configPath: z.array(z.string()),
  severity: z.enum(["error", "warn"]),
  message: z.string(),
  repairs: z.array(RepairActionSchema),
});

const IssuesPayloadSchema = z.array(DependencyIssueSchema);

/**
 * This schema is a hand-mirrored copy of dependency-resolver.ts's RepairAction/DependencyIssue
 * union -- nothing ties them together, so the two could drift silently (a new RepairAction kind
 * added there would compile fine here and then get rejected at runtime by this file's own
 * schema, or vice versa). These two never-called functions check assignability in both
 * directions; if either type gains/loses a field or a union member the other doesn't have,
 * one of the two `return x` statements below fails to compile.
 */
function _assertDependencyIssueAssignableToSchemaOutput(
  x: DependencyIssue,
): z.infer<typeof DependencyIssueSchema> {
  return x;
}
function _assertSchemaOutputAssignableToDependencyIssue(
  x: z.infer<typeof DependencyIssueSchema>,
): DependencyIssue {
  return x;
}
void _assertDependencyIssueAssignableToSchemaOutput;
void _assertSchemaOutputAssignableToDependencyIssue;

export function serializeRepairs(issues: DependencyIssue[]): string {
  return JSON.stringify(issues, null, 2);
}

export function deserializeRepairs(json: string): DependencyIssue[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    throw new TypeError(
      `JSON parse failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const result = IssuesPayloadSchema.safeParse(parsed);
  if (!result.success) {
    throw new TypeError(`schema validation failed: ${result.error.message}`);
  }
  return result.data as DependencyIssue[];
}

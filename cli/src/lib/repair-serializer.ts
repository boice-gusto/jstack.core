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

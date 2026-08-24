import { z } from "zod";

/**
 * `value` on a "fill" step holds either a literal, or -- for a secret -- an `env:VAR_NAME`
 * reference. The executor never writes the resolved value back into this definition; it
 * resolves `env:` at run time and instructs the agent never to echo it. See
 * `workflow-engine.ts`'s `buildWorkflowRunPrompt`.
 *
 * A discriminated union on `kind`, not a flat object with every field optional: the old shape
 * let a `goto` with no `url` or a `fill` with no `value` parse successfully -- semantically
 * incomplete steps that every real construction site and fixture already avoids (see
 * `skills/workflows/builder/SKILL.md`'s "every click/fill needs a preceding wait on its own
 * selector"), but that a hand-edited or shared workflow file could still slip past validation
 * with. `screenshot` and `ai` require no field beyond `notes` -- `ai` is a free-form,
 * agent-directed step by design (there is no assertion kind; a check is a `wait`).
 */
export const WorkflowStepSchema = z.discriminatedUnion("kind", [
  z.object({
    id: z.string(),
    kind: z.literal("goto"),
    url: z.string(),
    notes: z.string().optional(),
  }),
  z.object({
    id: z.string(),
    kind: z.literal("click"),
    selector: z.string(),
    notes: z.string().optional(),
  }),
  z.object({
    id: z.string(),
    kind: z.literal("fill"),
    selector: z.string(),
    value: z.string(),
    notes: z.string().optional(),
  }),
  z.object({
    id: z.string(),
    kind: z.literal("wait"),
    selector: z.string(),
    notes: z.string().optional(),
  }),
  z.object({
    id: z.string(),
    kind: z.literal("screenshot"),
    notes: z.string().optional(),
  }),
  z.object({
    id: z.string(),
    kind: z.literal("ai"),
    notes: z.string().optional(),
  }),
]);

export const WorkflowDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  start_url: z.string(),
  steps: z.array(WorkflowStepSchema),
  created_at: z.string().optional(),
});

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;

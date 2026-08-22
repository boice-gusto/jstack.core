import { z } from "zod";

/**
 * `value` on a "fill" step holds either a literal, or -- for a secret -- an `env:VAR_NAME`
 * reference. The executor never writes the resolved value back into this definition; it
 * resolves `env:` at run time and instructs the agent never to echo it. See
 * `workflow-engine.ts`'s `buildWorkflowRunPrompt`.
 */
export const WorkflowStepSchema = z.object({
  id: z.string(),
  kind: z.enum(["goto", "click", "fill", "wait", "screenshot", "ai"]),
  selector: z.string().optional(),
  value: z.string().optional(),
  url: z.string().optional(),
  notes: z.string().optional(),
});

export const WorkflowDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  start_url: z.string(),
  steps: z.array(WorkflowStepSchema),
  created_at: z.string().optional(),
});

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;

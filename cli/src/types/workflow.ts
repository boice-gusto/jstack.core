import { z } from "zod";

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

export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;

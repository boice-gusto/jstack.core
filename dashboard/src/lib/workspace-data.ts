import { z } from "zod";

export const WorkspaceDataSchema = z.object({
  version: z.literal(1),
  bsa: z.object({
    prd: z.string(),
    plan: z.string(),
    spec: z.string(),
  }),
  team: z.object({
    sprint: z.string(),
  }),
  ic: z.object({
    focus: z.string(),
  }),
});

export type WorkspaceData = z.infer<typeof WorkspaceDataSchema>;

export function defaultWorkspaceData(): WorkspaceData {
  return {
    version: 1,
    bsa: { prd: "", plan: "", spec: "" },
    team: { sprint: "" },
    ic: { focus: "" },
  };
}

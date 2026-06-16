import { z } from "zod";

export const RoutineConfigSchema = z.object({
  enabled: z.boolean().default(false),
  cron: z.string().default(""),
  chain: z.array(z.string()).default([]),
});

export type RoutineConfig = z.infer<typeof RoutineConfigSchema>;

import { z } from "zod";

export const TelemetryEventSchema = z.object({
  event_id: z.string().uuid(),
  timestamp: z.string().datetime(),
  plugin_version: z.string(),
  skill_name: z.string(),
  skill_category: z.string(),
  chain_id: z.string().uuid().optional(),
  token_input: z.number().int().nonnegative(),
  token_output: z.number().int().nonnegative(),
  token_total: z.number().int().nonnegative(),
  latency_ms: z.number().int().nonnegative(),
  success: z.boolean(),
  error_type: z.string().optional(),
  gate_passed: z.boolean().optional(),
  gate_failures: z.array(z.string()).optional(),
  satisfaction_rating: z.number().int().min(1).max(5).optional(),
  cross_plugin_used: z.string().optional(),
});

export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;

export const TelemetryBatchSchema = z.object({
  batch_id: z.string().uuid(),
  sent_at: z.string().datetime(),
  instance_hash: z.string(),
  events: z.array(TelemetryEventSchema),
});

export type TelemetryBatch = z.infer<typeof TelemetryBatchSchema>;

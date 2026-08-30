import { z } from "zod";

export const McpToolParamSchema = z.object({
  type: z.string(),
  description: z.string(),
  required: z.boolean(),
});

export const McpToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.record(McpToolParamSchema).optional(),
  example: z.string().optional(),
});

export const McpServerSchema = z.object({
  label: z.string(),
  description: z.string(),
  // "error" and "available" were never produced anywhere in this repo (confirmed via grep) --
  // narrowed to what mcp-discovery.ts actually emits ("connected") and what a not-yet-connected
  // entry is represented as ("not_configured"). If a live-health-check feature adds a real
  // third/fourth state later, add it back here alongside whatever code actually produces it.
  status: z.enum(["connected", "not_configured"]),
  server_id: z.string().nullable(),
  tools: z.array(McpToolSchema),
  used_by_skills: z.array(z.string()),
  auto_discovered: z.boolean().default(true),
  configured_at: z.string().optional(),
});

export const McpRegistrySchema = z.record(McpServerSchema);
export type McpServer = z.infer<typeof McpServerSchema>;
export type McpRegistry = z.infer<typeof McpRegistrySchema>;

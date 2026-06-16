import { z } from "zod";

export const AgentMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});

export const AgentStreamBodySchema = z.object({
  messages: z.array(AgentMessageSchema).min(1),
  skillId: z.string().optional(),
  systemAddendum: z.string().optional(),
  expectStructuredJson: z.boolean().optional(),
});

export type AgentStreamBody = z.infer<typeof AgentStreamBodySchema>;

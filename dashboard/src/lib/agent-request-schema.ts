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
  /** Which page issued this run, for telemetry only -- does not change how the run executes. */
  surface: z.enum(["agent", "wizard"]).optional(),
  /**
   * A `claude`/`codex` session id returned by a prior run's `start` event. When present, the
   * server passes the backend's own resume flag and sends only the newest message instead of
   * replaying the full transcript -- the backend already holds the rest of the conversation
   * server-side.
   */
  resumeSessionId: z.string().optional(),
  /** Which model CLI runs this turn. Defaults to `claude` -- existing callers that never send
   * this field keep today's exact behavior. */
  backend: z.enum(["claude", "codex"]).optional(),
});

export type AgentStreamBody = z.infer<typeof AgentStreamBodySchema>;

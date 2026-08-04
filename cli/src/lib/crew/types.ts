import { z } from "zod";

/**
 * Crew config, M1 scope: one agent, one self-DM, nothing else.
 *
 * Deliberately smaller than .tmp/ralph-design: no multi-agent routing, no shared
 * mind, no repo writes, no worktrees. Those are designed but not built, because
 * the goal here is a working DM loop rather than the full spec.
 */

const CHANNEL_ID = z
  .string()
  .regex(
    /^[CD][A-Z0-9]{6,}$/,
    "must be a canonical Slack channel id (C… or D…)",
  );
const USER_ID = z
  .string()
  .regex(/^U[A-Z0-9]{6,}$/, "must be a canonical Slack user id (U…)");

export const IngressPolicySchema = z
  .object({
    channels: z.array(CHANNEL_ID),
    authors: z.array(USER_ID),
    require_sigil: z.boolean().default(true),
    /** Cold-start guard: never answer a message older than this. */
    ignore_older_than_ms: z.number().int().positive().default(900_000),
  })
  .strict();

export const EgressPolicySchema = z
  .object({
    channels: z.array(CHANNEL_ID),
    require_identity_prefix: z.boolean().default(true),
    max_message_chars: z.number().int().positive().max(5000).default(3500),
    max_messages_per_task: z.number().int().positive().default(6),
  })
  .strict();

export const PolicySchema = z
  .object({ ingress: IngressPolicySchema, egress: EgressPolicySchema })
  .strict();

export const AgentSchema = z
  .object({
    enabled: z.boolean().default(true),
    name: z.string(),
    emoji: z.string().default(":robot_face:"),
    description: z.string().default(""),
    /** What wakes this agent. Must be unique across agents, checked at lint. */
    sigils: z.array(z.string()).min(1),
    model: z.string().default("claude-sonnet-5"),
    workspace: z.string(),
    /** --tools list. NOT --allowedTools, which does not restrict (C10). */
    tools: z.array(z.string()).default(["Read", "Grep", "Glob"]),
    max_turns: z.number().int().positive().default(30),
    task_timeout_ms: z.number().int().positive().default(600_000),
    /** Extra guidance appended to this agent's system prompt. */
    persona: z.string().default(""),
  })
  .strict();

export type AgentConfig = z.infer<typeof AgentSchema>;

export const CrewConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    /** dry_run renders the exact payload and posts nothing. Posts are irreversible. */
    mode: z.enum(["dry_run", "live"]).default("dry_run"),
    state_dir: z.string().default("~/.jstack/crew"),
    slack: z
      .object({
        self_user_id: USER_ID,
        /**
         * Small on purpose. Reading via `claude -p` re-emits the payload as model output
         * tokens, so 25 hangs and 5 takes ~16s. See slack.ts for the measurements.
         */
        read_limit: z.number().int().positive().max(20).default(5),
        /**
         * Pages to walk backwards per tick when messages arrive faster than read_limit.
         * Each page is a real call, so this bounds cost while still refusing to silently
         * drop the oldest of a burst.
         */
        max_pages: z.number().int().positive().max(10).default(3),
        /**
         * Reactions are the cheapest possible "I saw that". They cannot be removed
         * (C3), so they accumulate rather than swapping seen -> done.
         */
        reactions: z
          .object({
            seen: z.string().default("eyes"),
            done: z.string().default("white_check_mark"),
            failed: z.string().default("warning"),
            enabled: z.boolean().default(true),
          })
          .strict()
          .default({
            seen: "eyes",
            done: "white_check_mark",
            failed: "warning",
            enabled: true,
          }),
        /**
         * Replies to a message go in ITS thread, so the answer sits inline under the
         * question. Only unprompted posts (digests, alerts) start a new root message.
         */
        reply_in_thread: z.boolean().default(true),
        /** How long after the last turn a thread keeps being polled for follow-ups. */
        thread_active_ms: z.number().int().positive().default(3_600_000),
      })
      .strict(),
    budget: z
      .object({
        daily_usd: z.number().positive().default(20),
        per_task_usd: z.number().positive().default(1),
      })
      .strict()
      .default({ daily_usd: 20, per_task_usd: 1 }),
    /**
     * Named agents, keyed by id. A message routes to the agent whose sigil it matches,
     * so adding one is a config edit rather than a code change. `enabled: false` keeps an
     * agent's definition while taking it out of routing, which is what "disable" means.
     */
    agents: z
      .record(z.string(), AgentSchema)
      .refine((a) => Object.keys(a).length > 0, {
        message: "at least one agent must be defined",
      }),
    policy: PolicySchema,
  })
  .strict();

export type CrewConfig = z.infer<typeof CrewConfigSchema>;
export type Policy = z.infer<typeof PolicySchema>;

/** A message as the poller sees it, after parsing the MCP's text response. */
export interface InboundMessage {
  channelId: string;
  ts: string;
  author: string;
  text: string;
  /** True when the body carries Slack's server-appended `*Sent using* <@…|…>`. */
  hasServerSuffix: boolean;
}

export type Decision =
  | { allow: true; sigil: string }
  | { allow: false; ruleId: string; reason: string };

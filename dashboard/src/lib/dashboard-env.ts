import { z } from "zod";

const DashboardEnvSchema = z.object({
  CLAUDE_BIN: z.string().min(1).default("claude"),
  ANTHROPIC_API_KEY: z.string().optional(),
  DASHBOARD_API_KEY: z.string().min(1),
  DASHBOARD_ADMIN_USER: z.string().optional(),
  DASHBOARD_ADMIN_PASSWORD: z.string().optional(),
  DASHBOARD_SESSION_SECRET: z.string().min(16).optional(),
  DASHBOARD_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  DASHBOARD_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  DASHBOARD_AGENT_CWD: z.string().optional(),
  /** Passed to `claude -p` as `--permission-mode` (e.g. acceptEdits, default). */
  DASHBOARD_AGENT_PERMISSION_MODE: z
    .string()
    .optional()
    .transform((value) => {
      const trimmed = value?.trim();
      return trimmed !== undefined && trimmed.length > 0 ? trimmed : "acceptEdits";
    }),
  DASHBOARD_AGENT_TIMEOUT_MS: z.coerce.number().int().positive().default(300_000),
  DASHBOARD_STREAM_MAX_BUFFER_BYTES: z.coerce.number().int().positive().default(64 * 1024 * 1024),
});

export type DashboardEnv = z.infer<typeof DashboardEnvSchema>;

let cached: DashboardEnv | null = null;
let cachedError: Error | null = null;

/**
 * Lazy-parse dashboard env once per isolate. Safe for Edge (middleware); no Node builtins.
 */
export function getDashboardEnv(): DashboardEnv {
  if (cached !== null) return cached;
  if (cachedError !== null) throw cachedError;
  const parsed = DashboardEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    cachedError = new Error(`Invalid dashboard env: ${parsed.error.message}`);
    throw cachedError;
  }
  cached = parsed.data;
  return cached;
}

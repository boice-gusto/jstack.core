import type { RepairAction } from "./dependency-resolver.js";

/**
 * Per-action-kind consent defaults for `jstack doctor --fix --apply`.
 *
 * Invariant: config-mutating actions (set_config) must default to No, so
 * applying repairs requires the user to actively type --apply AND say Yes.
 * Idempotent/reversible actions (mkdir, write_file with ifMissing) default
 * to Yes for ergonomics. shell_hint defaults to No because we never
 * auto-execute shell commands.
 *
 * Exported as its own file so unit tests can import this invariant without
 * pulling in commands/doctor.ts and its transitive script imports.
 */
export const REPAIR_CONSENT_DEFAULT: Record<RepairAction["kind"], boolean> = {
  mkdir: true,
  write_file: true,
  set_config: false,
  shell_hint: false,
};

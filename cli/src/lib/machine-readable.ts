/**
 * Resolved `skills.machine_readable` after merging user config with plugin defaults.
 * Matches `config/defaults.json` when keys are omitted.
 */
export type MachineReadableSettings = {
  enabled: boolean;
  require_schema_ref: boolean;
};

function readMachineReadableSlice(root: Record<string, unknown> | undefined): {
  enabled?: boolean;
  require_schema_ref?: boolean;
} {
  if (!root) return {};
  const skills = root.skills as Record<string, unknown> | undefined;
  const mr = skills?.machine_readable as Record<string, unknown> | undefined;
  if (!mr) return {};
  const enabled = mr.enabled;
  const require_schema_ref = mr.require_schema_ref;
  return {
    enabled: typeof enabled === "boolean" ? enabled : undefined,
    require_schema_ref: typeof require_schema_ref === "boolean" ? require_schema_ref : undefined,
  };
}

/**
 * Effective flags for automation and doctor. User `jstack.config.json` overrides plugin `defaults.json`.
 */
export function resolveMachineReadableSettings(
  cfg: Record<string, unknown>,
  defaultsCfg?: Record<string, unknown>,
): MachineReadableSettings {
  const u = readMachineReadableSlice(cfg);
  const d = readMachineReadableSlice(defaultsCfg);
  return {
    enabled: u.enabled ?? d.enabled ?? true,
    require_schema_ref: u.require_schema_ref ?? d.require_schema_ref ?? false,
  };
}

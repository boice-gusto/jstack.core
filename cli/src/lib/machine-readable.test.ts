import { describe, expect, test } from "bun:test";
import { resolveMachineReadableSettings } from "./machine-readable.js";

describe("resolveMachineReadableSettings", () => {
  test("defaults when cfg and defaults omit machine_readable", () => {
    expect(resolveMachineReadableSettings({ team: {} })).toEqual({
      enabled: true,
      require_schema_ref: false,
    });
  });

  test("user overrides defaults", () => {
    expect(
      resolveMachineReadableSettings(
        { skills: { machine_readable: { enabled: false, require_schema_ref: true } } },
        { skills: { machine_readable: { enabled: true, require_schema_ref: false } } },
      ),
    ).toEqual({ enabled: false, require_schema_ref: true });
  });

  test("defaults fill missing user keys", () => {
    expect(
      resolveMachineReadableSettings(
        { skills: { machine_readable: { enabled: false } } },
        { skills: { machine_readable: { require_schema_ref: true } } },
      ),
    ).toEqual({ enabled: false, require_schema_ref: true });
  });

  test("ignores non-boolean machine_readable fields", () => {
    expect(
      resolveMachineReadableSettings({
        skills: { machine_readable: { enabled: "yes" as unknown as boolean } },
      }),
    ).toEqual({ enabled: true, require_schema_ref: false });
  });
});

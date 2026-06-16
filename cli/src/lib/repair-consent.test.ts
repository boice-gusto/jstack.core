import { describe, expect, test } from "bun:test";
import { REPAIR_CONSENT_DEFAULT } from "./repair-consent.js";

describe("REPAIR_CONSENT_DEFAULT — QA invariant: config-mutating actions are default-No", () => {
  test("set_config defaults to No (config writes require explicit Yes)", () => {
    expect(REPAIR_CONSENT_DEFAULT.set_config).toBe(false);
  });

  test("mkdir defaults to Yes (idempotent, reversible)", () => {
    expect(REPAIR_CONSENT_DEFAULT.mkdir).toBe(true);
  });

  test("write_file defaults to Yes (only fires when ifMissing is true)", () => {
    expect(REPAIR_CONSENT_DEFAULT.write_file).toBe(true);
  });

  test("shell_hint defaults to No (we never auto-run shells)", () => {
    expect(REPAIR_CONSENT_DEFAULT.shell_hint).toBe(false);
  });

  test("every RepairAction kind has a consent default", () => {
    const kinds: Array<keyof typeof REPAIR_CONSENT_DEFAULT> = [
      "mkdir",
      "write_file",
      "set_config",
      "shell_hint",
    ];
    for (const k of kinds) {
      expect(typeof REPAIR_CONSENT_DEFAULT[k]).toBe("boolean");
    }
  });
});

/**
 * Validates optional skill mirror rows in config/skill-alias-map.json.
 * Default: print warnings, exit 0. --strict: exit 1 on any warning.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));

const MirrorRowSchema = z.object({
  gateId: z.string().min(1),
  coreRelPath: z.string().min(1),
  cursorRelPath: z.string().optional(),
  gustoRelPath: z.string().optional(),
  requireIdentical: z.boolean().optional().default(false),
  notes: z.string().optional(),
});

const MapSchema = z.object({
  version: z.number().int().nonnegative(),
  mirrors: z.array(MirrorRowSchema),
});

export type AliasDriftResult = {
  /** Affects exit 1 only with --strict (or doctor --strict). */
  warnings: string[];
  /** Always exit 1. */
  errors: string[];
  /** Optional overlays not checked in (path missing); never fails CI. */
  notes: string[];
};

function repoRootFromCore(): string {
  const jstackCore = join(__dirname, "..");
  return join(jstackCore, "..");
}

function fileSha256(absPath: string): string {
  return createHash("sha256").update(readFileSync(absPath)).digest("hex");
}

function relPathToGateId(coreRelPath: string): string | null {
  const prefix = "jstack.core/skills/";
  const suffix = "/SKILL.md";
  if (!coreRelPath.startsWith(prefix) || !coreRelPath.endsWith(suffix)) {
    return null;
  }
  const mid = coreRelPath.slice(prefix.length, -suffix.length);
  return `jstack:${mid}`;
}

/** Exported for `jstack doctor --strict`. */
export function validateSkillAliasDrift(): AliasDriftResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const notes: string[] = [];
  const repoRoot = repoRootFromCore();
  const mapPath = join(__dirname, "..", "config", "skill-alias-map.json");
  if (!existsSync(mapPath)) {
    warnings.push(`skill-alias-map.json missing at ${mapPath}`);
    return { warnings, errors, notes };
  }

  let parsed: z.infer<typeof MapSchema>;
  try {
    const raw: unknown = JSON.parse(readFileSync(mapPath, "utf8"));
    parsed = MapSchema.parse(raw);
  } catch (e) {
    errors.push(`Invalid skill-alias-map.json: ${e instanceof Error ? e.message : String(e)}`);
    return { warnings, errors, notes };
  }

  for (const row of parsed.mirrors) {
    const coreAbs = join(repoRoot, row.coreRelPath);
    if (!existsSync(coreAbs)) {
      errors.push(`coreRelPath missing: ${row.coreRelPath} (gateId ${row.gateId})`);
      continue;
    }

    const derived = relPathToGateId(row.coreRelPath);
    if (derived !== null && derived !== row.gateId) {
      warnings.push(
        `gateId ${row.gateId} does not match core path (expected ${derived} for ${row.coreRelPath})`,
      );
    }

    const paths: { label: string; rel: string | undefined }[] = [
      { label: "cursorRelPath", rel: row.cursorRelPath },
      { label: "gustoRelPath", rel: row.gustoRelPath },
    ];

    const existingHashes: string[] = [fileSha256(coreAbs)];

    for (const { label, rel } of paths) {
      if (rel === undefined || rel.trim() === "") continue;
      const abs = join(repoRoot, rel);
      if (!existsSync(abs)) {
        notes.push(`Mirror skipped (${label} not in tree): ${rel} — gateId ${row.gateId}`);
        continue;
      }
      existingHashes.push(fileSha256(abs));
    }

    if (row.requireIdentical && existingHashes.length > 1) {
      const first = existingHashes[0];
      for (let i = 1; i < existingHashes.length; i++) {
        if (existingHashes[i] !== first) {
          warnings.push(
            `requireIdentical: content drift for gateId ${row.gateId} (hash mismatch vs core)`,
          );
          break;
        }
      }
    }
  }

  return { warnings, errors, notes };
}

function main(): void {
  const strict = process.argv.includes("--strict");
  const verbose = process.argv.includes("--verbose");
  const { warnings, errors, notes } = validateSkillAliasDrift();

  for (const e of errors) {
    console.error(`alias-drift error: ${e}`);
  }
  for (const w of warnings) {
    console.warn(`alias-drift warn: ${w}`);
  }
  if (verbose) {
    for (const n of notes) {
      console.log(`alias-drift note: ${n}`);
    }
  }

  if (errors.length > 0) {
    process.exit(1);
  }
  if (strict && warnings.length > 0) {
    process.exit(1);
  }
}

main();

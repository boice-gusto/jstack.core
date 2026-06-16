import { z } from "zod";
import { McpRegistrySchema, type McpRegistry } from "../types/mcp-registry.js";

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/** Narrow unknown to a plain object for mergeDeep; non-objects become {}. */
export function asRecord(x: unknown): Record<string, unknown> {
  return isPlainObject(x) ? x : {};
}

export const GbrainSliceSchema = z.object({
  team: z
    .object({
      url: z.string().optional(),
      trust_policy: z.string().optional(),
    })
    .optional(),
  personal: z
    .object({
      url: z.string().optional(),
      trust_policy: z.string().optional(),
    })
    .optional(),
});

export type GbrainSlice = z.infer<typeof GbrainSliceSchema>;

export const KnowledgeBaseSliceSchema = z.object({
  roots: z.array(z.string()).optional(),
  gbrain: z
    .object({
      include: z.boolean().optional(),
      note: z.string().optional(),
    })
    .optional(),
});

export type KnowledgeBaseSlice = z.infer<typeof KnowledgeBaseSliceSchema>;

export type SetupDefaultsSlices = {
  defGbrain: Record<string, unknown>;
  defSession: Record<string, unknown>;
  defKb: Record<string, unknown>;
  defKbGbrain: Record<string, unknown>;
  defKs: Record<string, unknown>;
  defPe: Record<string, unknown>;
  defaultsTeam: Record<string, unknown>;
  defaultGbrain: GbrainSlice;
  defaultKb: KnowledgeBaseSlice;
  mcpExisting: McpRegistry | undefined;
};

/**
 * Narrow `defaults.json` sections used by setup without casting the full tree to JstackConfig.
 */
export function extractSetupSlices(defaults: Record<string, unknown>): SetupDefaultsSlices {
  const defGbrain = asRecord(defaults.gbrain);
  const defSession = asRecord(defaults.session);
  const defKb = asRecord(defaults.knowledge_base);
  const kbRaw = defaults.knowledge_base;
  const defKbGbrain = isPlainObject(kbRaw) ? asRecord(kbRaw.gbrain) : {};
  const defKs = asRecord(defaults.knowledge_storage);
  const defPe = asRecord(defaults.pe);
  const defaultsTeam = asRecord(defaults.team);

  const gbrainParsed = GbrainSliceSchema.safeParse(defaults.gbrain);
  const defaultGbrain: GbrainSlice = gbrainParsed.success ? gbrainParsed.data : {};

  const kbParsed = KnowledgeBaseSliceSchema.safeParse(defaults.knowledge_base);
  const defaultKb: KnowledgeBaseSlice = kbParsed.success ? kbParsed.data : {};

  const mcpParsed = McpRegistrySchema.safeParse(defaults.mcp_servers);
  const mcpExisting: McpRegistry | undefined = mcpParsed.success ? mcpParsed.data : undefined;

  return {
    defGbrain,
    defSession,
    defKb,
    defKbGbrain,
    defKs,
    defPe,
    defaultsTeam,
    defaultGbrain,
    defaultKb,
    mcpExisting,
  };
}

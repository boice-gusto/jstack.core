import { z } from "zod";

/** Optional convention from output-formats: single JSON object with type/version. */
export const StructuredJsonEnvelopeSchema = z
  .object({
    type: z.string().min(1),
    version: z.string().min(1),
  })
  .passthrough();

export type StructuredJsonEnvelope = z.infer<typeof StructuredJsonEnvelopeSchema>;

export type ParseStructuredJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

export function parseStructuredJsonText(text: string): ParseStructuredJsonResult {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "Empty response" };
  }
  try {
    const value: unknown = JSON.parse(trimmed);
    return { ok: true, value };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid JSON";
    return { ok: false, error: msg };
  }
}

export type ValidateEnvelopeResult =
  | { ok: true; data: StructuredJsonEnvelope }
  | { ok: false; error: string };

export function validateStructuredEnvelope(value: unknown): ValidateEnvelopeResult {
  const r = StructuredJsonEnvelopeSchema.safeParse(value);
  if (!r.success) {
    return { ok: false, error: r.error.message };
  }
  return { ok: true, data: r.data };
}

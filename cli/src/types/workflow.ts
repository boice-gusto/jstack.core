import { z } from "zod";

/**
 * `value` on a "fill" step holds either a literal, or -- for a secret -- an `env:VAR_NAME`
 * reference. The executor never writes the resolved value back into this definition; it
 * resolves `env:` at run time and instructs the agent never to echo it. See
 * `workflow-engine.ts`'s `buildWorkflowRunPrompt`.
 *
 * A discriminated union on `kind`, not a flat object with every field optional: the old shape
 * let a `goto` with no `url` or a `fill` with no `value` parse successfully -- semantically
 * incomplete steps that every real construction site and fixture already avoids (see
 * `skills/workflows/builder/SKILL.md`'s "every click/fill needs a preceding wait on its own
 * selector"), but that a hand-edited or shared workflow file could still slip past validation
 * with. `screenshot` and `ai` require no field beyond `notes` -- `ai` is a free-form,
 * agent-directed step by design (there is no assertion kind; a check is a `wait`).
 *
 * Every required field uses `min(1)`, not bare `z.string()`: the discriminated union closed the
 * missing-key case (a `goto` with no `url` key) but originally still let the key be present with
 * an empty string (`url: ""`), which is the same semantically-incomplete step the union exists
 * to reject.
 */
export const WorkflowStepSchema = z.discriminatedUnion("kind", [
  z.object({
    id: z.string().min(1),
    kind: z.literal("goto"),
    url: z.string().min(1),
    notes: z.string().optional(),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal("click"),
    selector: z.string().min(1),
    notes: z.string().optional(),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal("fill"),
    selector: z.string().min(1),
    value: z.string().min(1),
    notes: z.string().optional(),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal("wait"),
    selector: z.string().min(1),
    notes: z.string().optional(),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal("screenshot"),
    notes: z.string().optional(),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal("ai"),
    notes: z.string().optional(),
  }),
]);

/**
 * No standalone `start_url` field. It used to be a second representation of "where does this
 * workflow start," kept in sync with `steps[0]` (when that step is a `goto`) by hand at every
 * write site -- a definition whose first recorded step wasn't a `goto` (hand-edited, imported,
 * or from a future step kind) could have the two silently disagree, with nothing to catch it.
 * `workflowStartUrl()` below derives it from `steps[0]` on read instead. Parsing a legacy file
 * that still has a `start_url` key just drops the unrecognized key (Zod's default behavior for
 * a plain, non-strict object) -- no migration step needed.
 */
export const WorkflowDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  steps: z.array(WorkflowStepSchema),
  created_at: z.string().optional(),
});

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;

/** Where a workflow starts, derived from its first step -- undefined if that step isn't a `goto`
 * (e.g. a hand-edited or imported definition), since there's then no start URL to report. */
export function workflowStartUrl(def: WorkflowDefinition): string | undefined {
  const first = def.steps[0];
  return first?.kind === "goto" ? first.url : undefined;
}

# TODOs

Deferred work identified during review, not yet scheduled. Each entry has enough context for
someone picking it up later to understand the motivation and where to start.

## Content-consistency check for skill/agent prose

**What:** A CI check that catches drift between `agents/*.md`'s "Configuration read order"
sections and `docs/agents-config-matrix.md`'s per-agent namespace column, and between a
skill's frontmatter `description` and its own body's mission statement.

**Why:** This session's skill/agent quality pass fixed ~39 content issues (wrong descriptions,
stale mission statements, config-matrix rows naming namespaces an agent doesn't actually read).
None of these have automated regression protection: `scripts/agents-check.ts` and
`scripts/skills-depth-check.ts` verify frontmatter presence and link validity, not prose
accuracy. A future hand-edit could silently revert any of these fixes — e.g. `product-pm.md`'s
config namespaces back to the wrong `pe.*`/`impact.*`, or `engineering/silo-scan/SKILL.md`'s
description back to "detect overlapping work" — and every existing CI gate would still pass.

**Pros:** Closes a real, demonstrated bug class (this exact drift already happened once,
undetected, until a review caught it). Cheap to check mechanically for the matrix-namespace
case specifically (string containment: does every namespace token in an agent's matrix row
appear somewhere in that agent's own file).

**Cons:** A general "is this English sentence still accurate" checker isn't mechanically
checkable — only the structured piece (matrix namespace tokens vs. agent file content) is.
Scope needs to stay narrow (that one bug class) rather than growing into an open-ended prose
linter, or the cost/value ratio flips.

**Context:** Surfaced during a `/plan-eng-review` retrospective review of
`fix/simplification-audit-round1` (2026-08-25). See commits `5e71b17` (product-pm matrix
contradiction), `29a9b32` (silo-scan body/description mismatch) for the exact bug class this
would catch.

**Depends on / blocked by:** None. Standalone script, could live alongside
`scripts/agents-check.ts`.

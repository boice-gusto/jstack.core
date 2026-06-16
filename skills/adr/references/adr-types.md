# ADR kinds (pick one per record)

These are **emphasis lenses**, not separate tools. Every ADR still uses the same base sections (title, status, context, decision, consequences). Adjust tone and required depth by kind.

| Kind | Focus | Typical readers | Extra prompts |
|------|--------|-----------------|---------------|
| **engineering** | Systems, APIs, data flows, reliability, performance | Engineers, SRE | Constraints, failure modes, migration, rollback |
| **design** | UX patterns, accessibility, content strategy, design-system usage | Design + eng | User scenarios, alternatives rejected for UX reasons |
| **team** | Ways of working, review gates, ownership, ceremonies | EM, ICs | Who decides what, exceptions, review cadence |
| **codebase** | Module boundaries, package layout, naming, tooling in-repo | Contributors | Affected paths, refactor plan, deprecation |
| **org** | Policy alignment, vendor/legal/compliance stance, multi-team norms | Leadership, compliance | Stakeholders sign-off, review date, exceptions process |

**Notion vs repo:** For an ADR **inside Notion** with DB properties and team workflow, use `jstack:notion-adr`. This skill is for **markdown files in git** (or a user-specified path).

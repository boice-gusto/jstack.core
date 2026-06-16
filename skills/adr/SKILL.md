---
name: jstack-adr
description: Create or update a local markdown Architecture Decision Record (ADR) with typed context (engineering, design, team, codebase, org), discovery of adr/docs/adr folders, intake questions, and numbered filenames — writes only after confirmation.
---

# Local Markdown ADR

Produce **Architecture Decision Records as `.md` files in the repo** (or path the user names). This skill does **not** create Notion pages; for database-backed ADRs use **`jstack:notion-adr`**.

## When to use

- Recording a **technical or organizational decision** in git for traceability.
- User asks for **ADR**, **architecture decision**, **docs/decisions**, **RFC-lite**, or **supersede ADR-XXX**.
- Aligning with **`docs/adr/`**, **`adr/`**, or **`docs/decisions/`** conventions.

## Procedure

1. **Classify kind** — Ask or infer: engineering | design | team | codebase | org (see `references/adr-types.md`).
2. **Resolve output location** — Follow `references/discovery.md`: explicit path wins; else scan; else propose `docs/adr/` after user confirms.
3. **Gather context** — Use intake below; skim sibling ADRs in the chosen folder for tone, numbering, and cross-links.
4. **Draft** — Fill `references/template.md`; include **Supersedes / Superseded by** when replacing an older ADR.
5. **Confirm path and filename** — Show full path (e.g. `docs/adr/017-cache-strategy.md`) before writing.
6. **Write** — Create or overwrite only the agreed file; do not silently rename existing decisions.

## Intake questions (adapt by kind)

**All kinds**

- What problem or forcing function triggered this?
- What is decided *now* vs deferred?
- Who needs to read this in six months?

**Engineering**

- Non-functional constraints (latency, cost, compliance)?
- Failure modes and rollback?
- Migration path from current state?

**Design**

- Primary user scenarios?
- Accessibility or localization implications?
- Alternatives rejected on UX grounds?

**Team**

- Decision authority and escalation?
- How does this interact with code review or on-call?

**Codebase**

- Which packages/paths are in scope?
- Deprecation timeline for old patterns?

**Org**

- Policies or stakeholders requiring sign-off?
- Review or expiry date?

## Handoffs

- User wants **Notion ADR with properties**: **`jstack:notion-adr`** after saving markdown locally if they want both.

## References

- `references/adr-types.md` — Kind comparison and Notion vs repo distinction.
- `references/discovery.md` — Folder discovery and numbering.
- `references/template.md` — Copy-paste markdown structure and status meanings.

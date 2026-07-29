---
name: jstack-adr
description: Create or update a local markdown Architecture Decision Record (ADR) with typed context (engineering, design, team, codebase, org), discovery of adr/docs/adr folders, intake questions, and numbered filenames — writes only after confirmation.
category: adr
effort: high
---

# Local Markdown ADR

Produce **Architecture Decision Records as `.md` files in the repo** (or path the user names). This skill does **not** create Notion pages; for database-backed ADRs use **`jstack:notion-adr`**.

## When to use

- Recording a **technical or organizational decision** in git for traceability.
- User asks for **ADR**, **architecture decision**, **docs/decisions**, **RFC-lite**, or **supersede ADR-XXX**.
- Aligning with **`docs/adr/`**, **`adr/`**, or **`docs/decisions/`** conventions.

## Procedure

1. **Classify kind** — Infer from `$ARGUMENTS` if possible. If the kind is ambiguous, use **AskUserQuestion** before gathering context:

   ```
   question: "What kind of decision is this?"
   header: "ADR kind"
   options:
     - label: "Engineering"
       description: "Systems, APIs, data flows, reliability, performance."
       preview: |
         # ADR-NNN: [Title]
         **Status:** Proposed
         **Context:** [Technical forcing function]
         **Decision:** [What we're doing]
         **Constraints:** latency / cost / compliance
         **Failure modes & rollback:** ...
         **Migration path from current state:** ...
     - label: "Design"
       description: "UX patterns, accessibility, content strategy, design system."
       preview: |
         # ADR-NNN: [Title]
         **Status:** Proposed
         **Context:** [User problem or design gap]
         **Decision:** [Pattern or component chosen]
         **User scenarios:** ...
         **Accessibility / localization:** ...
         **Alternatives rejected on UX grounds:** ...
     - label: "Team"
       description: "Ways of working, review gates, ownership, ceremonies."
       preview: |
         # ADR-NNN: [Title]
         **Status:** Proposed
         **Context:** [Process friction or gap]
         **Decision:** [New norm or gate]
         **Decision authority:** [Who decides exceptions]
         **Review cadence:** ...
     - label: "Org / Policy"
       description: "Vendor, compliance, legal stance, multi-team norms."
       preview: |
         # ADR-NNN: [Title]
         **Status:** Proposed
         **Context:** [Policy or legal forcing function]
         **Decision:** [Stance or constraint adopted]
         **Stakeholder sign-off:** ...
         **Review date:** YYYY-MM-DD
         **Exceptions process:** ...
   ```

   See `references/adr-types.md` for full kind descriptions.
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

## Domain rules — adr

### Absolute rules

1. **Record the decision once it's made, not the discussion that led to it.** An ADR is not a meeting transcript; if the group hasn't actually converged, the status is `Proposed`, not `Accepted` — don't launder an open debate as a settled record. ([Nygard's original ADR post](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) defines the format strictly by section: Title, Context, Decision, Status, Consequences.)
2. **Never edit history — supersede it.** When a decision changes, write a new ADR with a higher number, set the old one's status to `Superseded by ADR-NNN`, and leave its original text untouched. Nygard is explicit on this: "If a decision is reversed, we will keep the old one around, but mark it as superseded" — overwriting ADR-012 in place destroys the record of what the team actually believed at the time.
3. **State reversibility explicitly.** Classify the decision as a one-way door (hard or costly to reverse — a schema migration, vendor lock-in, a public API contract) or a two-way door (cheap to reverse — an internal config default, a feature flag). [Amazon's 2015 shareholder letter](https://www.aboutamazon.com/news/company-news/2016-letter-to-shareholders) argues two-way doors warrant a lightweight process; naming the door type tells a future reader how much scrutiny this decision earned before they read another word of it.
4. **Consequences are not optional filler.** Every ADR states what becomes true, easier, or harder after the decision — including at least one negative or deferred consequence. An ADR with no downside listed reads as marketing, not a record.
5. **One decision per ADR.** If the draft bundles two independent choices ("we'll use Postgres AND rewrite the auth layer"), split it — a future reader superseding one choice shouldn't have to touch the other.
6. **Never assign a number or write a file the user hasn't confirmed.** Show the full path before writing (Procedure step 5) — a wrong number collides with a concurrent ADR from a teammate.

### Status gate

| Signal | Status to write |
|---|---|
| Decision maker(s) have not yet signed off | `Proposed` |
| Explicit sign-off recorded (thread, meeting note, or ADR review) | `Accepted` |
| A newer ADR replaces this one | `Superseded by ADR-NNN` |
| Decision no longer applies but nothing formally replaced it | `Deprecated` |

### Named anti-patterns

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| Recording a foregone conclusion as "Context" | Reads as decision theater; hides that the real deliberation happened elsewhere (Slack, an unminuted meeting) | State the actual forcing function and the options that were on the table, even briefly |
| Editing an old ADR's Decision section in place | Destroys the audit trail; a reader relying on ADR-004 six months from now gets today's answer, not what shipped then | Write a new ADR, mark the old one `Superseded by ADR-NNN` |
| Skipping reversibility | Treats a one-way door (data migration, public contract) with the same casual process as a two-way door (a default timeout value) | Name the door type; scale review rigor to it |
| "Consequences: none" | No decision is free — this line usually means the tradeoffs weren't actually thought through | Name at least one cost, risk, or deferred item |
| Bundling unrelated decisions in one ADR | Makes future superseding ambiguous — which part changed? | Split into separate numbered ADRs, cross-link if related |

### Worked example

- *Weak Context/Decision:* "We talked about databases and decided to use Postgres because it's what we know."
- *Sharp Context/Decision:* "**Context:** Our current SQLite instance can't support concurrent writes past normal peak load, and the new billing feature needs transactional multi-row writes from three services. **Decision:** We will migrate to Postgres 16, run via the existing managed-DB pattern (see ADR-009). **Reversibility:** One-way door — the migration script is one-directional and the billing service is being built against Postgres-specific transaction semantics. **Consequences:** Adds an ops dependency (connection pooling, backup cadence) we don't currently operate; buys us row-level locking the billing feature requires. Deferred: read replicas, only if reporting load becomes a problem."

### What this skill must not do

- Does not decide the technical or organizational question itself — it records a decision the user has already made or is actively converging on; if the user wants options analysis first, hand off to `jstack:advice`, then come back to record the outcome.
- Does not create Notion-backed ADRs with properties or views — that's `jstack:notion-adr`.
- Does not renumber or silently overwrite an existing ADR file to "fix" it — supersede instead (Absolute rule 2).

## Handoffs

- User wants **Notion ADR with properties**: **`jstack:notion-adr`** after saving markdown locally if they want both.

## References

- `references/adr-types.md` — Kind comparison and Notion vs repo distinction.
- `references/discovery.md` — Folder discovery and numbering.
- `references/template.md` — Copy-paste markdown structure and status meanings.

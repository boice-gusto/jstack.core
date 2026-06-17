# AskUserQuestion patterns (host option picker)

When the host exposes **AskUserQuestion** (or an equivalent structured picker), use it for discrete choices instead of free-form “reply A or B” in plain text.

## Schema (conceptual)

Align with the [Claude Code tools reference](https://code.claude.com/docs/en/tools-reference): questions may include `header`, `question`, `options` with `label`, `description`, and `preview`, plus `multiSelect`.

- **`label`** — short, scannable (1–5 words).
- **`description`** — one line of context so the picker is self-explanatory without the preview.
- **`preview`** — markdown rendered in a side-by-side panel when the user focuses this option. **Use when the choice determines the output shape** — templates, tones, report formats, ADR kinds. When any option has a `preview`, the UI switches to a two-column layout with option list left and live preview right. Keep preview content under ~30 lines; long previews truncate.
- **`multiSelect`** — only when multiple simultaneous choices are valid (e.g. two impact frameworks).

## Rules

1. **One blocking question per invocation** when possible (see `question-patterns.md`).
2. Show a **progress line** before the question when part of a multi-step flow: `Step 2/5 — Impact framing`.
3. **Always ≥2 options** for single-select pickers; include **”Other — I’ll type it”** or **”Cancel”** when otherwise you would have only one real choice.
4. **Chunk long lists** — if more than ~4 options, split into rounds (e.g. pick category, then item) or use search-first.
5. Do **not** promise a specific keyboard or horizontal “wizard” layout; rendering depends on Claude Code, Cursor, or SDK.
6. **Add `preview:` when the option IS a template** — tone samples, report skeletons, retro formats. Without a preview, users are choosing blindly.

Cross-reference **`jstack` CLI** (Clack) vs hosts vs chat: [`cli-vs-host-interaction.md`](./cli-vs-host-interaction.md).

## Examples (generic)

**Single-select**

- Question: “Where should this brag entry go?”
- Options: Display here | Write to file | Clipboard | Append to doc (if integration configured)

**Multi-select**

- Question: “Which impact framings should this run use?”
- Options: Nine-box | Stack-rank (team) | Stack-rank (org) | Dimensions from file
- `multiSelect: true` when the skill supports combining framings.

**Confirmation**

- Options: `Confirm and continue` | `Edit before continuing` | `Cancel`

---

## Preview examples (jstack skill patterns)

### Tone selection (announcements)

```
question: “Which tone for this announcement?”
header: “Tone”
options:
  - label: “Executive”
    description: “Outcome-first, no jargon. VP+ / board / skip-level.”
    preview: |
      ## [Initiative] — Update

      We shipped X. This reduces Y by Z%.

      **Next:** [One sentence on what’s coming or who acts.]
  - label: “Internal / Eng”
    description: “Bullets, technical context. Team Slack, #eng, wiki.”
    preview: |
      ## Shipped: [Initiative]

      **What:** [1 sentence]
      **Why:** [1 sentence]
      **Impact:** [metric or outcome]
      **Next:** [owner + ETA]
  - label: “Formal / External”
    description: “Polished, policy-safe. Customer email or blog.”
    preview: |
      We are pleased to announce that [Initiative] is now available.

      [One paragraph: what it is, why it matters to the customer.]

      [CTA or next step.]
```

### ADR kind selection

```
question: “What kind of decision is this?”
header: “ADR kind”
options:
  - label: “Engineering”
    description: “Systems, APIs, data flows, reliability, performance.”
    preview: |
      # ADR-NNN: [Title]
      **Status:** Proposed
      **Context:** [Technical forcing function]
      **Decision:** [What we’re doing]
      **Constraints:** latency / cost / compliance
      **Failure modes & rollback:** ...
      **Migration path:** ...
  - label: “Design”
    description: “UX patterns, accessibility, content strategy.”
    preview: |
      # ADR-NNN: [Title]
      **Status:** Proposed
      **Context:** [User problem or design gap]
      **Decision:** [Pattern or component chosen]
      **User scenarios:** ...
      **Accessibility / l10n:** ...
      **Alternatives rejected:** ...
  - label: “Team”
    description: “Ways of working, review gates, ownership.”
    preview: |
      # ADR-NNN: [Title]
      **Status:** Proposed
      **Context:** [Process friction or gap]
      **Decision:** [New norm or gate]
      **Decision authority:** [Who decides exceptions]
      **Review cadence:** ...
  - label: “Org / Policy”
    description: “Vendor, compliance, multi-team norms.”
    preview: |
      # ADR-NNN: [Title]
      **Status:** Proposed
      **Context:** [Policy or legal forcing function]
      **Decision:** [Stance or constraint]
      **Stakeholder sign-off:** ...
      **Review date:** YYYY-MM-DD
```

### Report format selection

```
question: “Which output format?”
header: “Format”
options:
  - label: “Exec summary”
    description: “3-5 bullets, outcome-first. For leadership.”
    preview: |
      ## [Team] — [Period] Summary

      - **Shipped:** X, Y, Z
      - **Impact:** [metric]
      - **Blocked:** [one item or none]
      - **Next:** [sprint goal]
  - label: “Prose narrative”
    description: “Paragraph format with analysis. For wikis or docs.”
    preview: |
      ## [Team] — [Period]

      This sprint the team focused on [theme]. We shipped [X], which [impact].
      The main blocker was [Y]; it was resolved by [Z] on [date].
  - label: “HTML dashboard”
    description: “Interactive single-page file with charts. Hand off to jstack-visual-single-page-html.”
    preview: |
      → Generates a self-contained report.html with:
        • KPI cards (velocity, shipped, blocked)
        • Sprint burndown chart
        • Section toggles for each team area
```

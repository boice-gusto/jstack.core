# AskUserQuestion patterns (host option picker)

When the host exposes **AskUserQuestion** (or an equivalent structured picker), use it for discrete choices instead of free-form “reply A or B” in plain text.

## Schema (conceptual)

Align with the [Claude Code Agent SDK user-input docs](https://code.claude.com/docs/en/agent-sdk/user-input): questions may include `header`, `question`, `options` with `label` and `description`, and `multiSelect`.

- **`label`** — short, scannable.
- **`description`** — one line of context so the picker is self-explanatory.
- **`multiSelect`** — only when multiple simultaneous choices are valid (e.g. two impact frameworks).

## Rules

1. **One blocking question per invocation** when possible (see `question-patterns.md`).
2. Show a **progress line** before the question when part of a multi-step flow: `Step 2/5 — Impact framing`.
3. **Always ≥2 options** for single-select pickers; include **“Other — I’ll type it”** or **“Cancel”** when otherwise you would have only one real choice.
4. **Chunk long lists** — if more than ~4 options, split into rounds (e.g. pick category, then item) or use search-first.
5. Do **not** promise a specific keyboard or horizontal “wizard” layout; rendering depends on Claude Code, Cursor, or SDK.

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

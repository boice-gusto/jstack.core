# Accuracy rules for standups, brags, and digests

Use these rules whenever summarizing a person’s or team’s work from Slack, Jira, GitHub, or calendar.

## Activity vs commitment

- **Never** state that someone **did** or **completed** work when the evidence only shows they **agreed**, **planned**, **scheduled**, or **discussed** it.
- Treat “we should…” threads as **intent**, not delivery, unless a follow-up message confirms shipping or merge.

## Pull requests

Tier annotations (include in summaries when citing PRs):

| State | Annotation | Language |
|-------|------------|----------|
| Merged | (none) | May use “shipped” / “merged” if merged to the intended branch. |
| Open, meaningful review/commits | `[In Progress]` | Frame as work in flight: “Iterating on…”, “Driving review for…”. |
| Open, trivial | `[Started]` | Omit unless it represents meaningful new work. |
| Closed without merge | `[Closed - not merged]` | Include only if there was significant review or design exploration. |

**Never** use “shipped”, “delivered”, or “completed” for **unmerged** PRs.

## Evidence-only

- Omit sections or dimensions that have **no** supporting signals. Do not fabricate impact.
- Prefer ticket IDs, PR links, and permalinks when integrations provide them.

## Side work vs team work

When `team_context` or config defines team channels and projects:

- **Team work** — activity in those channels or on those tickets is always in scope.
- **Side work** — include only if substantial (e.g. threshold from config: multiple messages, long thread, or a PR). Otherwise note `[side activity omitted — below threshold]`.

## Low-signal noise

Filter out: single-word replies, emoji-only reactions, pure scheduling pings, and empty “+1” unless they close a decision.

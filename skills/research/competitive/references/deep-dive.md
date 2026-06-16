# Competitive research — deep dive (jstack-research-competitive)

## When to use

- **Compare products, vendors, or market moves** with evidence-backed notes.
- Outputs feed PRDs, pitches, or `jstack:notion-article` / `jstack:review-*`.
- **Out of scope:** Primary user research (see `jstack:research-user`) or deep technical architecture (see `jstack:research-technical`).

## Process

1. **Frame the question** — geography, segment, time window, and what “win” means.
2. **Source mix** — public sites, docs, pricing pages, reviews; label each fact with source + date.
3. **Comparison dimensions** — same columns for every competitor (features, pricing model, gaps).
4. **Implications** — so what for *your* product; separate fact from opinion (`[judgment]`).
5. **Gaps** — what you could not verify; do not fill with guesses.

## Best practices

- Prefer **primary** or **first-party** sources for pricing and features.
- Snapshot **dates** — competitive info rots fast.
- Keep a **single table** for at-a-glance scanning; move prose to “Implications.”

## Anti-patterns

- Paraphrasing marketing copy as fact without checking behavior.
- Naming competitors in a customer-facing doc without review policy (`prompts/policies/`).

## Examples

**Weak:** “Competitor X is more innovative.”  
**Strong:** “X launched API rate limits 19 Feb (blog URL). We still offer higher burst (doc URL). [judgment] We should clarify positioning for enterprise SREs.”

## Templates

- `templates/` — use org-specific battlecard or landscape templates if present.
- Cite `examples/` only when illustrating output shape, not as live market data.

## Chaining

- **To** `jstack:research-spike` — if the gap is build-vs-buy or feasibility.
- **To** `jstack:prioritize` — when research produces a list of follow-on bets.
- **To** `jstack:notion-article` — when publishing an internal or external brief.

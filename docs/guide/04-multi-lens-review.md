# 4. Multi-lens review

Sometimes one reviewer isn't enough, and averaging opinions into a bland "looks good with minor
concerns" hides exactly the disagreement you needed to see. jstack's counsel-review does the
opposite: it runs several persona lenses over one artifact and reports where they actually
disagree, attributed by name.

```
/jstack:counsel-review here's the plan for migrating session storage to the new async store —
tell me what's wrong with it
```

`jstack-counsel-review` (backed by `agents/review-counsel.md`) loads the CEO, PM, engineer, QA,
designer, and security personas and applies each one's own lens — not a generic "any concerns?"
pass. Two things it will never do: average a real disagreement into a synthetic middle position
nobody actually argued for, and quietly pick a winner on a values/priority tension (ship-now vs.
verify-first, speed vs. thoroughness) dressed up as a normal verdict. When the actual blocker is a
values call, not a fact, the verdict says so explicitly — `Verdict: Escalate` — and hands the
decision to you by name, rather than resolving it by fiat.

## Pitfall

If the response reads as "Verdict: Block, because [reason]" and the reason is actually one side
of a values disagreement stated as if it were a fact, that's the exact failure this skill was
hardened against — worth pushing back on directly ("is that a fact or a values call?") rather than
accepting a confident-sounding verdict at face value.

**Next:** [Verify and evals](./05-verify-and-evals.md)

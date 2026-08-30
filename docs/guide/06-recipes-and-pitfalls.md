# 6. Recipes and pitfalls

Real invocations, with the one phrase that changes what each skill does.

```
/jstack:recon check #eng-alerts for anything unresolved in the last hour
```
The qualifier is the time/scope window ("last hour", "#eng-alerts"). Say it explicitly — without
one, `jstack-recon` still reports, but it reports the search **coverage** it used (what it
searched, what it didn't, and why) rather than silently assuming you meant "everything."

```
/jstack:knowledge-search what's our parental leave policy
```
If it isn't documented anywhere configured, this says so — "not found in the configured source"
— instead of guessing from general knowledge. That's the point of the skill: a confident-sounding
guess about a policy is worse than an honest "not found."

```
/jstack:sprintclose
```
Runs the full close chain in order (per `prompts/chains/sprint-close-chain.md`) — team report,
Notion update, in that sequence. Missing data becomes `[no data]` in the report, never an
interpolated guess from last sprint's numbers.

```
/jstack:counsel-review [artifact] — I know this needs work, just tell me the blocking issues
```
The qualifier "just the blocking issues" is honored literally: `agents/review-counsel.md`
explicitly separates blocking defects from taste/style notes, so asking for one or the other
actually narrows the output instead of getting the same full review regardless of what you asked.

## Pitfalls, collected

- **Pasting a token or secret in chat, for any skill.** Every skill that could receive one refuses
  to write it to config or log it, and tells you to rotate it — this is intentional, not a bug to
  work around by rephrasing.
- **Judging a response by confidence, not verifiability.** A skill that names a real limitation
  ("integration not connected," "not found in configured source," "unverified — no artifact") is
  working correctly; one that never hedges on anything is the one to be suspicious of.
- **Re-running a multi-model eval once and treating the result as final.** See
  [page 5](./05-verify-and-evals.md) — live model variance is real; one sample isn't a verdict.
- **Hand-editing `jstack.config.json` for anything beyond a quick local experiment.** See
  [page 3](./03-routing-and-config.md) — use `/jstack:update-config` so an invalid config gets
  caught immediately instead of surfacing later as a confusing failure somewhere else.

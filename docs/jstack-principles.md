# jstack principles

Named, citable rules jstack.core already practices, scattered today across individual
`agents/*.md` files and this session's own build. Indexed here so a skill or agent can point at a
principle by name instead of restating it inline, and so a reviewer can ask "which principle did
this decision apply" the way `agents/review-counsel.md`'s worked examples already do internally.

Reference-only: this file is not `!cat`'d by any skill's Procedure (that would make it a
per-invocation cost with no per-domain payoff — these are guidance for *authoring* jstack, not
input a live skill run needs). Link to it from CLAUDE.md and from a skill/agent's own file when a
directive is a restatement of one of these.

## Trust & disclosure

| Principle | Rule | Where it's already practiced |
|---|---|---|
| **Disclose coverage, not completeness** | State what was searched and what wasn't; a bounded null result ("no P0s in PLAT as of 14:02 UTC") is not the same claim as "nothing is broken." | `agents/recon-scanner.md` Prime Directive 4 |
| **Never fabricate under pressure** | A direct or repeated request for a fact you don't have is answered by naming the gap, not by inventing a plausible-sounding value — even a ticket key, a token, or an org policy detail. | `skills/jira/create/SKILL.md`, `skills/setup/onboarding/SKILL.md`, `prompts/policies/sdlc-gates.md` (the "for reference only" gate-tier table) |
| **Ask before overwriting canonical truth** | A merge that would replace what the team currently treats as canonical needs an explicit confirmation question asked in words — a different blocker existing elsewhere does not substitute for asking. | `agents/knowledge-curator.md` Prime Directive 10 |
| **A skipped step stays listed, never silently dropped** | A step omitted from a plan reads as "didn't need to happen"; a step marked `skip: <reason>` reads as "considered and deliberately not run" — the fact a reviewer actually needs. | `skills/_core/references/skill-conventions.md` §7 |

## Verification

| Principle | Rule | Where it's already practiced |
|---|---|---|
| **Prove it works** | Verify against the real artifact — run the feature, read the actual value, inspect the diff — not a proxy, self-report, or "it compiles." | The entire `evals/a2a/` harness (real spawns, real judge, live-verified dashboard Codex integration); `agents/workflow-executor.md`'s unverified-run disclosure |
| **Proof-based, not judged** | When a mechanical fact (a recorded pass/fail, a measured similarity score) can answer a question, use it instead of asking a model to re-judge something already measured. | `evals/a2a/compare-lib.ts`'s categorization |
| **One fixed, independent judge** | Grading candidate A with model A (or letting the candidate grade itself) makes a pass/fail comparison meaningless — a single trusted standard is what makes "claude passed, codex failed" a real finding. | `evals/a2a/run.ts`'s judge, always Claude regardless of which model is under test |
| **Sequence verifiable units** | Break work into steps that each end in a state you can check before starting the next, and order delivery so the sequence proves itself to a reviewer. | `bun run check`'s gate chain; `agents/routine-runner.md`'s per-step status reporting |

## Delegation & scope

| Principle | Rule | Where it's already practiced |
|---|---|---|
| **Build the lever, not the hand-edit** | For any recurring check, migration, or analysis, build the tool that does it or proves it — a script, generator, or a skill your subagents follow — rather than doing it by hand each time. The tool is the artifact a reviewer can rerun. | This session's `check-agent-config-matrix.ts`, `check-description-references.ts`, `check-referenced-files.ts` — each built after a manual audit found the same class of drift twice |
| **Guard the context window** | Route bulk reading/exploration to a forked subagent; keep summaries in the main thread, not raw payloads. | `context: fork` + `agent: Explore` frontmatter (`skills/recon`, `skills/knowledge/search`, `research/*`); `skillListingBudgetFraction` |

## Meta

| Principle | Rule | Where it's already practiced |
|---|---|---|
| **Encode lessons in structure** | When a recurring mistake gets fixed by hand more than once, encode the rule as a lint, a gate, or a frontmatter check instead of writing another paragraph of prose asking people not to do it. | The three `check-*.ts` gates above all exist because the underlying drift had already been hand-corrected once before | 

## Explicitly not imported

pstack's `never-block-on-the-human` ("proceed on reversible work, let the human course-correct after") does **not** transfer as-is. jstack's ask-before-persist gates (`disable-model-invocation: true` on write/operational skills — jira creates, notion writes, announcements, sprint-close, workflow-execute) exist *because* a Slack message, a Jira write, or a KB entry is not cheaply reversible the way a local file edit is. If a never-block-style principle is adopted, scope it narrowly to jstack's own read/analysis skills, explicitly carved out from anything already gated by `disable-model-invocation`.

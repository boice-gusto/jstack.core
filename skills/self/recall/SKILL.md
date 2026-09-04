---
name: jstack-self-recall
description: >-
  Reconstruct a tight "where did I leave off" brief after a gap — a multi-day break, a context
  compaction, a fresh session — by combining live repo state (git log/status, open PRs), the local
  jstack memory store, and whatever recent conversation history the host makes available. Use for
  "catch me up," "what have I been working on," "where did I leave off," or before resuming work
  after a break. Do NOT use for a reflective review of the last N days' patterns and growth — that
  is `jstack:self-lookback`. Do NOT use to bootstrap a brand-new session's config (gbrain target,
  timezone) — that is `jstack:init-session`; recall reconstructs what already happened, it does not
  set up what happens next. Inspired by pstack's `recall` skill, adapted to jstack conventions and
  to host-agnostic sourcing (no assumption about where or how the host stores chat transcripts).
category: self
effort: medium
generator: skip
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config, topic_or_scope -->
<!-- outputs: current_state_brief -->
<!-- chains-to: jstack:init-session -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Rebuild a tight, current brief of what was being worked on and where it stands — for resuming
after a real gap (a break, a context compaction, a new session), not a running status report
during continuous work. Combines live git/PR state, the local jstack memory store, and recent
conversation when the host exposes it, into one capsule with concrete next steps.
- **Out of scope:** Reflective pattern-surfacing over a time window (gentle, personal-growth
  framing) — that is `jstack:self-lookback`. Setting up a new session's gbrain target or timezone —
  that is `jstack:init-session`, which starts something new rather than reconstructing what already
  happened. Resuming one specific named prior conversation the user already identified — if they've
  already told you which thread, just resume it; this skill is for when they haven't.

## Domain rules — context reconstruction
- Live state overrides memory. `git status`/`git log`/`gh pr list` reflect what's actually true
  right now; a memory-store entry or a remembered conversation is history, not current truth — if
  they disagree, say so and trust the live state.
- Never fabricate what happened when the record doesn't cover it. If neither live state, the
  memory store, nor available conversation history explain a gap, say "unknown" — a plausible-
  sounding guess is worse than an honest gap, because it will be acted on as if it were true.
- Scope the window explicitly before searching. "Recent" defaults to whatever the user's own
  memory/session records span (e.g. jstack's own `session.current_session_id` boundary, or the
  active conversation) — state the window back rather than silently guessing a range.
- Stay tight. This is a capsule for resuming work, not a full replay — cut deeper detail before
  cutting a real open thread; if there's more to say than fits, trim prose, not threads.
- Treat unfamiliar branch/stash/uncommitted state as possibly real in-progress work, not merge
  debris — the same git-safety posture used throughout this repo. Investigate before assuming it's
  safe to discard.

### Named anti-patterns

| Anti-pattern | Why it's wrong | Do this instead |
|---|---|---|
| Fabricating a plausible-sounding continuation when the record doesn't actually cover a gap | Gets acted on as fact; a false "you were fixing X" sends the user down the wrong path | Say "unknown" for the gap explicitly, and name what evidence would close it |
| Treating a memory-store entry or old conversation as current truth without checking live state | Git/PR state changes independently of what was recorded; a stale note can contradict reality | Check `git status`/`git log`/`gh pr list` and let live state override anything that conflicts |
| Assuming an unfamiliar branch or uncommitted change is leftover debris safe to ignore or clean up | It may be real in-progress work (yours or someone else's) that this skill has no business discarding | Investigate what it is (recent commits, `git stash list`, branch name) before assuming anything about it |
| Producing a full transcript replay instead of a tight capsule | Defeats the purpose — a "catch me up" nobody can read in under a minute isn't a catch-up | Lead with the capsule and concrete next move; push deep detail below or cut it entirely |

### Worked example

- *Weak:* "You were working on some skills stuff recently, not sure exactly what state it's in."
- *Sharp:* "**Capsule:** Last real action was committing `feat(skills): add pr-review-canvas` on
  branch `feat/pr-review-canvas-skill` (2 commits, not pushed) — verified end-to-end against a real
  merged PR. **Thread:** `[in flight feat/pr-review-canvas-skill]` skill added, evals generated,
  `bun run check` green; not yet pushed or opened as a PR. **Next move:** push the branch and open
  the PR, or keep building the additional skills that were recommended and not yet started." — built
  by actually reading `git log`/`git status`/`gh pr list`, not recalled from memory.

## Config and references
- `jstack.config.json` — `session.*` for the current session id/window boundary; `gbrain` if a
  team/personal knowledge store is configured and worth checking. Never hardcode.
- `jstack memory` — this repo's local, durable jsonl store for `self/*` skills; check it for
  recent durable facts/decisions before assuming there are none.
- Questions (open-ended, one at a time): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/question-patterns.md`
- Chaining: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/chaining-guide.md`

## Intake
1. Parse `$ARGUMENTS` for a topic or scope ("my work on X," "what have I been doing"). If none is
   given, default to pure recent-activity recall across live state and available conversation.
2. If the user already handed you a full state capsule (paths, branch, what changed), use it
   directly and skip the mining — don't re-derive what's already been stated.
3. If the request bundles recall with a new ask ("catch me up, then also do Y"), recall first and
   confirm the brief before starting Y — Y might change once the brief surfaces something relevant.

## Procedure
### Step 1 — Load config
Read `session.*` from `jstack.config.json` for the current session boundary, and `gbrain` config
if a team/personal store might hold relevant recent decisions. Don't force a lookup that isn't
relevant to a pure git-state recall.

### Step 2 — Plan the safe path
Decide the window (default: since the last clean state you can identify — a merge, a session
boundary, or "as far back as available conversation/memory reaches") and the scope (named topic,
or general activity). State both back before searching, rather than silently picking a range.

### Step 3 — Execute
1. **Live state first:** `git status`, `git log --oneline -20`, `git branch --show-current`,
   `gh pr list --state all` (scoped to recent) — this is ground truth for what actually exists
   right now.
2. **Local memory:** check `jstack memory` for durable entries in the scoped window; check gbrain
   if configured and the topic looks team-relevant.
3. **Conversation history, if the host exposes it:** if the current session's own context or a
   host-provided transcript mechanism covers the gap, read it for decisions and open threads. If
   the host supports spawning parallel read-only research subagents and the corpus is large, fan
   the reading out and keep only their findings in the main thread — don't pull raw transcripts in
   wholesale. If nothing is available, say so rather than guessing.
4. Cross-check what step 3 surfaced (a PR number, a branch name) against step 1's live state — a
   PR the transcript describes as "still open" may already be merged or closed by now.

### Step 4 — Validate
Confirm every named thread has one of: `[merged #N]`, `[open PR #N]`, `[in flight <branch>]`,
`[verified, uncommitted]`, `[reverted #N]`, or `[planned, not started]` — an untagged thread means
its status wasn't actually checked against live state. Confirm nothing is asserted as fact that
only came from a guess.

### Step 5 — Summarize and hand off
Deliver the brief per Output shape below. Suggest `jstack:init-session` next only if the user
actually needs a new session bootstrapped (gbrain target, timezone) — otherwise the brief itself
is the handoff back into whatever work it surfaced.

## Output shape
Use a domain-appropriate heading, then:
- **Summary** (the capsule — at most 5 bullets: what this work is and where it stands overall)
- **Details** — one line per thread, each prefixed with exactly one status tag (see Step 4); the
  recurring problems worth carrying forward (at most 5)
- **Next steps** — the single most useful next action, concrete, plus owner + timeline if known
- **Limitations** (what the window didn't cover, what's genuinely unknown)
- For eval-gated skills, end with `result_ok: true` or `result_ok: false` + reason

## Failure modes

| Symptom | Recovery |
|---------|----------|
| No conversation history available from the host | Say so; rely on live git/PR state and the local memory store, and state that as a limitation. |
| A memory-store entry contradicts live git/PR state | Trust live state; note the contradiction explicitly rather than silently picking one. |
| Topic named is too broad ("everything") | Ask one question to scope it, or default to pure recent-activity recall and say that's what you did. |
| An unfamiliar branch/stash turns up mid-recall | Investigate before saying anything about its safety to remove; do not delete or ignore it here. |
| gbrain/integration unavailable | Say so for that source specifically; don't let one missing source make the whole brief look thinner than what was actually found. |

## Chaining
Complete the work here. Suggest `suggested_next: jstack:init-session` only if a genuinely new
session needs bootstrapping. Do not auto-invoke without user intent.

## User request

$ARGUMENTS

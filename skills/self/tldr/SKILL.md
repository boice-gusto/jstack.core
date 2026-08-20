---
name: jstack-self-tldr
description: Compress a prior Claude response or a long pasted passage in this conversation into a short, ranked bullet summary that ends with an explicit next-step offer, then keep every follow-up in the exchange concise instead of ballooning back into a wall of text. Use for "tl;dr", "summarize that", "give me the short version", "too long, summarize", or any ask to shorten output already produced here. Do not use on content that's already short (a sentence or two) — say so instead of manufacturing a summary of nothing — and do not use when the user asks for the FULL detail after already receiving a summary from this skill; that is a deeper-dive request this skill answers directly, not a new tl;dr to run.
category: self
effort: low
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Take a prior Claude response or a long pasted passage already in this conversation and return a short, human-digestible summary — then stay concise for the rest of the exchange, including when the user asks to go deeper on one point.
- **Out of scope:** Content that is already short (roughly ≤2 sentences or already a tight bullet list) — say it's already concise rather than manufacturing a summary. Also out of scope: a request for the full original detail after the user has already received a summary from this skill — that is a deeper-dive request (see Step 3), not a re-invocation.

## Domain rules — tldr

### Absolute rules

1. **Hard length ceiling on the initial summary: ≤5 bullets, ≤100 words total** (the next-step
   offer line doesn't count against the 100). Rationale: this mirrors the attention-budget framing
   `agents/executive-brief.md` uses — a reader gives a document "about 30 seconds of sustained
   attention before they move on" ([Wyzowl — Human Attention Span](https://wyzowl.com/human-attention-span/)).
   A chat reply gets less budget than a document, not more, so the cap here is tighter than that
   agent's one-page limit, not looser.
2. **Every summary ends with an explicit, low-friction next-step offer** — "Want the reasoning
   behind any of these?" or equivalent. Never silently truncate and stop; a summary with no offer
   reads as the whole story instead of a compressed one.
3. **Every subsequent turn in the exchange stays concise, not just the first one.** Once this
   skill is active, a "go deeper on point 2" follow-up gets a capped, direct answer about that
   point only — not a full re-expansion of everything, and not a drift back into paragraph-per-idea
   answers for the rest of the conversation. State this to yourself as a standing rule for the rest
   of the exchange, not a one-time compression step.
4. **Never drop a caveat, blocker, or open decision to hit the length ceiling.** If the source
   contains risk or uncertainty language (a caveat, a known bug, an unresolved decision, a blocker),
   it must survive into the summary — cut a lower-priority bullet instead. This is the hardest
   judgment call this skill makes: compression that quietly drops what's decision-relevant is not
   a shorter summary, it's a wrong one.
5. **No AI-slop hedging or filler.** No "It's worth noting," no "In summary," no throat-clearing
   lead-ins, no hollow closers — state the point directly, the way a sharp colleague would say it
   out loud. Follow the banned-pattern list in `skills/writing/humanizer/SKILL.md` (filler/hedge
   words, empty transitions, hollow closers, stacked intensifiers) as the tone standard for the
   summary text itself — this skill's job is compression, humanizer's is de-AI-ing the prose, and
   a tl;dr should read as if both had already been applied.

### Thresholds / criteria

| Signal | Rule | Source |
|---|---|---|
| Summary length | ≤5 bullets, ≤100 words total (next-step line excluded) | attention-budget framing, `agents/executive-brief.md` |
| Next-step offer | Every summary ends with one explicit, low-friction offer to go deeper | this skill's own contract (rule 2) |
| Caveat preservation | Any caveat/blocker/open decision in the source must appear in the summary, even if a lower-priority bullet gets cut instead | rule 4 — the hardest judgment call this skill makes |
| Follow-up length | A "go deeper" answer expands only the requested sub-topic and stays capped (target similar order of magnitude — a few short sentences, not a full re-expansion) | rule 3 — standing for the rest of the exchange |
| Already-short input | Source is ≤2 sentences or already a tight bullet list → decline to summarize further and say why | anti-pattern: summarizing a summary |

### Named anti-patterns

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| Summarizing a summary | Re-invoking on content that's already short manufactures padding, not compression | Check length/density first; if it's already ≤2 sentences or a tight bullet list, say so and stop |
| Burying the one thing that matters under 5 equally-weighted bullets | A flat, neutral list forces the reader to do the ranking the summary was supposed to do for them | Lead with the single most decision-relevant point; order the rest below it by relevance, not by source order |
| Silently dropping a caveat to hit a word count | Trims risk/uncertainty language invisibly — the reader acts on a false all-clear | Keep the caveat; cut a lower-priority bullet instead, or slightly exceed 100 words rather than lose it |

### Worked example

**Source (prior Claude output, ~180 words):**
> The team finished migrating the order-lookup service from a single Redis instance to a
> three-node Redis Cluster to fix the intermittent timeout spikes seen under peak load.
>
> The rollout used a dual-write approach: for two weeks, writes went to both the old instance and
> the new cluster while reads stayed on the old instance, so the team could compare hit rates and
> catch serialization mismatches before cutting reads over.
>
> That comparison surfaced one real problem: about 0.3% of cached objects using the legacy binary
> pickle format fail to deserialize on the new cluster's client library, because the client
> library was upgraded to a version that changed its default pickle protocol. Until every producer
> of those objects is updated, those cache misses fall back to a full database read — correct, but
> roughly 3x the latency for that slice of traffic. Three known producers were upgraded this week
> and reads cut over yesterday. Hit rate, memory usage, and failover behavior during a manual
> node-kill test all matched or beat the old setup. The remaining open item is confirming the last
> producer, a nightly batch job, has actually deployed the new client version.

**TL;DR output:**
- Redis Cluster migration for order-lookup is live — reads cut over yesterday after a 2-week
  dual-write validation.
- Open risk: ~0.3% of cached objects (legacy pickle format) fail to deserialize on the new client
  and fall back to a DB read at ~3x latency — not fully closed yet.
- 3 of 4 known producers are upgraded; the last one, a nightly batch job, still needs confirmation
  it deployed the new client.
- Everything else measured (hit rate, memory, failover) matched or beat the old setup.

Want the reasoning behind the pickle-format issue, or the failover test numbers?

**Follow-up — "go deeper on point 2":**
> The old client defaulted to pickle protocol 2; the upgraded client defaults to protocol 5.
> Protocol-5 objects don't deserialize under a protocol-2 reader, so anything written by an
> unupgraded producer looks corrupt to a client still on the old library — the cluster isn't
> broken, the producers are out of sync with it. No data-loss risk: the fallback (DB read) is
> correct, just slower. Fix is finishing the batch-job upgrade. Want the failover numbers too?

Note what didn't happen: the follow-up didn't re-explain the whole migration, and it didn't
balloon past a few sentences — it answered the one thing asked and offered the next natural
thread.

### What this skill must not do

- Must not re-summarize content that's already short — say so and stop.
- Must not drop a caveat, blocker, or open decision to satisfy the length ceiling.
- Must not let a "go deeper" follow-up re-expand into a full restatement of the original content.
- Must not present five bullets as equally weighted when one is clearly the decision-relevant one.

## Config and references
- `jstack.config.json` — team ids, integrations, `skill_defaults`, `jira_rules`, `notion`, `gbrain`. Never hardcode.
- Questions (open-ended, one at a time): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/question-patterns.md`
- Discrete choices (when the host supports AskUserQuestion or equivalent): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/ask-user-question-patterns.md`
- Chaining: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/chaining-guide.md`

## Intake
1. Identify the target content: the most recent substantial Claude output in this conversation,
   or a passage the user just pasted. If ambiguous which one, ask **one** question.
2. If the target is already ≤2 sentences or already a tight bullet list, skip straight to
   declining (see Failure modes) rather than producing a summary.
3. If the user's request is actually a deeper-dive ("go deeper on X", "tell me more about Y")
   following a summary this skill already gave, treat it as Step 3 below, not a fresh intake.

## Procedure
### Step 1 — Load and scope
Identify exactly what's being compressed (which message, or the pasted text). Do not summarize
content the user hasn't pointed at — ask which output if more than one candidate exists in
recent turns.

### Step 2 — Compress
Produce ≤5 bullets, ≤100 words total, ranked with the most decision-relevant point first. Carry
forward every caveat, blocker, or open decision from the source — never trade one away just to
land under the word count. Strip hedging/filler; state points directly. End with one explicit
next-step offer naming what could be expanded.

### Step 3 — Handle a deeper-dive request
When the user asks to go deeper on a specific bullet or topic, answer only that sub-topic,
still capped (a few sentences, not a re-expansion of the whole thing). Treat "stay concise" as
standing for the rest of this exchange — every later reply in this thread should default back to
this shorter register, not creep back toward the original length.

### Step 4 — Validate
Before sending: confirm the bullet count and word count are within the ceiling, confirm no
caveat/blocker/open-decision language from the source was dropped, and confirm the reply ends
with a next-step offer (initial summary) or answers only the requested sub-topic (deeper-dive).

### Step 5 — Summarize and hand off
No further hand-off is needed by default — this skill's job ends at delivering the compressed
reply and staying in the concise register for follow-ups. Only suggest another `jstack` skill if
the user's underlying goal clearly extends beyond summarizing (e.g. they want the compressed
result turned into an announcement or a report).

## Output shape
Default (initial tl;dr):
- Bulleted summary — ≤5 bullets, ≤100 words total, most decision-relevant point first, every
  caveat/blocker/open-decision preserved.
- One line, always: an explicit next-step offer to go deeper.

On an explicit deeper-dive request:
- Expand only the requested sub-topic.
- Stay capped — a few sentences, not a re-expansion of the original.

## Failure modes

| Symptom | Recovery |
|---------|----------|
| Source is already short (≤2 sentences or a tight bullet list) | Say it's already concise; do not produce a summary of it. |
| No clear target content (multiple candidates, or nothing to summarize yet) | Ask **one** question naming the candidates rather than guessing which one. |
| User asks for "the full thing" after a summary | Treat as a deeper-dive request (Step 3) scoped to what they're pointing at — expand that, still without re-inflating unrelated parts. |
| A caveat would need to be cut to hit the word cap | Keep the caveat; cut a lower-priority bullet or slightly exceed the cap instead — never silently drop risk language. |
| Reply drifts back to long-form on a later turn | Re-apply the standing "stay concise" rule from Step 3; do not treat the cap as a one-time-only compression. |

## Chaining
Leaf skill — no forced hand-off. If the user's goal clearly continues past summarizing (turning
the result into an announcement, report, or ticket), name that skill once and stop; do not
auto-invoke it.

## User request

$ARGUMENTS

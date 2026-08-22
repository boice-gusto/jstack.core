# Tone: Executive

Use for leadership updates, skip-levels, board and investor comms.

This file is injected verbatim into prompts. It asserts **no facts about your org or product** —
if a name, metric, or date isn't in config or the conversation, leave it out rather than
inventing it.

## Audience

Readers who scan, decide, and move on. They have context on the business and little on your
implementation. Assume 30 seconds of attention and one question: "what do you need from me?"

## Shape

Write to this skeleton rather than copying a sample:

```
<Outcome or ask, one sentence — the number or the decision goes first.>
<Customer or business impact, in their units, not yours.>
<What happens next, with a date and an owner.>
<Fallback or risk, and how reversible it is.>
```

Each line is one short clause, not a paragraph — four short lines total, not four sentences each
with its own sub-clause. State the ask exactly once; do not restate it as both an opening line and
a later "Ask:" label. **Skip a line entirely if the input gives you nothing to put on it** — an
unstated customer impact becomes a missing line, never a filled-in "no impact expected" guess. A
skeleton with 4 slots does not mean 4 slots must all be used at full length; the skeleton caps length,
it doesn't mandate hitting the cap on every line. If a line doesn't change what the reader decides, cut it.
**When the ask and "what happens next" describe the same action** (e.g. the ask is "approve one more
week" and the next step is "the team spends that week hardening it"), that is one fact, not two — say
it once in the opening line and let the "what happens next" slot carry only the *new* information (the
owner, the date, or nothing if there is none), rather than re-describing the same action in different words.

## Structure

1. **Lead with the outcome or ask** — not the backstory. Put the decision or the number first.
2. **Translate technical terms into customer-visible effects.** Say what the user experiences,
   not which component is involved: response time rather than p99, gradual release rather than
   feature flag, the service protected itself rather than the breaker tripped. Build the mapping
   from your own product's vocabulary; do not guess at names you haven't been told.
3. **Number risks and asks**, each with an owner where known.
4. **One page maximum.** Link to detail rather than inlining it.
5. **State reversibility.** Leadership treats "we can undo this in minutes" very differently
   from "this is one-way."

## Avoid

- Hedging without data — "we think it might be fine."
- Internal tool, service, or project codenames the reader won't recognize.
- Walls of bullets with no summary sentence.
- Precision you don't have. A projection stated as a fact will be quoted back as one.
- Jargon doing the work of an argument.
- **Length that matches the input instead of the reader's attention span.** "Materially shorter" is a hard
  word-count constraint, not a nice-to-have: target well under half the input's word count. A handful of
  short sentences, not several labeled sub-sections ("What this means," "Next step," "Risk" as separate
  headers) — headers and structure add words back even when each sentence is tight. If your draft is close
  to the input's length or longer, cut sentences instead of trimming words within them.
- **Mechanism words smuggled into the "what happens next" or "risk" line**, not just the summary — a
  rollback plan described as "revert to the prior single-threaded path" is still an implementation detail;
  say "we can reverse this in minutes" instead. Check every line against the translation rule in Structure,
  not just the opening sentence.
- **Any date, percentage, outcome claim, or circumstantial detail** (a specific completion date, "no data
  loss," a customer count, "during peak load," "in the EU region") **that was not literally in the input.**
  This includes color that merely sounds plausible for the scenario — a p99-latency incident does not imply
  "during peak load" unless the source said so. Restating the input's own ask ("we're requesting one more
  week") is fine; adding any circumstance, status, or quantity the input never gave is fabrication, not
  synthesis — leave it out or say it's pending, exactly as the source did.

## Adapting this file

Sharpen it by editing this file directly — add your real translation vocabulary and the phrasing
your leadership has pushed back on. There is no config-based override for tones; `jstack.config.json`
does not drive this file.

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

Each line earns its place. If a line doesn't change what the reader decides, cut it.

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

## Adapting this file

Sharpen it by editing this file directly — add your real translation vocabulary and the phrasing
your leadership has pushed back on. There is no config-based override for tones; `jstack.config.json`
does not drive this file.

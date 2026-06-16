# Tone: Executive

> **Owner:** PM or team lead. Edit this file so every jstack agent writes to leadership in your org's voice.

## Audience

<!-- [CUSTOMIZE] Who reads executive-level output from your team? -->
Leadership, skip-levels, board updates, investor comms.

## Voice

<!-- [CUSTOMIZE] Paste 2-3 sentences from a real exec update your stakeholders liked. This anchors the style better than rules. -->
```
Example: "Auth latency is up 40% since the Redis migration. Customer impact: 
login takes 4s instead of 2s on mobile. Fix ships Thursday; fallback is 
reverting to the old cluster, which we can do in <5 min."
```

## Structure

1. **Lead with the outcome or ask** — not the backstory. Stakeholders scan; put the decision or number first.
2. **Translate technical terms** using your product's language:
   <!-- [CUSTOMIZE] Add your team's translations below -->
   | Technical | Say instead |
   |-----------|------------|
   | API p99 latency | Page load time for customers |
   | Feature flag rollout | Gradual release to users |
   | Circuit breaker tripped | Service automatically protected itself |
3. **Risks and asks are numbered** with an owner if known.
4. **One page max.** Link to the detail doc if more is needed.

## What to avoid

<!-- [CUSTOMIZE] Add phrases or patterns your leadership has pushed back on -->
- Hedging without data ("we think it might be okay")
- Internal tool names stakeholders won't recognize
- Walls of bullets with no summary sentence

## Config hook

If `jstack.config.json` has a `tones.executive` block, merge those overrides on top of this file:
```json
{
  "tones": {
    "executive": {
      "max_length": "1 page",
      "translation_table": { "p99": "response time" }
    }
  }
}
```

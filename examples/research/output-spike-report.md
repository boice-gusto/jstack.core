# Spike report (example output)

**Spike:** Edge rate limit rule evaluation cost  
**Time box:** 4h

## Question

Can we enforce **per-tenant** limits at edge without 2x DB round-trips per request?

## Findings

- **Feasible** with **sharded** counters in edge KV + 5m sync to source of truth
- **Cost:** +~0.2ms p99 in synthetic bench (staging)

## Recommendation

- Prototype in **us-east-1** only; feature flag
- If p99 &lt; 1ms, proceed to design review

## Out of scope

- **Global** consistency — deferred

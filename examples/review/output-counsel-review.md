# Counsel review (example output)

**Topic:** Deprecate `/v0` API in 90 days

## Perspectives (abbrev.)

- **EM:** Sequence comms + enforcement; avoid surprise 410s in batch jobs
- **PM:** 90d may be short for one enterprise; offer **6mo paid bridge** for reports path only
- **Legal/Trust:** (if applicable) document sunset in customer-facing changelog

## Recommendation

1. **Named migration** for the enterprise: dedicated **compat window** (reports only) + hard date
2. **Staged 410s:** 30d of **logs-only** 410, then enforce
3. **Public** timeline post + status page

## Risks

- **Batch jobs** failing silently — require **synthetic** canary for `/v0` in CI

## Next step

- Run `/jstack:review-counsel` with full `prompts/personas/*` if board review needed

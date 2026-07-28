---
name: jstack-incident-oncall-summary
description: Summarize on-call window from Slack channel + incident tool + schedule; group alerts; optional per-issue investigation; config-driven targets.
category: incident
effort: medium
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Summarize on-call window from Slack channel + incident tool + schedule; group alerts; optional per-issue investigation; config-driven targets.

## Domain rules — incident/oncall-summary

**Absolute rules**

1. Every handoff carries, at minimum: open/active incidents with current status and severity, silenced or muted alerts with expiration and reason, in-flight mitigations, and current escalation state (who's paged, who's next). Omitting any of these is an incomplete handoff, not a shorter one ([incident.io — on-call best practices](https://incident.io/blog/on-call-best-practices-guide-2026); [OneUptime — on-call handoff procedures](https://oneuptime.com/blog/post/2026-01-27-oncall-handoff-procedures/view)).
2. An unwritten (verbal-only) handoff loses context the moment the outgoing person is unreachable — write it down even when a live handoff conversation also happens. The write-up is the artifact that survives; the conversation is a bonus.
3. Every timestamp carries an explicit timezone or is in UTC. A bare local time is ambiguous the instant the reader is in a different zone, and incident timelines get read by people who weren't on the original call.
4. "Resolved" and "mitigated" are not the same word and must not be used interchangeably. Mitigated means the immediate impact is contained but the root cause or a workaround is still in place; resolved means the underlying issue is actually fixed. Reporting a mitigated incident as resolved sets up the next on-call to be surprised when it recurs.
5. Every silenced alert must state why it's silenced and when the silence expires. A silence with no expiration is a monitoring gap wearing a maintenance excuse.
6. The incoming on-call summarizes the handoff back before the outgoing person signs off — if they can't repeat back the open items, the handoff didn't actually transfer the context.

## Thresholds

| Signal | Threshold | Why |
|---|---|---|
| Handoff checklist coverage | 100% of active incidents, silenced alerts, and in-flight mitigations listed — zero omitted | A single omitted open item is exactly the kind of context loss a handoff exists to prevent |
| Live overlap window | Roughly 30–60 minutes of overlap between outgoing and incoming for a live handoff conversation, when schedules allow | Enough time for questions and clarification without being a full extra shift ([incident.io](https://incident.io/blog/on-call-best-practices-guide-2026)) |
| Silence expiration | Every silenced alert has an expiration; silences left unbounded for more than roughly 24 hours without re-review | An unbounded or stale silence is a live monitoring risk being carried forward invisibly |
| Timestamp format | 100% of logged timestamps carry timezone or UTC | Bare local time is unreadable to the next responder if they're anywhere else |

## Anti-patterns

| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Verbal-only handoff | Evaporates if the outgoing person becomes unreachable; nothing to reference later | Always produce a written summary, even alongside a live conversation |
| Reporting "mitigated" as "resolved" | Sets the next on-call up to be blindsided when the underlying cause resurfaces | State status precisely: mitigated (contained, root cause pending) vs resolved (actually fixed) |
| Omitting silenced alerts because "it's probably fine" | The next on-call inherits a blind spot they don't know exists | List every active silence with reason and expiration, no exceptions |
| Timestamps with no timezone | Ambiguous the moment the reader isn't in the same zone as the writer | Log every timestamp with UTC or an explicit offset |
| Skipping the incoming person's summarize-back | No verification that context actually transferred, just that words were said | Require the incoming on-call to restate the open items before sign-off |

## Worked example

- *Weak:* "Nothing major, one thing might still be acting up, check Slack if you're unsure."
- *Sharp:* "Handoff at 2026-07-27 18:00 UTC. Open: INC-4821 (Sev3, checkout latency), mitigated via cache-warm script re-run at 17:40 UTC, root cause (connection pool exhaustion) not yet fixed, owner: platform team, next check-in 2026-07-27 22:00 UTC. Silenced: `db-replica-lag` alert, silenced 16:00–20:00 UTC by me, reason: known replica catch-up after maintenance, will auto-unsilence at 20:00 UTC. Escalation: primary is me until 18:00 UTC, then you; secondary is unchanged. No other open items."

## What this skill must not do

- Does not itself resolve or mitigate the incident — it documents current state for the next responder.
- Does not declare an incident resolved without verification; when in doubt, report the more conservative status (mitigated, not resolved).
- Does not skip the written record because a verbal handoff happened — both, not either.
- Does not invent an incident's severity or timeline detail it wasn't given — state what is known and flag any gap explicitly.

## Config and references
- `jstack.config.json` — team ids, integrations, `skill_defaults`, `jira_rules`, `notion`, `gbrain`. Never hardcode.
- Questions (open-ended, one at a time): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/question-patterns.md`
- Discrete choices (when the host supports AskUserQuestion or equivalent): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/ask-user-question-patterns.md`
- Integrations: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/integration-guide.md`
- Chaining: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/chaining-guide.md`

## Intake
1. Parse `$ARGUMENTS` — note whether the user **pasted** data or is asking you to **query** a system.
2. If a required id is missing, ask **one** focused question; otherwise use config defaults (label assumptions as `[assumption]`).
3. If the request bundles multiple unrelated goals, handle the first and offer to continue.

## Procedure
### Step 1 — Load config
Read relevant keys from `jstack.config.json`. If the integration is missing or unhealthy, say so and point to `jstack setup` / `jstack doctor` instead of faking data.

### Step 2 — Plan the safe path
Stabilize before diagnosing. Record the timeline as you go, not afterwards from memory. Do not state a cause until it is established — in anything customer-facing, "under investigation" is correct and a guess is a liability.

### Step 3 — Execute
Apply the `jstack-incident-oncall-summary` workflow using config and any applicable templates under `templates/incident/`.

### Step 4 — Validate
Confirm the timeline is ordered and sourced, that cause is labelled as established or under investigation, and that no customer-facing text asserts more than is known.

### Step 5 — Summarize and hand off
State what changed, what to verify, and suggest **one** next jstack skill if the work naturally continues.

## Output shape
Use a domain-appropriate heading, then:
- **Summary** (2–4 sentences)
- **Details** (bullets, table, or structured fields)
- **Next steps** with owner + timeline if known
- **Limitations** (partial data, no write access, etc.)
- For eval-gated skills, end with `result_ok: true` or `result_ok: false` + reason

## Failure modes

| Symptom | Recovery |
|---------|----------|
| Missing config / integration | Point to `jstack setup` or `jstack doctor`; do not continue with invented ids. |
| Auth / 403 / expired token | Stop; tell user to refresh credentials. Never print secrets. |
| Ambiguous goal | One clarifying question; if still unclear, present options A/B. |
| Impact unverified | Do not announce resolved; state current known status only. |

## Chaining
Complete the work here. If a natural follow-up exists, add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

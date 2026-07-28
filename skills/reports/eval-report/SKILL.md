---
name: jstack-eval-report
description: Generate a 9-grid evaluation report with growth framing. Sensitive — mark manager-only if needed.
category: reports
effort: high
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Generate a 9-grid evaluation report with growth framing. Sensitive — mark manager-only if needed.

## Domain rules — eval-report

This is the most performance-adjacent report kind this skill set generates. It must not become a
judgment of a person's worth, must not carry another named person's PII or performance data, and
must separate observed behavior from inferred motive throughout.

### Absolute rules

1. **Never render a verdict on the person's worth.** The 9-grid plots demonstrated impact and
   trajectory for a period of work — not a statement about who someone is. A line like "this is a
   low performer" has no place here; describe the observed pattern instead.
2. **Every grid placement cites a dated, observable artifact** (a shipped project, a review
   comment, a stated goal). An ungrounded placement ("felt like a strong quarter") isn't
   defensible if challenged and shouldn't ship.
3. **Separate observed behavior from inferred motive.** "Missed the March and April deadlines" is
   observable; "doesn't care about deadlines" is an inferred motive and must not be asserted —
   state the behavior and let the reader draw their own conclusion about cause, the same
   separation the [SBI feedback model](https://www.ccl.org/articles/leading-effectively-articles/closing-the-gap-between-intent-vs-impact-sbii/)
   draws between situation-behavior and character.
4. **No other named person's PII or performance data appears as a comparison point.** "Did more
   than [peer]" has no place in someone's evaluation artifact — a peer's private performance
   record is off-limits regardless of accuracy, and naming them is a policy risk on its own.
5. **Growth framing names a next behavior, not a trait fix.** "Adopt a written rollout checklist
   next cycle" is actionable; "be more proactive" targets a personality trait and gives no
   observable next step.
6. **Use specific, fact-based language over vague adjectives.** "Exceeded the Q2 goal by a
   measured amount" beats "did great work" — vague, trait-flavored adjectives are exactly the
   language [flagged as a discrimination-litigation risk in subjective evaluation systems](https://aaronhall.com/legal-considerations-in-employee-performance-evaluations/).
7. **Default distribution to manager-only / restricted** until a named approver explicitly
   widens it per config policy — never default this report kind to a broad audience.

### Thresholds / criteria

| Signal | Rule | Source |
|---|---|---|
| Distribution default | Restricted/manager-only until explicit sign-off broadens it | this skill's own contract |
| Behavior vs. trait | Every growth-area line names a next behavior, never a trait/adjective | [SBI feedback model](https://www.ccl.org/articles/leading-effectively-articles/closing-the-gap-between-intent-vs-impact-sbii/) |
| Specificity bar | Prefer a cited figure over an unverifiable adjective ("effective," "needs improvement") | [EEOC-aligned evaluation-language guidance](https://aaronhall.com/legal-considerations-in-employee-performance-evaluations/) |
| Self-report vs. evidence | Cross-check a self-reported placement against artifact evidence before accepting it; self- and measured-skill assessments diverge sharply at the low end (12th-percentile scorers self-rated ~62nd percentile) | [Kruger & Dunning 1999](https://en.wikipedia.org/wiki/Dunning%E2%80%93Kruger_effect) |
| Third-party data | Zero instances of another named person's PII/performance data used as a comparison | this skill's own contract |

### Named anti-patterns

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| Character judgment in a growth line ("isn't a team player") | A trait label, unactionable, and a worth-judgment this skill must not render | Name the specific observed behavior and a next action |
| Comparing to a named peer's performance | Puts another person's private performance data into someone else's artifact | Compare against the stated rubric/goal, not a peer |
| Vague adjective instead of a cited fact | Unverifiable, and a known legal/compliance risk in subjective evaluations | Cite the specific artifact and figure behind the claim |
| Defaulting distribution to broad/team-wide | This is the most sensitive report kind in the set | Default to manager-only/restricted until explicitly widened |
| Treating a self-report as equivalent to evidence | Self-assessment error is largest exactly where it matters most | Cross-check self-placement against a cited artifact first |

### Worked example

- *Weak:* "This person had a strong quarter and is a great team player who really stepped up."
- *Sharp:* "Q2 placement — Impact: led the `auth-service` migration (PRs #480–#491, deployed
  2026-07-15); on-call log shows related P2 incidents dropped from 6/month to 1/month over the
  following 6 weeks. Observed behavior: missed the stated 2026-06-01 internal deadline by 3 weeks
  — no cause asserted here. Growth area: adopt a written rollout checklist before the next
  migration (specific next behavior), not 'be more careful.' Distribution: manager-only, per this
  report's default."

### What this skill must not do

- Must not become a judgment of the person's worth — describes a period of observed work only.
- Must not include another named person's PII or performance data as a comparison point.
- Does not assert inferred motive — states observed behavior only.
- Not for broad distribution by default — manager-only/restricted until explicitly widened.

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
Every figure traces to a named source with an as-of time. Mark a missing metric as `[no data]` — never interpolate it, and never drop the row silently, because omission in an authoritative-looking report misleads exactly as much as fabrication.

### Step 3 — Execute
Sensitive: growth framing. Avoid comparing to other individuals by name. Mark manager-only if not peer-shareable.

### Step 4 — Validate
Confirm every figure has a source and as-of time, that gaps read `[no data]`, and that the footer and scope match this report's kind. Re-run the render and confirm identical output from identical inputs.

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
| Missing data for a metric | Leave cell blank with `[no data]`; do not invent numbers. |
| Tone mismatch | Offer 2 tone options from `prompts/tones/` in one question. |

## Chaining
Complete the work here. If a natural follow-up exists (e.g. `jstack-team-report` then `jstack-share-html-publish`), add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

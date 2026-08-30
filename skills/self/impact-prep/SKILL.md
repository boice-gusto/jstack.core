---
name: jstack-self-impact-prep
description: IC impact prep — Growth Check-in (quick) or Quarterly sweep with artifact gather, gap questions, config rubrics; personal gbrain default.
category: self
disable-model-invocation: true
effort: high
gbrain_destination: personal
data_class: people_performance
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Prepare IC impact evidence — a quick Growth Check-in or a full Quarterly sweep — by gathering artifacts, asking gap-filling questions, and applying configured rubrics. Save to the personal gbrain by default.
- **Out of scope:** Writing the final performance narrative — hand off to `jstack:self-eval`.

## Domain rules — impact-prep

Personal-target by default: prepares one person's evidence for a human-run review process; it
does not run that process itself.

### Absolute rules

1. **Every rubric dimension is backed by at least one named artifact** (PR, doc, ticket,
   message). A rubric score with no artifact is a self-assessment, not evidence — flag it as a
   gap to fill with a targeted question rather than filling it with a plausible-sounding claim.
2. **Ask gap-filling questions one at a time, specific to the missing artifact.** "What did you
   do this quarter" is not a gap question; "what's the artifact for the Q2 goal on
   [rubric dimension]" is.
3. **Calibrate against the rubric's stated bar, not against effort expended.** "I worked hard on
   this" is not evidence the bar was met — only the artifact, evaluated against the bar, is.
4. **Flag a self-assessed vs. evidence-supported divergence explicitly rather than averaging it
   away.** Self-assessment miscalibration is a measured effect, sharpest exactly where the
   underlying skill is weakest, so a diverging self-rating is a signal to gather more evidence,
   not to split the difference.
5. **A Quarterly sweep aggregates existing Growth Check-ins plus new artifacts as its primary
   source** — it does not re-derive the whole quarter from memory when check-ins already exist.
6. **This gathers evidence and identifies gaps; it does not render the eventual
   promotion/rating verdict.** That belongs to the human process consuming the prepared evidence.
7. **Personal target by default** — this prepares one person's evidence, not a team-wide
   calibration exercise.

### Thresholds / criteria

| Signal | Rule | Source |
|---|---|---|
| Artifact requirement | ≥1 named artifact per rubric dimension before marking it met; otherwise flag a gap | evidence-over-assertion convention shared with `reports/*` |
| Gap question specificity | One question at a time, naming the missing artifact/dimension | `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/question-patterns.md` |
| Self vs. evidence divergence | Flagged explicitly, never averaged, especially at the low end where self-assessment error is largest | [Kruger & Dunning 1999](https://en.wikipedia.org/wiki/Dunning%E2%80%93Kruger_effect) |
| Verdict boundary | This skill prepares evidence; it does not issue the rating/promotion decision | this skill's own scope contract |

### Named anti-patterns

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| Scoring a dimension from stated effort, not an artifact | Effort isn't evidence the bar was met | Require a named artifact per dimension before marking it met |
| Averaging a self-rating with an evidence-based rating | Hides a real, informative divergence | Flag the divergence explicitly instead of blending it away |
| Asking one broad "how'd you do this quarter" question | Doesn't fill the specific evidence gap | Ask one targeted question per missing artifact |
| Re-deriving a Quarterly sweep from memory when check-ins exist | Discards better, more contemporaneous source data | Aggregate existing Growth Check-ins as the primary source |
| Issuing an implied rating/verdict from the prepared evidence | Oversteps this skill's role | Prepare evidence only; leave the verdict to the human process |

### Worked example

- *Weak:* "I think I had a strong quarter across the board."
- *Sharp:* "Rubric dimension 'technical ownership': artifact = migration design doc + PRs
  #480–#491 (evidence-supported: met). Rubric dimension 'cross-team collaboration': no artifact
  found — gap question: 'What's a specific instance this quarter where you coordinated across
  teams? Do you have the thread or doc?' Self-rated this dimension 'exceeds'; evidence not yet
  found — flagging the divergence rather than averaging it."

### What this skill must not do

- Does not write the final performance narrative or render a rating/promotion verdict.
- Must not average a self-rating against an evidence-based rating when they diverge.
- Not for team-wide calibration — personal target by default.

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
Personal target by default; write to a shared store only when the user asks explicitly. Never place another person's performance data or PII in a personal or team note.

### Step 3 — Execute
For a Growth Check-in, walk each configured rubric dimension and attach at least one named artifact (PR, doc, ticket, message) per dimension, or flag it as a gap; ask one targeted gap question at a time, naming the missing artifact. For a Quarterly sweep, aggregate existing Growth Check-ins as the primary source and layer in new artifacts rather than re-deriving the quarter from memory. Where a self-rating diverges from the evidence-supported rating, flag it explicitly instead of averaging the two.

### Step 4 — Validate
Confirm the write went to the personal target unless explicitly told otherwise, and that no other person's PII or performance data is present.

### Step 5 — Summarize and hand off
State what changed, what to verify, and suggest **one** next jstack skill if the work naturally continues.

## Output shape
Use a domain-appropriate heading, then:
- **Summary** (2–4 sentences)
- **Details** (bullets, table, or structured fields)
- **Next steps** with owner + timeline if known
- **Limitations** (partial data, no write access, etc.)
- For eval-gated skills, end with `result_ok: true` or `result_ok: false` + reason

When the user just wants a lighter-weight accomplishments narrative — not a full rubric-scored
Growth Check-in or Quarterly sweep — this skill can render that too: skip the rubric-dimension
walk and gap questions, and produce a shorter self-report-style summary of recent artifacts
straight from the gathered evidence.

## Failure modes

| Symptom | Recovery |
|---------|----------|
| Missing config / integration | Point to `jstack setup` or `jstack doctor`; do not continue with invented ids. |
| Auth / 403 / expired token | Stop; tell user to refresh credentials. Never print secrets. |
| Ambiguous goal | One clarifying question; if still unclear, present options A/B. |
| Emotional crisis language | Be brief, kind; suggest professional support. Do not role-play therapy. |
| User pastes a secret | Refuse to store; tell them to rotate immediately. |

## Chaining
Complete the work here. If a natural follow-up exists, add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

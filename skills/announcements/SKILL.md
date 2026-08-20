---
name: jstack-announcements
description: Draft channel-ready or email-ready announcements from rough notes, respecting tone policies and internal/external distinction.
category: announcements
disable-model-invocation: true
effort: medium
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md
Load the policy this domain is governed by (do not restate it from memory):
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/policies/announcement-policy.md
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/tones/internal.md
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/tones/executive.md
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/tones/formal.md

## What this skill is for
Turn rough notes into channel-ready copy. Distinguish internal vs public; never leak unreleased product detail unless user confirmed external audience.
- **Out of scope:** Actually posting — produce a draft for user approval.

## Domain rules — announcements
- Distinguish **internal** (Slack, email to team) vs **external** (blog, customer email). Never leak unreleased product details in external copy.
- Apply tone from `prompts/tones/` and match channel norms (length, emoji, @here rules).
- Draft only — never post without explicit user approval.
- If the content touches legal, compliance, or pricing, flag for stakeholder review before send.

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
Draft, get approval, then publish — in that order, always. Resolve the channel from `policies.announcements.channels`; if it is unset, ask rather than picking one. Never send to an external or unfamiliar destination without explicit confirmation of the audience.

### Step 3 — Execute
1. **Classify audience and tone** — internal vs external. If it is clear from `$ARGUMENTS` or config, proceed. If unclear, use **AskUserQuestion** before drafting:

   ```
   question: "Which tone for this announcement?"
   header: "Tone"
   options:
     - label: "Executive"
       description: "Outcome-first, no jargon. VP+ / board / skip-level."
       preview: |
         ## [Initiative] — Update

         We shipped X. This reduces Y by Z%.

         **Next:** [One sentence on what's coming or who acts.]
     - label: "Internal / Eng"
       description: "Bullets, technical context. Team Slack, #eng, wiki."
       preview: |
         ## Shipped: [Initiative]

         **What:** [1 sentence]
         **Why:** [1 sentence]
         **Impact:** [metric or outcome]
         **Next:** [owner + ETA]
     - label: "Formal / External"
       description: "Polished, policy-safe. Customer email or blog."
       preview: |
         We are pleased to announce that [Initiative] is now available.

         [One paragraph: what it is, why it matters to the customer.]

         [CTA or next step.]
   ```

   The tone choice also implies audience (Executive/Internal → internal; Formal/External → external) — do not ask a second, separate internal-vs-external question.
2. Apply the chosen tone from `prompts/tones/` and match channel norms (length, formatting, @here rules).
3. If content touches legal, compliance, or pricing, flag for stakeholder review.
4. Output a draft for user approval; never post directly.

### Step 4 — Validate
Confirm the destination, the audience, and that approval was actually given before send — not assumed. Re-read the text for anything that should not leave the org.

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
| Audience unclear (internal vs external) | Ask one question before drafting. |
| Legal/compliance content detected | Flag for stakeholder review; do not finalize. |

## Chaining
Complete the work here. If a natural follow-up exists, add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

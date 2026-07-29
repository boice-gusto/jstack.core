---
name: jstack-announcement-review
description: Review an announcement for tone, accuracy, and channel fit. Flag legal/PR risks if external.
category: review
effort: high
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md
Load the policy this domain is governed by (do not restate it from memory):
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/policies/review-policy.md

## What this skill is for
Review a draft announcement against tone and approval policy: audience fit, claim accuracy, and whether anything needs sign-off before it goes out.
- **Out of scope:** Posting it, and approving on behalf of a named approver.

## Domain rules — announcement-review

### Absolute rules

1. **Verify destination and audience before reviewing content quality.** An accurate, well-toned
   message sent to the wrong distribution list is still a failed send — content review cannot fix
   an addressing error after the fact.
2. **Never let a draft publish without a named approver's sign-off recorded before send.** An
   unnamed "looks good" in a thread is not an approval trail; approval happens before publish,
   never after ("we'll fix it if someone complains" is not a process).
3. **Internal and external tone are not a find-replace of each other.** External copy needs its own
   pass against legal/compliance-sensitive language (forward-looking statements, specific numbers,
   customer or partner commitments) that an internal-only draft doesn't require.
4. **Check explicitly for content that must never leave the org** — unreleased financials,
   incident specifics before the comms lead clears them, individual PII or performance detail,
   unannounced roadmap — before reviewing tone. Assume it might be present; don't assume it's
   absent.
5. **Any unresolved placeholder blocks publish**, regardless of how polished the rest of the draft
   reads — a stray `[DATE]`, `[NAME]`, or `TODO` that ships is a completeness failure, not a nit.
6. **When the audience is ambiguous, review against the stricter (external) standard** until it's
   confirmed internal-only — assuming the more permissive standard is the wrong default when wrong.
7. **Draft first, select the recipient/distribution last.** Autocomplete-filled recipient fields
   populated before the sensitive content is finished are a recurring cause of wrong-audience
   sends.

### Thresholds

| Signal | Threshold | Source |
|---|---|---|
| Named approval sign-off | At least one designated final-approval point per message, recorded before send | [PRSA — Crisis Communications Checklist](https://jobs.prsa.org/career-resources/finding-talent-10/crisis-communications-checklist-24-hour-response-protocol-405) |
| Internal-before-external release lag | Internal stakeholders informed before the public/external release, not after | [PRSA — Crisis Communications Checklist](https://jobs.prsa.org/career-resources/finding-talent-10/crisis-communications-checklist-24-hour-response-protocol-405) |
| Recipient-selection order | Draft and review content before populating the recipient/distribution field | [MindTools — 10 Common Communication Mistakes](https://www.mindtools.com/ar0qk6t/10-common-communication-mistakes/) |
| High-stakes template pre-approval | Template approved by legal/leadership in advance of need, not drafted live under time pressure | [PRSA — Crisis Communications Checklist](https://jobs.prsa.org/career-resources/finding-talent-10/crisis-communications-checklist-24-hour-response-protocol-405) |

### Named anti-patterns

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| Reviewing tone before verifying destination | A perfectly-toned message to the wrong list is still a failed send | Confirm audience and distribution first; review content second |
| Auto-filled recipient before drafting sensitive content | Autocomplete recipient fields are a recurring cause of wrong-audience sends | Draft first, select the recipient deliberately last |
| Publish-then-fix | Treats the live channel as a scratchpad and the audience as beta testers | Require an approval gate before publish, not a correction plan after |
| Find-replace between internal and external drafts | External copy needs its own legal/compliance-sensitive pass, not a search-replace of internal language | Review external copy against its own checklist, independent of the internal draft |
| Unnamed "LGTM" treated as approval | No accountable approver if the send causes a problem | Record a named approver and a timestamp before send |
| Defaulting ambiguous audience to "internal" | Understates risk when the message actually reaches outside the org | Default to the stricter external standard until audience is confirmed |

### Worked example

- *Weak:* "This announcement reads fine, ship it."
- *Sharp:* "`Blocking:` distribution is set to the company-wide list, but paragraph 3 references an
  unreleased roadmap item scoped to one team — this list includes contractors outside that scope.
  Hold send until either the roadmap reference is removed or distribution is narrowed to the
  intended team. Also `Blocking:` the `[DATE]` placeholder in paragraph 2 is still unresolved.
  Tone and structure otherwise fit an internal-all-hands announcement; no legal-sensitive language
  flagged."

### What this skill must not do

- Does not author the announcement's original content as its primary job — it reviews a draft that
  already exists, or asks for one to be produced first.
- Does not itself grant approval — it recommends approve/revise/block; a named human owns the
  actual sign-off.
- Does not perform multi-persona ship/no-ship synthesis across legal, PR, and executive stakes —
  route that reconciliation to `jstack:counsel-review` when the call spans more than tone/accuracy.
- Does not review source code or technical diffs — that's `jstack:review-code-review`.

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
Read the whole change before commenting on any part of it. Separate blocking findings from suggestions, and cite `file:line` for each. Do not approve based on a summary you did not verify. Rank by severity, not by reading order.

### Step 3 — Execute
Tone + accuracy + channel fit. Flag legal/PR risks if external.

### Step 4 — Validate
Confirm every finding cites a real location and that severities are ordered. Confirm you did not present a preference as a defect. State explicitly what you did not review.

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
| No artifact to review | Ask for doc link, paste, or file path. Do not improvise a review. |

## Chaining
Complete the work here. If a natural follow-up exists, add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS

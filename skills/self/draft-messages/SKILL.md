---
name: jstack-self-draft-messages
description: Draft multiple tone/intent variants of a message the user wants to send to one specific person or small group — a Slack DM, an email, difficult feedback, an apology, a decline, an escalation — for a chosen venue and audience, each with an honest note on how the recipient might receive it. Use for "help me write this message," "draft a Slack DM," "how should I phrase this," "I need to tell someone X," or "help me push back on this without it landing badly." Do NOT use for formal org-wide announcements, product launches, or policy communications — those go through `jstack:announcements`, which applies tone policy and legal/compliance review this skill does not have. Never sends or posts anything; drafts only.
category: self
effort: medium
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->
<!-- chains-to: jstack:meetings-post-slack -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for

Turn a message the user wants to send to **one specific person or small group** into two or more
distinct, ready-to-use draft variants for a chosen venue and audience — plus an honest,
phrasing-specific note on how the recipient might receive each one.

- **In scope:** Slack DM, Slack channel post, email, in-person talking points, or any other
  one-to-one or small-group message the user will personally deliver — informing, requesting,
  delivering difficult feedback, apologizing/repairing, declining, or escalating.
- **Out of scope:**
  - **Sending, posting, or scheduling anything.** This skill only drafts. Sending is always a
    separate, explicit action the user takes themselves, outside this skill, in whatever tool
    they use to actually deliver the message. This skill never calls a send/post tool.
  - **Formal org-wide announcements, product launches, or policy communications.** Those go
    through `jstack:announcements`, which applies tone policy and legal/compliance review gates
    this skill does not have. If the audience is "the whole team," "the whole company," or
    "customers broadly," redirect there.
  - **Slack-specific draft-only posting mechanics** (channel resolution, thread-vs-channel,
    `@here` rules) once venue = Slack. This skill hands the drafted text to
    `jstack:meetings-post-slack` for that; it does not duplicate that skill's posting logic.

## Domain rules — draft-messages

### Absolute rules

1. **Always produce at least 2 distinct draft variants.** Never present a single draft framed as
   the only option. "Distinct" means different sentiment or approach (e.g. direct-and-brief vs.
   warmer-and-context-giving), not the same sentence reworded. Among the variants, **recommend
   one** given the stated relationship and intent — this is the user choosing between real
   phrasing options, not a menu with no guidance, so don't dump options and stay neutral.
2. **The emotional-impact note must be evidence-based and specific to the actual phrasing used.**
   Cite the specific sentence or word likely to land badly ("calling it 'again' in the second
   line reads as keeping score"), never a generic disclaimer like "this might upset someone." If
   a draft has nothing notable, **say nothing** for that draft — do not add a flag for the sake
   of symmetry across variants.
3. **Never fabricate assumed context about the recipient's personality or history that the user
   didn't provide.** If the user's communication style, the recipient's typical reaction, or past
   history between them is missing, flag it as an open question rather than inventing it — e.g.
   "I don't know this person's usual communication style — assuming professional/neutral unless
   you tell me otherwise."
4. **Never send, post, or schedule anything.** Produce text for the user to copy, paste, and send
   themselves (or hand off to `jstack:meetings-post-slack` for the Slack draft-only step). Do not
   claim a message was sent.

### Named anti-patterns

| Anti-pattern | Why it's wrong | Instead |
|---|---|---|
| Hedging every draft into blandness | If both variants soften every claim the same way, they aren't distinct options — the user has nothing real to choose between | Make the variants actually differ in directness/warmth; at least one should say the thing plainly |
| Decorative risk-flag on every draft (emoji-as-decoration) | Flagging every single draft regardless of content trains the user to ignore the flag — it stops carrying signal | Only flag where a specific word or sentence creates real risk; say nothing otherwise |
| Softening the difficult-feedback draft until it no longer conveys the feedback | A feedback message the recipient can't parse as feedback wastes the user's effort and delays the real conversation | Keep at least one variant clear enough that the actual ask or concern is unambiguous, even if the tone is warm |

### Worked example

**Scenario:** user wants to tell a peer that their PR reviews are too slow and it's blocking the
team. Relationship: peer (no manager authority). Intent: deliver difficult feedback. Venue: Slack
DM.

**Variant 1 — Direct and brief**
> Hey — I've had #482 and #491 waiting on your review for 4+ days each, and it's blocking the
> team's sprint goal. Can you get to open PRs within a day going forward, or let me know if you're
> underwater and need me to route reviews elsewhere?

*Impact flag:* "it's blocking the team's sprint goal" stated flatly, with no acknowledgment of
their workload, reads as blame-first to a peer with no context on why review turned around
slowly — it's accurate, but likely to land as an accusation rather than a request unless they
already expect this conversation.

**Variant 2 — Warmer and more context-giving**
> Hey, got a sec? I've noticed review turnaround on a few of my PRs (#482, #491) has been running
> 4+ days, and it's starting to slip our sprint goal. Not sure if you're just swamped right now —
> want to figure out together how we keep reviews moving, whether that's a faster SLA or routing
> some of mine elsewhere when you're busy?

**Recommendation:** given a peer relationship with no stated history of conflict, use **Variant
2** — it names the same facts (PRs, days, sprint impact) without the blame framing, and opens with
a question rather than a demand, which matters more for a lateral relationship than for a
direct report. Switch to Variant 1's directness only if this is a repeat conversation and the
warmer approach already didn't work — that's missing context the user would need to supply.

## Config and references

- `jstack.config.json` — team ids, integrations, `skill_defaults`, `gbrain`. Never hardcode.
- Questions (open-ended, one at a time): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/question-patterns.md`
- Discrete choices (AskUserQuestion): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/ask-user-question-patterns.md`
- Chaining: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/chaining-guide.md`

## Intake

If the user's request already states venue, relationship, and intent, skip straight to
drafting — do not re-ask what was already given. Otherwise, call **AskUserQuestion** with all
three questions in one invocation:

```
question: "Where is this message going?"
header: "Venue"
options:
  - label: "Slack DM"
    description: "One-on-one Slack message."
  - label: "Slack channel"
    description: "Posted where a team or group can see it."
  - label: "Email"
    description: "Include a subject line."
  - label: "In-person talking points"
    description: "Spoken conversation — draft points, not a script to read verbatim."
  - label: "Other"
    description: "Text, doc comment, PR comment, or another venue — I'll type it."

question: "Who's the recipient, relative to you?"
header: "Relationship"
options:
  - label: "Peer"
    description: "No authority either direction."
  - label: "Manager"
    description: "You're messaging someone you report to."
  - label: "Direct report"
    description: "You're messaging someone who reports to you."
  - label: "Cross-functional partner"
    description: "Different team, no reporting relationship."
  - label: "Other"
    description: "Different or mixed relationship — I'll describe it."

question: "What's the primary intent?"
header: "Intent"
options:
  - label: "Inform"
    description: "Share a fact, decision, or status — no ask attached."
    preview: |
      Hey [name] — wanted to flag that [fact/decision]. [One line of relevant context.]
      No action needed on your end unless [condition].
  - label: "Request"
    description: "Ask for something — time, a decision, a favor."
    preview: |
      Hey [name] — could you [specific ask] by [date]? [One line on why it matters / what it
      unblocks.] Let me know if that timeline doesn't work.
  - label: "Deliver difficult feedback"
    description: "Name a problem in someone's work or behavior, directly."
    preview: |
      Hey [name] — [specific, observable behavior] has been [concrete impact]. [One line naming
      what you'd like to see instead.] Open to hearing your side of it.
  - label: "Apologize / repair"
    description: "Own a mistake and propose what changes."
    preview: |
      Hey [name] — I got [specific thing] wrong, and I know it [concrete impact on them]. Sorry
      about that. Going forward I'm going to [specific change]. Let me know if there's anything
      else I should do to make it right.
  - label: "Decline"
    description: "Say no to a request, clearly, without over-apologizing."
    preview: |
      Hey [name] — thanks for asking, but I'm not going to be able to [request] because
      [one real reason]. [Optional: alternative or referral.]
  - label: "Escalate"
    description: "Raise an issue to someone with more authority or context to act."
    preview: |
      Hey [name] — flagging [specific issue] because [why it needs your visibility/decision now].
      [What you've already tried.] [What you're asking them to do.]
```

Parse `$ARGUMENTS` for the raw message content, rough notes, or bullet points the user wants
turned into drafts. If none is given, ask for it before drafting — do not invent the substance of
what they want to say.

## Procedure

### Step 1 — Load context

Read `jstack.config.json` for any `skill_defaults.draft-messages` overrides (e.g. a default
signoff or preferred variant count). Missing config is not a blocker here — this skill has no
required integration.

### Step 2 — Fill gaps, don't invent them

Run the AskUserQuestion intake above for anything not already stated. For anything about the
**recipient's personality, history, or likely reaction** that the user hasn't told you, mark it
`[assumption: professional/neutral]` rather than inventing a read on the person.

### Step 3 — Draft variants

Write at least 2 distinct variants matching the venue's register (Slack = short, casual, no
subject line; email = includes a subject line, slightly more formal; in-person = talking points,
not a verbatim script). Vary approach (e.g. direct-and-brief vs. warmer-and-context-giving), not
just word choice. For "deliver difficult feedback," keep at least one variant clear enough that
the actual concern is unambiguous — do not let every variant hedge the feedback away.

### Step 4 — Check each variant for real risk

For each variant, look for a specific word or sentence that is likely to land badly given the
stated relationship and intent. Write the flag only when there's a real, citable phrase — quote
it. If nothing stands out, write nothing for that variant; do not add a flag for symmetry.

### Step 5 — Recommend and hand off

Pick one variant given the stated relationship/intent and say why in one sentence. If venue is
Slack, note the handoff to `jstack:meetings-post-slack` for the actual draft-to-post step; for
every venue, restate that sending is the user's action, not this skill's.

## Output shape

```
## Draft 1 — <short label, e.g. "Direct and brief">
[venue-formatted draft — email includes "Subject: ..."; Slack is short/casual; in-person is
bulleted talking points]

[Impact flag, only if there's a real, specific one — quote the phrase]

## Draft 2 — <short label, e.g. "Warmer and more context-giving">
[...]

[Impact flag, only if relevant]

## Recommendation
Use **Draft <N>** because <one sentence tied to the stated relationship/intent>.

## Open questions [only if context was missing]
- [assumption: ...] — correct me if this is off.
```

## Failure modes

| Symptom | Recovery |
|---------|----------|
| User gave no message content, only venue/intent | Ask what they want to say before drafting; do not invent the substance. |
| Recipient's personality/history unknown | Mark `[assumption: professional/neutral]`; do not invent a read on the person. |
| User asks you to send it | Refuse; state sending is a separate action they take themselves (or route to `jstack:meetings-post-slack` for the Slack draft-only step). |
| Every variant reads the same after drafting | Rewrite one to genuinely differ in directness/warmth before presenting — two reworded copies of one sentiment is not two options. |
| Request is really a formal/org-wide announcement | Redirect to `jstack:announcements`; do not draft it here. |

## Chaining

This skill: tone/variant generation for **any** venue. `jstack:meetings-post-slack`: Slack-specific
draft-only posting mechanics (channel/thread resolution, `@here` rules) once the venue is Slack —
hand off the chosen draft's text to it rather than duplicating its logic here. Neither skill posts
or sends; both stop at a draft for the user to act on.

## User request

$ARGUMENTS

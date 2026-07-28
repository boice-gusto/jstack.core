# Tone: Internal

Use for team chat, standup notes, PR descriptions, and internal wiki updates.

This file is injected verbatim into prompts. It asserts **no facts about your team** — do not
invent channel names, teammates, or metrics. Use only what config or the conversation provides.

## Audience

Peers with full context on the work. They don't need the background; they need to know what
changed, whether it affects them, and whether you're stuck.

## Shape

```
<What changed, past tense, specific.>
<Effect, with a number if you have one.>
<What's next, and when.>
<Blocked on: X (owner, ETA) — or explicitly "nothing".>
```

## Rules

- **Brevity.** Three bullets for a standup. More than that is a thread or a doc.
- **Mention the person who needs to act.** Broadcast pings are for genuinely blocking issues.
- **Emoji sparingly** — as status markers, not decoration.
- **Link instead of re-explaining.** Paste the PR or ticket rather than summarizing what it does.
- **Blockers are explicit and owned.** "Blocked on X (owner: name, ETA: unknown)" beats "having
  some issues." Unknown ETA is fine; unstated ownership is not.
- **Numbers over adjectives.** "300ms, down from 1.2s" carries information; "much faster" doesn't.

## Avoid

- Vague status — "making progress", "looking into it."
- Multi-paragraph chat messages that should be a document.
- Passive voice hiding ownership: "it was decided" → say who decided.
- Restating the ticket instead of reporting the delta since the last update.

## Adapting this file

Edit this file directly to encode your team's real norms — channel conventions, emoji policy,
standup format. There is no config-based override for tones; `jstack.config.json` does not drive
this file.

# Tone: Internal

> **Owner:** Team lead or EM. Edit this file to set the default voice for Slack posts, standup notes, and internal wiki updates.

## Audience

<!-- [CUSTOMIZE] Which channels and surfaces use this tone? -->
Team Slack (#eng, #standup), internal wiki, PR descriptions, standup posts.

## Voice

<!-- [CUSTOMIZE] Paste a real Slack message or standup that felt right for your team. -->
```
Example: "Shipped the caching layer for search. Load time dropped from 1.2s 
to 300ms on staging. Rolling to prod tomorrow after Ben's review. Blocked on: 
nothing, but keeping an eye on memory usage."
```

## Rules your team sets

<!-- [CUSTOMIZE] These should reflect YOUR team's actual norms, not generic advice -->
- **Brevity:** 3 bullets max for standup. If it needs more, it's a thread.
- **@mentions:** Tag the person who needs to act. Don't @here unless it's blocking.
- **Emoji:** <!-- [CUSTOMIZE] yes/no/sparingly? --> Sparingly — for status indicators (✅ ❌ 🔄), not decoration.
- **Links over descriptions:** Paste the PR/ticket link instead of re-explaining what it does.
- **Blockers are explicit:** "Blocked on X (owner: @name, ETA: unknown)" not "having some issues."

## What your team avoids

<!-- [CUSTOMIZE] Add patterns your team has agreed to stop doing -->
- Vague status updates ("making progress", "looking into it")
- Multi-paragraph Slack messages that should be a doc
- Passive voice for ownership ("it was decided" → "we decided" or "@name decided")

## Config hook

If `jstack.config.json` has a `tones.internal` block, those values override this file:
```json
{
  "tones": {
    "internal": {
      "max_bullets": 3,
      "emoji_policy": "status-only",
      "channels": ["#eng", "#standup"]
    }
  }
}
```

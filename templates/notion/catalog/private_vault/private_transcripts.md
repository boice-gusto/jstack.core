# Transcripts

_Meeting transcripts, recording links, and AI summaries. Raw before they become team-visible notes._

## Conventions

- One page per recording. Title format: `YYYY-MM-DD — <meeting title>`.
- Body: link to recording, attendees, transcript paste or attachment, AI summary block.
- Tag with attendees so a person's hub can backlink.

## Default post targets

```
post_targets.transcript          → private_transcripts
post_targets.transcript_summary  → private_transcripts
```

Skills that write here:
- `/jstack:meetings transcribe`
- `whisper-transcribe`, `deepgram-stt`, `elevenlabs-stt`
- `/jstack:granola-daily-summary`

## Promotion path

| Content | Promote to |
|---|---|
| Decision captured in transcript | `Notes` (private) → ADR (team) |
| Action item | `Tasks` DB row |
| Quote / insight worth sharing | `Team Notes` |

---

_Wired by `jstack-notion-setup` — `notion_defaults.parent_pages.private_transcripts`_

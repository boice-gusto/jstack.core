# Team context (runtime template)

> **Owner:** PM or team lead. This file documents which `jstack.config.json` keys provide team context so skills can resolve values silently instead of asking the user.

**Privacy:** keys listed here are **team-safe**. Personal GBrain, diary paths, and session stores should **not** live in a shared team git config — see `skills/_core/references/repo-and-privacy.md`.

## Expected values from config

| Config key | What it provides | Example |
|------------|-----------------|---------|
| `team.name` | Team display name | "Platform Engineering" |
| `team.timezone` | Primary timezone for scheduling | "America/Los_Angeles" |
| `team.members` | Roster: nested buckets per person | `[{"id":"alice","metadata":{"name":"Alice","role":"EM"},"slack":{"handle":"@alice"}}]` |
| `channels` | Slack channel map | `{"eng": "#platform-eng", "incidents": "#sev"}` |
| `integrations.jira.project_key` | Default Jira project | "PLAT" |
| `sprint` | Current sprint name/id | "Sprint 23" |
| `session.current_session_id` | Opaque id for the active jstack session (for GBrain provenance) | UUID string |
| `gbrain.provenance` | Stamps on GBrain writes: config label, which fields, Slack resolution | see `gbrain-entry-provenance.md` |
| `tones` | Tone overrides | See `prompts/tones/*.md` |
| `personas` | Persona overrides | See `prompts/personas/*.md` |
| `policies` | Policy overrides | See `prompts/policies/*.md` |

## How skills use this

1. **Resolve silently** — if a config key exists, use it without asking.
2. **Ask only when blocked** — if a value is missing AND the skill cannot proceed, ask one question.
3. **Label assumptions** — if the skill proceeds with a guess, mark it `[assumption]` in output so the user can correct it.

## Adding new config keys

When your team needs a new shared value:
1. Add the key to `jstack.config.json`.
2. Add a row to this table.
3. Skills that need the value will pick it up automatically via the preamble.

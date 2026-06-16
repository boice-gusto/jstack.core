# Team repo vs personal workspace (privacy)

Yes — **keep them separate** when teammates must not see your sessions, diary, or personal GBrain.

## Why

- A **team** git repo is for **shared** plugin config, prompts, and org knowledge (`knowledge_base` roots for that repo’s docs).
- **Session output, personal GBrain URL, diary, “remember” facts, and personal skill defaults** belong in **your** environment only — not in a repo the team clones.

If those share a committed `jstack.config.json` with the team, anyone with read access can see URLs, paths, and anything that points at your private systems.

## Recommended split

| Lives in **team repo** (safe to share) | **Local / private only** (or a private repo on your account) |
|----------------------------------------|------------------------------------------------------------------|
| jstack **plugin** source (skills, prompts) | User-level `jstack` config overrides, if the host supports merge |
| Team `knowledge_base` for **this** repo’s `docs/` | Personal `gbrain.personal` URL and trust |
| Shared `gbrain.team` when the whole org uses one team brain | Session artifacts, standup raw exports, personal notes paths |
| `team.*`, shared integrations, org `tones` / `policies` | API tokens and paths under your home directory |

## GBrain

- **`gbrain.team`** — appropriate in a team-managed, shared config when everyone may use the same team knowledge base.
- **`gbrain.personal`** — treat as **sensitive**; use **local-only** config (or a private, non-team repo) so teammates do not get your personal brain URL in git.

## Practical pattern

1. **Team config** in the shared repo: only fields everyone may read. No personal GBrain, no home-directory paths, no “my” session store.
2. **Personal config** on your machine: e.g. `jstack.personal.json` in `~/.config/jstack/` or a file **gitignored** in the team repo (e.g. `jstack.personal.json` with `jstack.personal.example.json` committed as a template).
3. If the host only loads one JSON file, document “merge by hand” or use env vars for secrets — see `integration-guide.md`.

## Skills

jstack does not split git repos for you. **You** choose what is committed. Session, diary, and self-* skills follow `gbrain` and `session` from whatever config the host supplies — so **keep personal-only keys out of the team file**.

## See also

- `skills/_core/references/gbrain-persistence-metadata.md` — machine-readable `gbrain_destination` / `data_class` on skills
- `skills/_core/references/config-team-vs-personal.md` — schema has both team and personal; create repo / personal file when missing
- `skills/knowledge/references/gbrain-patterns.md` — team vs personal
- `skills/_core/references/integration-guide.md` — secrets
- `prompts/setup/team-context.md` — shared keys (do not use that file to store personal URLs)

# Team vs personal config (both supported)

## What is configured out of the box

`config/defaults.json` includes **both** sides:

| Area | Team | Personal |
|------|------|----------|
| **GBrain URLs** | `gbrain.team.url` + `trust_policy` | `gbrain.personal.url` + `trust_policy` |
| **Session default** | `session.default_gbrain_target` — `team` or `personal` | same key; choose where new sessions go |
| **Provenance** | `gbrain.provenance.*` shared; `config_label` can differ per machine | **Override** `config_label` + `identity` in personal file (see below) |

So yes: **team and personal are first-class** in the schema. You fill URLs and labels; the host decides how GBrain routes.

## Two files (recommended layout)

1. **Team / shared** — `jstack.config.json` in a **team git repo** (or plugin workspace).  
   - Contains: `team.*`, shared integrations, `gbrain.team`, org `knowledge_base`, `tones`, `policies`, **no** personal GBrain URL you need to keep private from the team (or use env for URL if your org allows).

2. **Personal overlay** — `jstack.personal.json` **not** committed (local path, e.g. `~/.config/jstack/jstack.personal.json`).  
   - Contains: `gbrain.personal`, optional `gbrain.provenance.config_label` (`work` / `home`), `gbrain.provenance.identity`, anything that is **only** for your machine.

Copy from: `config/personal.example.json`.

**Merge order (if the host supports layered config):** team file first, then personal overrides. If the host only reads one file, keep team in the repo and **copy** needed keys into a full local `jstack.config.json` on your laptop (not ideal for sync) or use a small script to merge JSON (org-specific).

## Create team config repo if it does not exist

When the team has **no** shared config yet:

1. Create a new directory and repo:  
   `mkdir my-org-jstack && cd my-org-jstack && git init`
2. Copy `config/defaults.json` from this plugin (or start from empty `{}`) to `jstack.config.json`.
3. Set `team.name`, `gbrain.team.url`, integrations, `knowledge_base.roots` for your docs.
4. **Do not** put `gbrain.personal` or home paths in this repo.
5. Commit: `git add jstack.config.json && git commit -m "Initial jstack team config"`.
6. Add a **README** pointing members to copy `personal.example.json` → `~/.config/jstack/jstack.personal.json`.

## Create personal config if it does not exist

When a user has no personal file:

1. `mkdir -p ~/.config/jstack`
2. `cp` (from this plugin) `config/personal.example.json` → `~/.config/jstack/jstack.personal.json`
3. Edit: set `gbrain.personal.url`, `gbrain.provenance.config_label`, optional `identity` slack fields.
4. Ensure the team repo’s `.gitignore` includes `jstack.personal.json` and `*personal*.json` if those files ever land in a clone, or keep personal only under `~/.config/`.

## Create plugin workspace `jstack.config.json` if missing (local dev)

If there is no config at the path the **host** loads:

1. Start from `config/defaults.json` in this repository.
2. Write `jstack.config.json` at the workspace root (this repo’s `.gitignore` ignores it for upstream dev; **your** fork may remove that line for a committed team file).
3. Run `jstack doctor` (or the equivalent) to validate.

`jstack:setup` and the **config wizard** should offer this path when the file is missing: show a template choice, then write the file (with user confirm).

## Relation to GBrain “creating” team vs personal spaces

- **jstack** does not call GBrain’s API to create orgs. You still **create** team vs personal GBrain **projects** in the GBrain product, then put the resulting **URLs** into `gbrain.team` / `gbrain.personal`.
- This config layer only **points** to those endpoints once they exist.

## See also

- `repo-and-privacy.md` — why to split repos
- `gbrain-patterns.md` / `gbrain-entry-provenance.md` — routing and entry metadata
- `config-wizard.md` — when keys are empty

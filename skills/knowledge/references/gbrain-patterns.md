# gbrain

- Team vs personal URLs from `gbrain.*` in config.
- Session target from `jstack:init-session` / `session.default_gbrain_target`.
- **Skill-level defaults:** each `SKILL.md` should declare `gbrain_destination` and `data_class` when outputs may be persisted — see `skills/_core/references/gbrain-persistence-metadata.md`.
- **Repos:** do not put personal GBrain or session data in a **team** git repo — use separate repos or local-only config. See `skills/_core/references/repo-and-privacy.md`.

## Lookup vs declared docs

- **Declared sources** (which folders, URLs, and GitHub repos count as “our docs”) live in `jstack.config.json` → `knowledge_base` and are used by `jstack:knowledge-search`.
- **`knowledge_storage`** (same file) names **team vs personal Git repos** (`git_remote` + `local_checkout`) and a **`disk_fallback_root`** (default `/tmp/knowledgebase`) for markdown when a checkout path is not set. Team shared repo vs personal private repo — both optional; unset → disk fallback under `{root}/{team|personal}/…`.
- **GBrain** is the product for team/personal *memory* and session-backed queries — it does not automatically crawl your whole monorepo. Use `knowledge_base` for paths and repos; set `knowledge_base.gbrain.include` when you also want GBrain in the same answer.

## Provenance on every write (session, config, Slack)

**Yes — you can track** `jstack_session_id`, **config** label/name, **Slack** handle (and optional user id), plus `source_skill` and `gbrain_target`. That keeps team vs personal separation and makes filtering reliable.

- Full field list and examples: `skills/knowledge/references/gbrain-entry-provenance.md`
- Config defaults: `gbrain.provenance` in `jstack.config.json` (see `config/defaults.json`)
- Skills that write to GBrain (`session` end, `self/remember`, etc.) should attach the envelope that host + config allow; never put secrets in metadata.

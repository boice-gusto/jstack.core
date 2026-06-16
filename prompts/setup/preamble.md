# jstack preamble

> Loaded at the start of every skill invocation. Provides context pointers, not content — keeps token cost low.

## Config

Team and tool context is loaded from `jstack.config.json` on disk (path resolved by the host).

## CLI registry

When you need structured CLI metadata: `jstack --help-json`

## Cross-plugin bridges

- gstack: see `prompts/shortcuts/gstack-bridge.md`
- superpowers: see `prompts/shortcuts/superpowers-bridge.md`

## Conventions

- Question-first: `skills/_core/references/question-patterns.md`
- Chaining: `skills/_core/references/chaining-guide.md`
- Where markdown in this plugin lives: `docs/MARKDOWN_SYSTEM.md` and `skills/_core/references/markdown-authoring-guide.md`

## Tone and persona injection

If the current task has a target audience, load the matching tone and/or persona:
- Tones: `prompts/tones/{executive,internal,formal}.md`
- Personas: `prompts/personas/{engineer,designer,ceo,qa}.md`
- Policies: `prompts/policies/{incident,sdlc,review,announcement}-policy.md`

These files are org-customizable templates. The PM/team lead maintains them so all agents write consistently. Config overrides via `jstack.config.json` keys: `tones.*`, `personas.*`, `policies.*`.

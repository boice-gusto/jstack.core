<p align="center">
  <img src="../assets/logo.png" alt="jstack" width="240" height="240" />
</p>

# jstack dashboard (local web UI)

Next.js 15 app that is a **companion** to the Claude plugin: same repo, same `jstack.config.json` in the current working directory when you run it from a project that uses jstack.

**Implemented today:** `agent`, `reports`, `wizard`, and `workspace` are real pages. `sprint`, `recon`, `incidents`, `jira`, `notion`, `meetings`, `research`, `metrics`, `routines`, `workflows`, `self`, and `settings` are one-line placeholder pages (the UI itself labels them `variant="stub"`) — routes exist so the nav is complete, but there's no wired-up functionality behind them yet.

## Run locally

The app lives under `jstack.core/dashboard` (not a top-level `dashboard/` folder) — `jstack.core` is a standalone repo, typically checked out next to sibling repos like `jstack.gusto` under a plain parent folder.

```bash
cd jstack.core/dashboard
bun install
bun run dev
```

Open the URL printed in the terminal (default `http://localhost:3333`; hardcoded via `-p 3333` in `dashboard/package.json`'s `dev`/`start` scripts).

## Relationship to plugin markdown

- This folder does **not** host `SKILL.md` or plugin skills. Capabilities live under [`/skills`](../skills/).
- If you add new pages, document env vars and config keys here or in [`jstack.core/README.md`](../README.md).

## Verification

```bash
cd jstack.core/dashboard
bun run lint
bun run typecheck
bun run test
```

## When to document here

- How to start/stop, build, and point at a specific `jstack.config.json`.
- Any dashboard-only feature flags (not duplicated in the plugin spec).

## Privacy

The dashboard runs locally. It does not replace plugin privacy rules: follow team policy for any data you paste or connect via integrations.

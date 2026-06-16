<p align="center">
  <img src="../assets/logo-placeholder.png" alt="jstack" width="240" height="240" />
</p>

# jstack dashboard (local web UI)

Next.js 15 app that surfaces team status, sprint, reports, recon, incidents, Jira, Notion, meetings, research, metrics, routines, workflows, and settings. It is a **companion** to the Claude plugin: same repo, same `jstack.config.json` in the current working directory when you run it from a project that uses jstack.

## Run locally

From the monorepo, the app lives under `jstack.core/dashboard` (not a top-level `dashboard/` folder).

```bash
cd jstack.core/dashboard
bun install
bun run dev
```

Open the URL printed in the terminal (default `http://localhost:3000`).

## Relationship to plugin markdown

- This folder does **not** host `SKILL.md` or plugin skills. Capabilities live under [`/skills`](../skills/).
- **Themes** for dashboard chrome live in [`/themes`](../themes/) (`jstack.json` palette + [`themes/README.md`](../themes/README.md)).
- If you add new pages, document env vars and config keys here or in [`jstack.core/README.md`](../README.md) (or the monorepo [`README.md`](../../README.md)).

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

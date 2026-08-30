# 1. Setup

jstack needs org-specific values before any skill can do real work — a Jira project key, a Notion
workspace, which integrations you actually have. It never guesses these; every skill that needs
one triggers the config wizard instead of proceeding on a placeholder.

Paste this as your first message in a repo with jstack installed:

```
/jstack:onboarding
```

That's `jstack-onboarding` — the first-time walkthrough. It runs the `jstack setup` wizard,
writes `jstack.config.json`, and validates it with `jstack doctor` before handing control back.
If you already have a `jstack.config.json` that's just broken or stale (not a brand-new project),
that's a different skill — `jstack:setup` (`jstack-setup`) repairs an existing install; it
explicitly refuses to double as the first-time walkthrough, and vice versa.

You'll be asked for real values — team name, timezone, which of Jira/Notion/Slack you actually
use. Answer with real values or explicitly skip; don't paste a token into chat when asked for
one — the wizard will tell you to route it through an environment variable instead and to rotate
it, because it was pasted in a place that gets logged.

## Pitfall

Running a skill before onboarding finishes doesn't fail loudly — it fails by asking you the same
config questions the wizard already asked, one at a time, mid-task. If a skill starts asking you
things `/jstack:onboarding` should have covered, finish onboarding first rather than answering
piecemeal.

**Next:** [Your first task](./02-first-task.md)

# 2. Your first task

Pick a real, small task and watch how a skill actually behaves — not a toy example, a real one
with a write gate.

```
/jstack:jira-create login page throws a 500 when the session cookie is expired instead of
redirecting to /login
```

`jstack-jira-create` has `disable-model-invocation: true` in its frontmatter — this skill will
**never** fire just because your message sounded like a bug report; it only runs when you invoke
it explicitly (slash command, or naming it directly). That's deliberate: anything that writes to
an external system (a Jira issue, a Notion page, a Slack message, an announcement) is gated this
way across all of jstack, so a model inferring "this sounds like a ticket" never silently files
one.

Once invoked, it checks for a near-duplicate before creating anything, pre-fills from your
config's Jira template, and reports back the real created issue key — never a fabricated one. If
your Jira integration isn't configured yet, it says so and points at `jstack setup` rather than
inventing a `PROJ-123`-looking key to make the response look complete.

## Pitfall

Don't judge a skill's completeness by whether it produced *something* — judge it by whether it
produced something **real**. `jstack-jira-create` explicitly refuses to fabricate a ticket key
under pressure (there's a live test for exactly this: `skill-jira-create-refuses-to-fabricate-
under-pressure` in `evals/a2a/cases/`). If a response looks confident but you can't find the
artifact it claims to have created, that's the skill working correctly under a broken
integration, not a bug.

**Next:** [Routing and config](./03-routing-and-config.md)

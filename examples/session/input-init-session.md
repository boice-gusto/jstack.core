# Session init (example input)

## User message to the agent

Initialize jstack session for team **acme-platform** for **Sprint 42**. I need standup context in **#eng-standup** and Jira project **PLAT**.

## Optional context

- Timezone: `America/Los_Angeles`
- Focus today: ship the auth hardening slice; no new scope

## Expected behavior

Load preamble, confirm `jstack.config.json` has `team_id` and integrations, then acknowledge session scope.

# Domain map: sprint, comms, SDLC, incidents

Use this when deciding which jstack surfaces to connect in a new workflow.

## By domain

| Domain | jstack skills (examples) | Config / templates | Chain / routine |
|--------|--------------------------|--------------------|-----------------|
| **Sprint** | `jstack:sprint-*`, `jstack:prioritize`, `jstack:intake` | `sprint.*`, `templates/config/sprint-templates.md` | `prompts/chains/intake-to-sprint-chain.md`, `routines.sprint_close` |
| **Comms** | `jstack:announcements`, `jstack:reports-*` | `tones/`, `policies.announcements`, `approval_chains` | `prompts/policies/announcement-policy.md` |
| **SDLC** | `jstack:engineering`, `jstack:workflows-*` | `policies.sdlc`, `templates/config/sdlc-templates.md` | `prompts/policies/sdlc-gates.md` |
| **Incidents** | `jstack:incident`, `jstack:announcements` (draft) | `policies.incidents`, `templates/config/incident-templates.md` | `prompts/chains/incident-response-chain.md` |
| **Approvals** | anything external or binding | `approval_chains`, `team.members` roles | `skills/_core/references/approval-chains.md` |

## File outputs the workflow builder can produce

1. **Chain doc** — `prompts/chains/<name>.md` (flow line, steps, handoff rules).
2. **Routine** — `jstack.config.json` → `routines.<name>.cron` + `routines.<name>.chain` (skill name list without `jstack:` prefix, matching repo convention in `config/defaults.json`).
3. **Policy slice** — merge into `policies.*` or link existing policy markdown under `prompts/policies/`.
4. **Full profile** — pick `templates/config/{startup,scaleup,enterprise}.json` as starting point, then `jstack:update-config` for edits.

## Skill ID format in chains

- In prose and chain docs, use `jstack:skill-name` (kebab) per repo README.
- In `routines.*.chain` arrays, the defaults use short names like `recon`, `announcements` — match what your runtime expects; document the convention in the chain file header.

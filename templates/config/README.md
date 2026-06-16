<p align="center">
  <img src="../../assets/logo-placeholder.png" alt="jstack" width="240" height="240" />
</p>

# Config templates

Predefined shapes for `jstack.config.json` and related policy/sprint/SDLC slices.

| Path | Use |
|------|-----|
| `org-context/` | Org handbook, ethics, coaching, review rubrics — markdown stubs + merge JSON; see README inside |
| `team-context/` | Operational slices (Slack, incidents, escalation); see README inside |
| `levels-expectations.example.md` | IC/EM ladder doc to point `levels_and_expectations.markdown_path` at |
| `startup.json` | Small team, flat approvals, light process |
| `scaleup.json` | Mid-size; 2-week sprints, standard gates |
| `enterprise.json` | Stricter SDLC, extended approval chains |
| `sprint-templates.md` | Sprint “personas” (light, standard, scaled, kanban) |
| `incident-templates.md` | Escalation SLAs and severity handling |
| `sdlc-templates.md` | Gate definitions from minimal to strict |

**Helpers:** After install, use `jstack:workflow-builder` to compose these into a chain and config merge plan; use `jstack:skill-creator` to add or change individual skills.

See also: `skills/_core/references/config-wizard.md`, `skills/_core/references/approval-chains.md`.

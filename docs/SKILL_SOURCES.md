# External PM skill sources (link-out and mapping)

jstack does **not** vendor full third-party `SKILL.md` trees. Use this file to **discover** related material and map themes to jstack skills. Prefer **original** prose in `skills/*/references/deep-dive.md` or **links** to upstream repos.

## Dean Peters — [Product-Manager-Skills](https://github.com/deanpeters/Product-Manager-Skills)

- **License:** [CC BY-NC-SA 4.0](https://raw.githubusercontent.com/deanpeters/Product-Manager-Skills/main/LICENSE) (Attribution–NonCommercial–ShareAlike).
- **Implication for jstack:** Verbatim or adapted **substantial** excerpts may carry **NC** and **ShareAlike** obligations. Do not copy large passages into this repo without a deliberate license/legal choice. Safe approaches: **link** to upstream, use the catalog for **keywords** only, or write **original** checklists inspired by public methods.
- **Scale:** Dozens of topical skills under `skills/` (e.g. journey mapping, acquisition, business health, company research). Treat the repo as a **menu** to browse, not a bundle to mirror.

### Theme → jstack mapping (curated)

| Upstream theme (examples) | jstack skill(s) |
|---------------------------|-----------------|
| Journey / customer mapping | `jstack:research-user`, `jstack:meetings-*`, deep-dive content in `skills/research/` |
| Prioritization frameworks (RICE, roadmap) | `jstack:prioritize`, `jstack:sprint`, `jstack:notion-planning` |
| Company / market research | `jstack:research-competitive`, `jstack:project` |
| Stakeholder comms / narrative | `jstack:announcements`, `prompts/tones/`, `prompts/personas/` |
| Tech / SDLC alignment | `jstack:sdlc`, `jstack:engineering` |

## Natea — [ar-claude-skills `product-team`](https://github.com/natea/ar-claude-skills/tree/main/product-team)

- **License:** No `LICENSE` file at repository root was found at documentation time. Treat content as **all rights reserved** until the author publishes a license; **do not copy** skill bodies or assets verbatim without permission.
- **Contents:** Role-style bundles (e.g. strategist, PM toolkit, product owner, UX, UI design system) with scripts and guides such as [`complete_product_team_skills.md`](https://github.com/natea/ar-claude-skills/blob/main/product-team/complete_product_team_skills.md).

### Role → jstack mapping

| Product-team role / bundle | jstack skill(s) |
|-----------------------------|-----------------|
| Head of product / strategist (OKR, vision) | `jstack:prioritize`, `jstack:project`, `jstack:reports-manager-report`, `jstack:notion-planning` |
| Senior PM (RICE, PRD, interviews) | `jstack:prioritize`, `jstack:intake`, `jstack:research-user`, `jstack:notion-article` |
| Product owner (stories, sprint) | `jstack:sprint`, `jstack:sprint-planning`, `jstack:jira-*` |
| UX research / design | `jstack:research-user`, `jstack:meetings-*` |
| UI / design system | Org-specific; bridge to design plugins or `jstack:research-technical` for handoff patterns |

## Composite aliases (jstack-only)

Persona + tone + target skill recipes live in [`prompts/shortcuts/composites.md`](../prompts/shortcuts/composites.md). Thin wrapper skills live under [`skills/shortcuts/`](../skills/shortcuts/).

## Rollout priority for `references/deep-dive.md`

Add deep-dive files **incrementally** (pilot set is already in `DEEP_DIVE_SKILLS` in `scripts/apply_detailed_skills.py`). Suggested next waves:

| Priority | Domain | Skill paths (examples) |
|----------|--------|-------------------------|
| P1 (done) | Core PM loop | `prioritize`, `intake`, `project`, `sprint/planning`, `research/competitive` |
| P2 | Delivery + tracking | `jira/*`, `sprint` (root), `engineering`, `metrics/*` |
| P3 | Comms + knowledge | `notion/*`, `announcements`, `knowledge/*`, `meetings/*` |
| P4 | People + quality | `reports/*`, `review/*`, `self/*`, `session/*` |

Add a skill key to `DEEP_DIVE_SKILLS` only after `references/deep-dive.md` exists; then re-run `python3 scripts/apply_detailed_skills.py`.

### Wave 1 pilot (`DEEP_DIVE_SKILLS`) — owner and wave

Use this table for rollout tracking. **Owner** is the DRI for keeping `references/deep-dive.md` accurate; **wave** matches the priority bands above (wave 1 = P1 core PM loop).

| Skill key | Owner | Wave | `deep-dive.md` |
|-----------|-------|------|----------------|
| `prioritize` | jstack maintainers | 1 | required before expand |
| `sprint/planning` | jstack maintainers | 1 | required before expand |
| `research/competitive` | jstack maintainers | 1 | required before expand |
| `intake` | jstack maintainers | 1 | required before expand |
| `project` | jstack maintainers | 1 | required before expand |

**Process:** (1) Add or update `skills/<key>/references/deep-dive.md`. (2) Add `<key>` to `DEEP_DIVE_SKILLS` in `scripts/apply_detailed_skills.py` if not already listed. (3) Run `python3 scripts/apply_detailed_skills.py`. (4) Optional: `bun run deep-dive:status` to verify files on disk.

## OpenAI — [`skills/.curated`](https://github.com/openai/skills/tree/main/skills/.curated)

**License:** Check each upstream folder’s `LICENSE.txt` before vendoring; prefer **links** and **original** jstack prose.

**Excluded from mapping** (no rows below, no allowlist picks): `aspnet-core`, `cloudflare-deploy`, `openai-docs`, `sora`, `winui-app`.

### Figma cluster (8 upstream folders → one jstack story)

| Upstream folder | Role | jstack |
|-----------------|------|--------|
| `figma` | Base Figma MCP workflow | [`figma-workflow.md`](../skills/_core/references/figma-workflow.md) |
| `figma-use` | Prerequisite before `use_figma` | Same + [`figma-handoff`](../skills/design/figma-handoff/SKILL.md) — load figma-use first |
| `figma-implement-design` | Design → code | `figma-handoff`, workflow ref |
| `figma-generate-design` | Code → Figma | Workflow ref “reverse handoff” |
| `figma-generate-library` | Tokens / library | Workflow ref + gusto `references/design/figma.md` |
| `figma-create-design-system-rules` | Rules generation | Link from gusto design ref |
| `figma-code-connect-components` | Code Connect | Repo `.figma.ts` / CC patterns |
| `figma-create-new-file` | New file bootstrap | Link-only unless needed |

### High-overlap single-folder skills

| Upstream | jstack |
|----------|--------|
| `notion-knowledge-capture` | [`notion/setup`](../skills/notion/setup/SKILL.md), notion router |
| `notion-meeting-intelligence` | `notion/standup`, `notion/one-on-one`, meetings |
| `notion-research-documentation` | `notion` + reports |
| `notion-spec-to-implementation` | `intake`, `jira`, engineering |
| `playwright` / `playwright-interactive` | Workflow runner, Playwright MCP, [`webapp-testing`](https://github.com/openai/skills/tree/main/skills/.curated/playwright) |
| `pdf` | User `pdf` skill; link-only |
| `security-best-practices` / `security-ownership-map` / `security-threat-model` | `review`, gusto compliance refs; link |

### Other curated (link-only or future)

`chatgpt-apps`, `cli-creator`, `doc`, `gh-address-comments`, `gh-fix-ci`, `jupyter-notebook`, `linear`, `netlify-deploy`, `render-deploy`, `vercel-deploy`, `screenshot`, `sentry`, `speech`, `transcribe`, `yeet` — browse [`.curated` listing](https://github.com/openai/skills/tree/main/skills/.curated); cherry-pick with license review.

## Upstream repos (PE / process)

| Source | Use for jstack |
|--------|----------------|
| [trycua / CUA](https://trycua.com/) (Driver, CuaBot, sandboxes) | `jstack-computer-use` (router), `jstack-computer-use-cua`; link-out in [`upstream-links.md`](../skills/computer-use/references/upstream-links.md) — do not vendor upstream bodies |
| [chrisvoncsefalvay/claude-d3js-skill](https://github.com/chrisvoncsefalvay/claude-d3js-skill) | D3 in HTML reports; verify license |
| [NeoLabHQ/context-engineering-kit](https://github.com/NeoLabHQ/context-engineering-kit) | CEK plugins; verify LICENSE |
| [obra/superpowers](https://github.com/obra/superpowers) | **Install alongside** jstack (MIT); do not fork into core |
| [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills) | Browse-only catalog |

### `.scratchpad/plugins` (local mirrors)

| Tree | Note |
|------|------|
| `claude-code-main/plugins/gusto-eng-pes` | Tier-1 gusto vendor target (PE pack; see `jstack.gusto/docs/plugin-allowlist.md`) |
| `claude-code-main/plugins/claude-introspection` | Fluency / evals overlap |
| `usp-pe-skills-main` | `usp-eng-throughput-dashboard` — modularize vs core |
| `usp-shared-main/plugins/*` | Dedup vs jstack.core before allowlist |
| `eng-team-throughput-main` | Throughput / DX-adjacent — **dedup** with `usp-eng-throughput-dashboard` + core `metrics/*`; one canonical throughput story |

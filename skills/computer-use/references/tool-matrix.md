# Computer-use — capability matrix (jstack)

Use this table to avoid duplicating content that already lives elsewhere in **jstack.core**.

| Capability | Where it lives | Action |
|------------|----------------|--------|
| **Workflow YAML / `jstack workflow` CLI** | `skills/workflows/` (`jstack-workflows` and children) | Router **links** here only. |
| **Playwright patterns** | `skills/workflows/references/playwright-patterns.md` | **Link only**. |
| **browser_use** | `skills/workflows/references/browser-use-patterns.md`; stub in `cli/src/lib/workflow-engine.ts` | **Link only**; no parallel `browser-use/SKILL.md` in core unless product requests it. |
| **Playwright MCP** | Host config (e.g. `.cursor/mcp.json`); `@playwright/mcp` | Document as **enable in host** + `integration-guide.md` MCP section. |
| **Chromium / CDP as a named jstack skill** | Not present | **Do not create** unless there is a concrete jstack-owned workflow. |
| **CUA (Driver, CuaBot, sandboxes)** | `skills/computer-use/cua/SKILL.md` (`jstack-computer-use-cua`) | Full lifecycle, verbs, examples. |
| **Upstream CUA docs** | `skills/computer-use/references/upstream-links.md` | Canonical URLs. |

## Native vs web (one line)

- **Native / desktop UI on the host** → **`jstack-computer-use-cua`**.
- **Web** → Playwright MCP (if configured) and/or **`jstack-workflows`**.

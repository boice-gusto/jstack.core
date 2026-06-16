# Marketplace and catalog registry

When you **add a plugin**, **remove a plugin**, or **change marketplace metadata** (description, optional `mcpServers` configs, tags, category, version on the listing), you must keep every catalog consumer in sync.

## Canonical source

| File | Role |
|------|------|
| `.claude-plugin/marketplace.json` | **Source of truth** for Claude Code (`/plugin marketplace add …`) and for `index.html` embed |

## Mirrors (must match when the catalog changes)

| File / artifact | When to update |
|-----------------|----------------|
| `.cursor-plugin/marketplace.json` | Whenever `.claude-plugin/marketplace.json` changes — keep the same top-level fields and `plugins` array (Cursor / IDE catalog) |
| `index.html` embedded JSON | **Do not edit by hand.** Run `make sync-marketplace` after changing `.claude-plugin/marketplace.json` |

## Make commands (from repo root)

| Command | Use |
|---------|-----|
| `make validate` | Runs `claude plugin validate .` — run after any plugin/skill/agent/hook change |
| `make sync-marketplace` | Regenerates the `index.html` marketplace embed from `.claude-plugin/marketplace.json` |
| `make check-marketplace-embed` | Fails if the embed is stale — run before pushing (CI runs this) |

Skills, agents, and hooks under an **existing** plugin do **not** need a new marketplace row; Claude discovers them from the filesystem. You still should run `make validate` before commit.

## Checklist by change type

### New plugin

1. Create plugin tree under `plugins/<name>/`, including **both** `plugins/<name>/.claude-plugin/plugin.json` and **`plugins/<name>/.cursor-plugin/plugin.json`** (same `name`, `version`, and metadata unless you have a deliberate reason to diverge).
2. Add the plugin object to the `plugins` array in `.claude-plugin/marketplace.json` (`name`, `source`, `description`, `version`, `author`, `category`, `tags`, and `mcpServers` only if the entry defines MCP servers per the marketplace schema).
3. **Copy or merge the same entry** into `.cursor-plugin/marketplace.json` so it matches `.claude-plugin/marketplace.json` (simplest: align the full file structure with the canonical file).
4. Run `make validate`.
5. Run `make sync-marketplace`.
6. Commit (pre-commit will bump affected `plugin.json` patch versions when `plugins/` changes).

### Update existing plugin’s marketplace listing only

(e.g. description tweak, tag change, or MCP config change on the listing)

1. Edit `.claude-plugin/marketplace.json`.
2. Apply the **same edits** to `.cursor-plugin/marketplace.json`.
3. Run `make sync-marketplace`.
4. `make validate` if you also changed plugin content.

### New skill, agent, or hook (existing plugin)

1. Add files under `plugins/<plugin>/` per conventions.
2. Run `make validate`.
3. **No** `.claude-plugin/marketplace.json` or `.cursor-plugin/marketplace.json` change unless you are also changing the **plugin-level** listing.

### Remove a plugin

1. Remove its directory under `plugins/`.
2. Remove its object from `plugins` in both `.claude-plugin/marketplace.json` and `.cursor-plugin/marketplace.json`.
3. Run `make validate` and `make sync-marketplace`.

## Verification before PR

- `make validate`
- `make check-marketplace-embed`
- `./scripts/bump-plugin-version.sh --check` (or `make bump-check`) when `plugins/` or `.claude-plugin/` changed, if CI expects it

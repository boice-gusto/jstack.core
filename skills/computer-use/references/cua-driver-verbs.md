# Cua Driver (macOS 14+) — verb detail

Docs: [Installation](https://cua.ai/docs/cua-driver/guide/getting-started/installation), [Quickstart](https://cua.ai/docs/cua-driver/guide/getting-started/quickstart).

Summary table lives in `skills/computer-use/cua/SKILL.md`. This file holds the terminal copy-paste examples per verb.

<details>
<summary><strong>setup</strong> — Cua Driver (install, PATH, MCP for Cursor)</summary>

**Refs:** [Installation](https://cua.ai/docs/cua-driver/guide/getting-started/installation) · [MCP config](https://cua.ai/docs/cua-driver/guide/getting-started/installation#register-with-an-mcp-client-optional)

Install drops `CuaDriver.app` in `/Applications` and symlinks `~/.local/bin/cua-driver`. Reload shell if the installer appended `PATH`.

```bash
# Official install (no sudo on typical Mac accounts)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/trycua/cua/main/libs/cua-driver/scripts/install.sh)"
```

```bash
# Optional: custom bin dir or skip rc edits (see install doc for full flags)
# /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/trycua/cua/main/libs/cua-driver/scripts/install.sh)" -- --no-modify-path
```

```bash
# Cursor MCP: print JSON snippet, then paste into ~/.cursor/mcp.json (or project .cursor/mcp.json)
cua-driver mcp-config --client cursor
# Or copy to clipboard on macOS:
# cua-driver mcp-config --client cursor | pbcopy
```

The spawned command shape is typically `~/.local/bin/cua-driver mcp` (stdio MCP). See installation page for Claude Code / Codex / other clients.

</details>

<details>
<summary><strong>test</strong> — Cua Driver (version, help, TCC)</summary>

**Refs:** [Installation — Verify](https://cua.ai/docs/cua-driver/guide/getting-started/installation#verify-it-worked) · [Grant TCC](https://cua.ai/docs/cua-driver/guide/getting-started/installation#grant-tcc-permissions)

```bash
cua-driver --version
cua-driver --help
```

```bash
# Daemon first so TCC attributes to CuaDriver.app, then trigger permission prompts
open -n -g -a CuaDriver --args serve
cua-driver check_permissions
# Grant in System Settings if needed, then re-run:
cua-driver check_permissions
```

IDE terminals may show misleading TCC status; prefer the daemon-first flow above.

</details>

<details>
<summary><strong>execute</strong> — Cua Driver (CLI loop; prefer MCP when registered)</summary>

**Refs:** [Quickstart](https://cua.ai/docs/cua-driver/guide/getting-started/quickstart) · [MCP tools](https://cua.ai/docs/cua-driver/reference/mcp-tools) · [CLI reference](https://cua.ai/docs/cua-driver/reference/cli-reference)

Element-indexed flows need a **running daemon** (cache is in-process). Optional: `cua-driver config set capture_mode som` for AX + screenshot in snapshots.

```bash
open -n -g -a CuaDriver --args serve
cua-driver status
```

```bash
# Launch app in background (example: Calculator)
cua-driver launch_app '{"bundle_id":"com.apple.calculator"}'
# Note returned pid and window_id from output, then:
cua-driver get_window_state '{"pid":844,"window_id":10725}'
```

```bash
# Click by element_index from the snapshot (replace pid, window_id, index)
cua-driver click '{"pid":844,"window_id":10725,"element_index":14}'
```

```bash
# Re-snapshot to verify the UI changed (required pattern per quickstart)
cua-driver get_window_state '{"pid":844,"window_id":10725}'
```

```bash
# Pixel click + screenshot file (window-local coordinates)
cua-driver get_window_state '{"pid":844,"window_id":10725}' --image-out /tmp/shot.png
cua-driver click '{"pid":844,"window_id":10725,"x":120,"y":240}'
```

```bash
# MCP stdio (registered in Cursor): the client runs this; do not paste unless debugging
# ~/.local/bin/cua-driver mcp
```

Replace `pid` / `window_id` / `element_index` with values from **your** `launch_app` / `get_window_state` output.

</details>

<details>
<summary><strong>status</strong> — Cua Driver</summary>

**Ref:** [Installation — Run the daemon](https://cua.ai/docs/cua-driver/guide/getting-started/installation#run-the-daemon)

```bash
cua-driver status
```

</details>

<details>
<summary><strong>restart</strong> — Cua Driver</summary>

**Ref:** [Installation — Run the daemon](https://cua.ai/docs/cua-driver/guide/getting-started/installation#run-the-daemon)

`open -n -g -a CuaDriver --args serve` ties the process to `CuaDriver.app` for TCC.

```bash
cua-driver stop
open -n -g -a CuaDriver --args serve
cua-driver status
```

</details>

<details>
<summary><strong>destroy</strong> — Cua Driver (uninstall)</summary>

**Ref:** [cua-driver-uninstall.md](${CLAUDE_PLUGIN_ROOT}/skills/computer-use/references/cua-driver-uninstall.md) (verbatim from installation page)

```bash
cua-driver stop 2>/dev/null
rm -rf /Applications/CuaDriver.app
rm -f ~/.local/bin/cua-driver
sudo rm -f /usr/local/bin/cua-driver 2>/dev/null || true
rm -rf ~/.cua-driver
rm -rf ~/Library/Application\ Support/Cua\ Driver
rm -rf ~/Library/Caches/cua-driver
launchctl unload ~/Library/LaunchAgents/com.trycua.cua_driver_updater.plist 2>/dev/null
rm -f ~/Library/LaunchAgents/com.trycua.cua_driver_updater.plist
```

Require explicit user confirmation before running uninstall on their machine.

</details>

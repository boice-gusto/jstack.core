# Cua Driver — uninstall and troubleshooting (upstream)

Verbatim workflow from [Cua Driver installation](https://cua.ai/docs/cua-driver/guide/getting-started/installation) (Uninstall and Troubleshooting sections). If upstream changes, prefer the live page.

## Uninstall

```bash
# Stop the daemon if running.
cua-driver stop 2>/dev/null

# Remove the app and the CLI symlink.
rm -rf /Applications/CuaDriver.app
rm -f ~/.local/bin/cua-driver
# legacy install path (only present on installs from before v0.1.0)
sudo rm -f /usr/local/bin/cua-driver 2>/dev/null || true

# Optional: remove config + telemetry state.
rm -rf ~/.cua-driver
rm -rf ~/Library/Application\ Support/Cua\ Driver
rm -rf ~/Library/Caches/cua-driver

# Optional: remove legacy LaunchAgent from older installs (≤ v0.0.5).
launchctl unload ~/Library/LaunchAgents/com.trycua.cua_driver_updater.plist 2>/dev/null
rm -f ~/Library/LaunchAgents/com.trycua.cua_driver_updater.plist
```

## Troubleshooting (selected)

- **`cua-driver: command not found`** — `~/.local/bin` isn't on your PATH. Add it and reload (see install page first-time callout).

- **Permissions dialogs reappear after every launch** — macOS is attributing the process to a different bundle id than the one you granted. Run `cua-driver diagnose` and paste the output when filing an issue; it reports cdhash, team id, and which bundle TCC is checking against.

- **Daemon won't start** — another daemon may already be bound to the socket. Check with `cua-driver status` and stop it with `cua-driver stop`. For stale lock files after a crash, the daemon's own probe detects those and proceeds.

## TCC — daemon-first (summary)

Start the daemon first so TCC attributes requests to `CuaDriver.app`:

```bash
open -n -g -a CuaDriver --args serve
```

Then:

```bash
cua-driver check_permissions
```

`check_permissions` reports the TCC status of the **calling process**. Inside an IDE terminal the shell inherits the IDE's TCC chain, so results can read "NOT granted" even when both are granted to `CuaDriver.app`. The daemon-first recipe sidesteps this because the CLI forwards through the daemon under `CuaDriver.app`'s bundle id.

Full narrative: [installation — Grant TCC permissions](https://cua.ai/docs/cua-driver/guide/getting-started/installation).

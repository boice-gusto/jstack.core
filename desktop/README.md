# jstack desktop

A menu-bar-friendly native chat client for crew (`cli/src/lib/crew/`), jstack.core's persistent
agent daemon. Tauri v2 + React 19 + Vite frontend, Rust backend that talks to the daemon over a
Unix domain socket (`~/.jstack/crew/agent.sock`, JSON-RPC, newline-delimited).

## Running it

**While developing:** `bun run tauri dev` (from this directory). This launches the real native
window with a live-reloading frontend -- edit `src/*.tsx` and it updates in place. Opening
`http://localhost:1420` in a regular browser tab instead of the native window will NOT work: the
Tauri IPC bridge (`window.__TAURI_INTERNALS__`) only exists inside the actual app window.

**Testing a real build:** `bun run tauri build` produces
`src-tauri/target/release/bundle/macos/desktop.app`. This is a snapshot -- Tauri embeds the
frontend into the compiled binary at build time, so editing source and re-running `bun run dev`
or `bun run build` alone does **not** update an already-built `.app`. If you have this app
pinned to Spotlight/Launchpad/the Dock, re-run `bun run tauri build` after any change you want
that shortcut to reflect, or just use `bun run tauri dev` while iterating.

## The daemon has to be running

The app is a thin client -- nearly everything (sessions, chat, status) requires crew's daemon to
be up and listening on its socket. If you see "could not connect to .../agent.sock" in the
Status panel, the daemon isn't running yet:

```sh
jstackc crew init --user <your Slack user id> --dm <your Slack DM channel id> --workspace <path>
jstackc crew install   # sets up the resident daemon (launchd on macOS)
jstackc crew doctor     # verify
```

`JSTACK_AGENT_SOCK` overrides the socket path the app connects to, if you're pointing it at a
non-default daemon (e.g. an isolated one for testing).

## Frontend stack

- Tailwind v4 + shadcn/ui (`components.json`, `src/lib/utils.ts`, `src/components/ui/*`) for the
  chrome (buttons, inputs, badges).
- Vercel AI Elements (`src/components/ai-elements/*`) for the chat transcript itself
  (`Conversation`/`Message`/`Tool`, with Streamdown for markdown rendering). Only
  `conversation.tsx`, `message.tsx`, `tool.tsx`, and `code-block.tsx` are pulled in from the
  full AI Elements registry -- adding another AI Elements component later means running
  `npx shadcn@latest add https://elements.ai-sdk.dev/api/registry/<name>.json` yourself, not
  re-running the "add everything" default (`npx ai-elements@latest`), which drags in file
  attachments, flow diagrams, carousels, and other component families this app doesn't use.
- The composer and sidebar deliberately do NOT use AI Elements' `PromptInput` -- that component
  brings attachment/model-selector/speech-input UI this app has no backing for. Plain shadcn
  `Input`/`Button` covers what's actually needed.

## Tests

- `bun run test` -- Vitest + Testing Library against a mocked Tauri IPC layer
  (`@tauri-apps/api/mocks`), the standard way to test Tauri frontend code without a real backend.
- `cargo test` (from `src-tauri/`) -- Rust unit tests plus an integration test that spawns a real
  `crewd` instance under an isolated `HOME`/state dir and drives it over the actual socket.

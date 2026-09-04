import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import App from "./App";

/**
 * @tauri-apps/api/mocks's mockIPC() only stubs window.__TAURI_EVENT_PLUGIN_INTERNALS__ as an
 * empty object, not a working one -- listen()'s real unlisten() (called on every effect cleanup
 * that uses `listen()`, e.g. App.tsx's tray-event subscriptions) throws "not a function" the
 * instant a test unmounts. Mocking the whole module sidesteps that gap entirely, and as a bonus
 * lets tests simulate an incoming tray event via `emitMockTauriEvent` instead of only suppressing
 * the crash.
 */
const trayEventListeners = new Map<string, (event: { payload: unknown }) => void>();
vi.mock("@tauri-apps/api/event", () => ({
  listen: (event: string, callback: (event: { payload: unknown }) => void) => {
    trayEventListeners.set(event, callback);
    return Promise.resolve(() => trayEventListeners.delete(event));
  },
}));
function emitMockTauriEvent(event: string, payload: unknown): void {
  trayEventListeners.get(event)?.({ payload });
}

/**
 * Exercises the React chat view against a mocked Tauri IPC layer (the same technique Tauri
 * documents for testing frontend code with no real backend/webview) -- this is the closest
 * automated coverage available without a way to drive the real desktop app's window, which
 * would need GUI automation tooling this environment doesn't have.
 */
afterEach(() => {
  cleanup();
  clearMocks();
  trayEventListeners.clear();
  // switchToSession persists the open session id so it can be restored on the next launch --
  // without clearing it here, a later test's mount effect could try to restore a session id
  // left over from an earlier test in this same jsdom environment.
  localStorage.clear();
});

const RALPH = {
  id: "ralph",
  name: "Ralph",
  enabled: true,
  model: "claude-sonnet-5",
  persona: "",
  tools: ["Read", "Grep", "Glob"],
  mcp: "none" as const,
  proactiveChecks: [],
};

/**
 * `agent_list` (mount) and `daemon_status` (opened lazily from the settings dialog) both get a
 * blanket default here so most tests don't have to answer commands they aren't exercising.
 * `session_list` is what most tests care about directly, so it always has to come from the
 * test's own handler, never a shared default.
 */
function withDefaults(
  handler: (cmd: string, payload?: unknown) => unknown,
): (cmd: string, payload?: unknown) => unknown {
  return (cmd, payload) => {
    if (cmd === "agent_list") return [RALPH];
    if (cmd === "daemon_status") {
      return {
        tasks: 0,
        outbox: 0,
        spentToday: 0,
        watermarks: 0,
        enabled: true,
        mode: "dry_run",
        resident: true,
        uptimeMs: 0,
        perAgent: [],
      };
    }
    if (cmd === "schedule_list") return { schedules: [] };
    // Every mount syncs the tray icon/menu (see App.tsx's tray effects) -- none of that is under
    // test here, so it gets a blanket no-op rather than making every single test's handler
    // enumerate commands it doesn't care about. (Tray *event subscriptions* don't need a case
    // here at all -- @tauri-apps/api/event is mocked wholesale above, so `listen()` never calls
    // through `invoke` in tests.)
    if (cmd === "set_tray_status" || cmd === "update_tray_menu") return null;
    return handler(cmd, payload);
  };
}

function clickNewChat(): void {
  fireEvent.click(screen.getByTitle("New chat"));
}

describe("App", () => {
  test("creating a session, sending a message, and seeing a real reply", async () => {
    mockIPC(
      withDefaults((cmd, payload) => {
        if (cmd === "session_list") return [];
        if (cmd === "session_new") {
          expect(payload).toEqual({ agentId: "ralph" });
          return { id: "ral-abcd", sessionId: "11111111-1111-1111-1111-111111111111" };
        }
        if (cmd === "session_prompt") {
          expect(payload).toEqual({
            id: "ral-abcd",
            message: "hello there",
            mode: "full-access",
            thinkingLevel: "none",
          });
          return { ok: true, text: "hi! how can I help?", costUsd: 0.0042, toolEvents: [] };
        }
        throw new Error(`unexpected command: ${cmd}`);
      }),
    );

    render(<App />);
    await waitFor(() => screen.getByTitle("New chat"));
    clickNewChat();
    await waitFor(() => screen.getByPlaceholderText("Say something..."));

    fireEvent.change(screen.getByLabelText("message"), {
      target: { value: "hello there" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => screen.getByText(/hi! how can I help\?/));
    expect(
      screen.getByText(/hello there/).closest('[data-role="user"]'),
    ).toBeTruthy();
    // The raw cost now only shows in a hover tooltip (not jsdom-testable, same portal/floating-ui
    // limitation as elsewhere in this file) -- the always-visible elapsed-time label is what's
    // covered here instead.
    expect(screen.getByText(/^\ds$/)).toBeTruthy();
  });

  // No DOM-interaction test covers actually picking a thinking level/mode from the composer's
  // two new DropdownMenus -- Base UI's Menu hangs indefinitely under fireEvent.click in a full
  // App render (the same pre-existing jsdom limitation documented on the agent-picker and "..."
  // menu elsewhere in this file; confirmed here too via a 5s timeout with the menu content never
  // appearing). promptControls.test.ts covers the persistence logic directly, and the first test
  // above already proves the default ("full-access"/"none") values reach session_prompt.

  test("sending a message in one session and switching away before the reply arrives doesn't show 'Thinking...' or block the composer in the other session, and doesn't leak the reply into it", async () => {
    let resolvePromptA: (result: unknown) => void;
    const promptAPromise = new Promise((resolve) => {
      resolvePromptA = resolve;
    });
    mockIPC(
      withDefaults((cmd, payload) => {
        if (cmd === "session_list") {
          return [
            { id: "ral-a", agentId: "ralph", state: "idle", turns: 1, costUsd: 0 },
            { id: "ral-b", agentId: "ralph", state: "idle", turns: 1, costUsd: 0 },
          ];
        }
        if (cmd === "session_history") return [];
        if (cmd === "session_prompt") {
          expect((payload as { id: string }).id).toBe("ral-a");
          return promptAPromise;
        }
        throw new Error(`unexpected command: ${cmd}`);
      }),
    );
    render(<App />);
    await waitFor(() => screen.getByText("ral-a"));

    fireEvent.click(screen.getByText("ral-a"));
    await waitFor(() =>
      expect(screen.getByText("ral-a").closest("div")?.className).toContain("border-primary"),
    );
    fireEvent.change(screen.getByLabelText("message"), { target: { value: "hello from A" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    // Session A is now "Thinking..." with its composer disabled -- expected, it's the one
    // actually waiting on a reply.
    await screen.findByText(/Thinking/);
    expect(screen.getByLabelText("message")).toBeDisabled();

    // Switching to session B (idle, unrelated) while A's request is still in flight must not
    // carry any of that over -- this is the exact bug report: "I see thinking... if I choose
    // another thread it shows the same thinking across all threads."
    fireEvent.click(screen.getByText("ral-b"));
    await waitFor(() =>
      expect(screen.getByText("ral-b").closest("div")?.className).toContain("border-primary"),
    );
    expect(screen.queryByText(/Thinking/)).toBeNull();
    expect(screen.getByLabelText("message")).not.toBeDisabled();

    // A's reply arrives while B is on screen -- must not appear in B's transcript.
    resolvePromptA!({ ok: true, text: "reply for A", costUsd: 0.001, toolEvents: [] });
    await waitFor(() => expect(screen.queryByText(/Thinking/)).toBeNull());
    expect(screen.queryByText("reply for A")).toBeNull();
  });

  test("the tray icon pulses green/green-dim while a session is thinking, and settles back to a static status the instant nothing is", async () => {
    vi.useFakeTimers();
    try {
      let resolvePrompt: (result: unknown) => void;
      const promptPromise = new Promise((resolve) => {
        resolvePrompt = resolve;
      });
      const trayStatusCalls: string[] = [];
      mockIPC((cmd, payload) => {
        if (cmd === "agent_list") return [RALPH];
        if (cmd === "daemon_status") {
          return { tasks: 0, outbox: 0, spentToday: 0, watermarks: 0, enabled: true, mode: "dry_run" };
        }
        if (cmd === "update_tray_menu") return null;
        if (cmd === "set_tray_status") {
          trayStatusCalls.push((payload as { status: string }).status);
          return null;
        }
        if (cmd === "session_list") {
          return [{ id: "ral-a", agentId: "ralph", state: "idle", turns: 1, costUsd: 0 }];
        }
        if (cmd === "session_history") return [];
        if (cmd === "session_prompt") return promptPromise;
        throw new Error(`unexpected command: ${cmd}`);
      });
      render(<App />);
      await vi.waitFor(() => screen.getByText("ral-a"));
      expect(trayStatusCalls.every((s) => s === "none")).toBe(true);

      fireEvent.click(screen.getByText("ral-a"));
      await vi.waitFor(() =>
        expect(screen.getByText("ral-a").closest("div")?.className).toContain("border-primary"),
      );
      fireEvent.change(screen.getByLabelText("message"), { target: { value: "hi" } });
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
      await vi.waitFor(() => screen.findByText(/Thinking/));

      // The pulse fires immediately (green), then alternates every 600ms.
      await vi.waitFor(() => expect(trayStatusCalls.at(-1)).toBe("green"));
      await vi.advanceTimersByTimeAsync(600);
      expect(trayStatusCalls.at(-1)).toBe("green-dim");
      await vi.advanceTimersByTimeAsync(600);
      expect(trayStatusCalls.at(-1)).toBe("green");

      // Reply arrives -- nothing is thinking anymore, so the pulse stops and the icon goes back
      // to a static status (here "none": no error, nothing waiting).
      resolvePrompt!({ ok: true, text: "done", costUsd: 0.001, toolEvents: [] });
      await vi.waitFor(() => expect(trayStatusCalls.at(-1)).toBe("none"));
      const callsAtRest = trayStatusCalls.length;
      await vi.advanceTimersByTimeAsync(3000);
      expect(trayStatusCalls.length).toBe(callsAtRest); // no more pulsing once idle
    } finally {
      vi.useRealTimers();
    }
  });

  test("the window title reflects the active agent's name, never the literal word 'jstack'", async () => {
    mockIPC(withDefaults((cmd) => (cmd === "session_list" ? [] : Promise.reject())));
    render(<App />);
    await waitFor(() => expect(screen.getByTitle(/Switch agent \(currently Ralph\)/)).toBeTruthy());
    expect(screen.queryByText("jstack")).toBeNull();
    expect(document.title).toBe("Ralph");
  });

  test("tray menu clicks (agent, session, settings) route back in as events, since the click itself happens in Rust", async () => {
    const SCOUT = { ...RALPH, id: "scout", name: "Scout" };
    mockIPC((cmd) => {
      if (cmd === "agent_list") return [RALPH, SCOUT];
      if (cmd === "session_list") {
        return [{ id: "sct-1", agentId: "scout", state: "idle", turns: 1, costUsd: 0 }];
      }
      if (cmd === "session_history") return [];
      if (cmd === "daemon_status") {
        return {
          tasks: 0,
          outbox: 0,
          spentToday: 0,
          watermarks: 0,
          enabled: true,
          mode: "dry_run",
          resident: true,
          uptimeMs: 0,
          perAgent: [],
        };
      }
      if (cmd === "schedule_list") return { schedules: [] };
      if (cmd === "skills_index") return { skills: [] };
      if (cmd === "set_tray_status" || cmd === "update_tray_menu") return null;
      throw new Error(`unexpected command: ${cmd}`);
    });
    render(<App />);
    await waitFor(() => screen.getByText("sct-1"));

    // The agent picker starts on Ralph (the first agent) -- a tray click on Scout should
    // switch it, same as picking Scout from the sidebar's own agent-picker dropdown would.
    expect(screen.getByTitle(/Switch agent \(currently Ralph\)/)).toBeTruthy();
    emitMockTauriEvent("tray-agent-selected", "scout");
    await waitFor(() => expect(screen.getByTitle(/Switch agent \(currently Scout\)/)).toBeTruthy());

    emitMockTauriEvent("tray-session-selected", { id: "sct-1", agentId: "scout" });
    await waitFor(() =>
      expect(screen.getByText("sct-1").closest("div")?.className).toContain("border-primary"),
    );

    emitMockTauriEvent("tray-open-settings", undefined);
    await screen.findByText("Settings");
    fireEvent.click(screen.getByRole("tab", { name: "Appearance" }));
    await screen.findByText("Accent color");
  });

  // handleSelectAgentFromPicker's two branches (no session for the agent -> create one; sessions
  // exist -> jump to the most recent) aren't covered by an automated DOM test: the agent picker
  // is a Base UI DropdownMenu, and opening one via fireEvent hangs waiting for content that never
  // renders in jsdom (same limitation noted elsewhere in this file and in
  // SettingsDialog.test.tsx). Verified manually against the live app instead.

  test("the header's search trigger is an icon-only button next to the '...' menu, not the old wide text bar", async () => {
    mockIPC(withDefaults((cmd) => (cmd === "session_list" ? [] : Promise.reject())));
    render(<App />);
    await waitFor(() => screen.getByText("No sessions yet"));
    expect(screen.queryByText("Search chats, agents, settings...")).toBeNull();
    expect(screen.getByTitle(/Search chats, agents, settings/)).toBeTruthy();

    fireEvent.click(screen.getByTitle(/Search chats, agents, settings/));
    await screen.findByPlaceholderText(/Search chats, agents, settings/);
  });

  test("a session_prompt error result is shown as an error message, not silently dropped", async () => {
    mockIPC(
      withDefaults((cmd) => {
        if (cmd === "session_list") return [];
        if (cmd === "session_new") return { id: "ral-fail", sessionId: "x" };
        if (cmd === "session_prompt") {
          return { ok: false, text: "daily budget cap ($20) reached", costUsd: 0, toolEvents: [] };
        }
        throw new Error(`unexpected command: ${cmd}`);
      }),
    );

    render(<App />);
    await waitFor(() => screen.getByTitle("New chat"));
    clickNewChat();
    await waitFor(() => screen.getByPlaceholderText("Say something..."));

    fireEvent.change(screen.getByLabelText("message"), {
      target: { value: "anything" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => screen.getByText(/daily budget cap/));
  });

  test("a transport failure (daemon not running) surfaces as a session error, not a crash", async () => {
    mockIPC(
      withDefaults((cmd) => {
        if (cmd === "session_list") return [];
        if (cmd === "session_new") {
          throw new Error("could not connect to /Users/x/.jstack/crew/agent.sock: No such file");
        }
        throw new Error(`unexpected command: ${cmd}`);
      }),
    );

    render(<App />);
    await waitFor(() => screen.getByTitle("New chat"));
    clickNewChat();

    await waitFor(() => screen.getByText(/could not connect/));
  });

  test("Send is disabled until a session exists", async () => {
    mockIPC(
      withDefaults((cmd) => {
        if (cmd === "session_list") return [];
        throw new Error(`no session command should fire before New chat is clicked: ${cmd}`);
      }),
    );
    render(<App />);
    await waitFor(() => screen.getByLabelText("message"));
    expect(screen.getByLabelText("message")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  test("shows a 'no session yet' empty state before any session exists, and a 'say something' one right after creating one", async () => {
    mockIPC(
      withDefaults((cmd) => {
        if (cmd === "session_list") return [];
        if (cmd === "session_new") return { id: "ral-empty", sessionId: "z" };
        throw new Error(`unexpected command: ${cmd}`);
      }),
    );
    render(<App />);
    await waitFor(() => screen.getByText("No session yet"));

    clickNewChat();
    await waitFor(() => screen.getByText("Say something to get started"));
    expect(screen.queryByText("No session yet")).toBeNull();
  });

  test("collapsing the sidebar hides the session list but keeps every icon button reachable", async () => {
    mockIPC(withDefaults((cmd) => (cmd === "session_list" ? [] : Promise.reject())));
    render(<App />);
    await waitFor(() => screen.getByText("No sessions yet"));

    fireEvent.click(screen.getByTitle("Collapse sidebar"));
    expect(screen.queryByText("No sessions yet")).toBeNull();
    // Unlike the session list, the icon rail itself must not disappear -- a collapsed sidebar
    // that hides its own controls looks broken, not compact.
    expect(screen.getByTitle("New chat")).toBeTruthy();

    fireEvent.click(screen.getByTitle("Expand sidebar"));
    expect(screen.getByText("No sessions yet")).toBeTruthy();
  });

  test("collapsed sidebar shows a status-ringed dot per session instead of the full list", async () => {
    mockIPC(
      withDefaults((cmd) => {
        if (cmd === "session_list") {
          return [
            { id: "ral-run1", agentId: "ralph", state: "running", turns: 1, costUsd: 0 },
            { id: "ral-fail1", agentId: "ralph", state: "failed", turns: 1, costUsd: 0 },
          ];
        }
        throw new Error(`unexpected command: ${cmd}`);
      }),
    );
    render(<App />);
    await waitFor(() => screen.getByText("ral-run1"));

    fireEvent.click(screen.getByTitle("Collapse sidebar"));
    // Both sessions start with "r", so they're distinguished by title (name + state), not text.
    expect(screen.getByTitle("ral-run1 — running")).toBeTruthy();
    expect(screen.getByTitle("ral-fail1 — failed")).toBeTruthy();
    expect(screen.queryByText("ral-run1")).toBeNull();
  });

  // Clicking "Horizontal" itself calling back into App.tsx's state is covered at the unit level
  // by SettingsDialog.test.tsx -- driving the same choice through the real Settings dialog (More
  // menu -> Settings -> Appearance tab) here too is redundant *and* slow (each Base UI
  // menu/dialog/tab transition adds real time), so this sets the persisted preference directly,
  // the same way a real app boot reads it via loadNavigationLayout().
  test("navigationLayout 'horizontal' swaps the sidebar for a tab strip, persists across a remount, and switching tabs switches sessions", async () => {
    localStorage.setItem("jstack.navigationLayout", "horizontal");
    mockIPC(
      withDefaults((cmd) => {
        if (cmd === "session_list") {
          return [
            { id: "ral-aaaa", agentId: "ralph", state: "idle", turns: 1, costUsd: 0 },
            { id: "ral-bbbb", agentId: "ralph", state: "idle", turns: 1, costUsd: 0 },
          ];
        }
        if (cmd === "session_history") return [];
        throw new Error(`unexpected command: ${cmd}`);
      }),
    );
    const { unmount } = render(<App />);

    // The sidebar's session list -- and its collapse toggle, which has nothing left to collapse
    // -- never render; both sessions show up as tabs instead, inside the new tab strip region.
    const tabStrip = await screen.findByLabelText("session tabs");
    expect(screen.queryByLabelText("sessions")).toBeNull();
    expect(screen.queryByTitle("Collapse sidebar")).toBeNull();
    expect(within(tabStrip).getByText("ral-aaaa")).toBeTruthy();
    expect(within(tabStrip).getByText("ral-bbbb")).toBeTruthy();

    fireEvent.click(within(tabStrip).getByText("ral-bbbb"));
    await waitFor(() =>
      expect(within(tabStrip).getByText("ral-bbbb").closest("div")?.className).toContain(
        "bg-accent",
      ),
    );
    // Selecting a tab also focuses it (and scrolls it into view, though jsdom can't verify
    // scroll position) -- same as opening a new tab in a real browser.
    expect(within(tabStrip).getByText("ral-bbbb").closest("button")).toHaveFocus();

    unmount();
    render(<App />);
    await waitFor(() => screen.getByLabelText("session tabs"));
    expect(screen.queryByLabelText("sessions")).toBeNull();
  });

  test("⌘K opens the command palette and selecting a chat switches to it", async () => {
    mockIPC(
      withDefaults((cmd, payload) => {
        if (cmd === "session_list") {
          return [
            { id: "ral-aaaa", agentId: "ralph", state: "idle", turns: 1, costUsd: 0 },
            { id: "ral-bbbb", agentId: "ralph", state: "idle", turns: 1, costUsd: 0 },
          ];
        }
        if (cmd === "session_history") {
          expect(payload).toEqual({ id: "ral-bbbb" });
          return [];
        }
        throw new Error(`unexpected command: ${cmd}`);
      }),
    );
    render(<App />);
    await waitFor(() => screen.getByText("ral-aaaa"));

    expect(screen.queryByPlaceholderText(/Search chats, agents, settings/)).toBeNull();
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    const input = await screen.findByPlaceholderText(/Search chats, agents, settings/);

    fireEvent.change(input, { target: { value: "bbbb" } });
    fireEvent.click(await screen.findByRole("option", { name: "ral-bbbb" }));

    await waitFor(() =>
      expect(screen.getByText("ral-bbbb").closest("div")?.className).toContain("border-primary"),
    );
    // The palette closes itself after running the selected command.
    expect(screen.queryByPlaceholderText(/Search chats, agents, settings/)).toBeNull();
  });

  test("the command palette can also run app-level actions, like opening Settings", async () => {
    mockIPC(withDefaults((cmd) => (cmd === "session_list" ? [] : Promise.reject())));
    render(<App />);
    await waitFor(() => screen.getByText("No sessions yet"));

    fireEvent.click(screen.getByTitle(/Search chats, agents, settings/));
    const input = screen.getByPlaceholderText(/Search chats, agents, settings/);
    fireEvent.change(input, { target: { value: "settings" } });
    fireEvent.click(await screen.findByRole("option", { name: "Settings" }));

    await screen.findByText("Settings");
    fireEvent.click(screen.getByRole("tab", { name: "Appearance" }));
    await screen.findByText("Accent color");
  });

  test("typing '/' in the command palette narrows results to just Actions, Slack/Notion-style", async () => {
    mockIPC(
      withDefaults((cmd) => {
        if (cmd === "session_list") {
          return [{ id: "ral-aaaa", agentId: "ralph", state: "idle", turns: 1, costUsd: 0 }];
        }
        throw new Error(`unexpected command: ${cmd}`);
      }),
    );
    render(<App />);
    await waitFor(() => screen.getByText("ral-aaaa"));

    fireEvent.click(screen.getByTitle(/Search chats, agents, settings/));
    const input = screen.getByPlaceholderText(/Search chats, agents, settings/);

    // Plain text still searches everything, including chats.
    fireEvent.change(input, { target: { value: "aaaa" } });
    await screen.findByRole("option", { name: "ral-aaaa" });

    // A leading "/" switches to commands-only, even though "settings" would otherwise also
    // fuzzy-match nothing chat-related here -- the point is Chats/Agents groups disappear.
    fireEvent.change(input, { target: { value: "/settings" } });
    await screen.findByRole("option", { name: "Settings" });
    expect(screen.queryByRole("option", { name: "ral-aaaa" })).toBeNull();
  });

  test("the command palette can switch the theme mode directly (dark/light/system), not just app navigation", async () => {
    mockIPC(withDefaults((cmd) => (cmd === "session_list" ? [] : Promise.reject())));
    render(<App />);
    await waitFor(() => screen.getByText("No sessions yet"));
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    fireEvent.click(screen.getByTitle(/Search chats, agents, settings/));
    const input = screen.getByPlaceholderText(/Search chats, agents, settings/);
    fireEvent.change(input, { target: { value: "dark mode" } });
    fireEvent.click(await screen.findByRole("option", { name: /Dark mode/ }));

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    document.documentElement.classList.remove("dark"); // don't leak into later tests
  });

  test("Cmd+/ opens Settings straight to the Info tab's keyboard-shortcuts accordion", async () => {
    mockIPC(withDefaults((cmd) => (cmd === "session_list" ? [] : Promise.reject())));
    render(<App />);
    await waitFor(() => screen.getByText("No sessions yet"));

    expect(screen.queryByText("Open search / command palette")).toBeNull();
    fireEvent.keyDown(window, { key: "/", metaKey: true });
    await screen.findByRole("dialog", { name: "Settings" });
    expect(screen.getByRole("tab", { name: "Info", selected: true })).toBeTruthy();
    expect(screen.getByText("Open search / command palette")).toBeTruthy();
  });

  test("existing sessions render in the sidebar on load", async () => {
    mockIPC(
      withDefaults((cmd) => {
        if (cmd === "session_list") {
          return [{ id: "ral-old1", agentId: "ralph", state: "idle", turns: 3, costUsd: 0.01 }];
        }
        throw new Error(`unexpected command: ${cmd}`);
      }),
    );
    render(<App />);
    await waitFor(() => screen.getByText("ral-old1"));
    // No more "idle"/"N turns" text -- a colored status dot instead (green: this session has
    // turns you haven't looked at yet, since it's never been the active session).
    expect(screen.queryByText("idle")).toBeNull();
    expect(screen.queryByText(/\d+ turns?/)).toBeNull();
    expect(screen.getByTitle("idle").className).toContain("bg-green-500");
    // Sessions are grouped under a per-agent heading now, rather than repeating the agent id
    // inline on every session item.
    expect(screen.getByRole("button", { name: /Ralph \(1\)/ })).toBeTruthy();
  });

  test("a brand-new, empty session (0 turns) never shows the green unseen dot", async () => {
    mockIPC(
      withDefaults((cmd) => {
        if (cmd === "session_list") {
          return [{ id: "ral-fresh", agentId: "ralph", state: "idle", turns: 0, costUsd: 0 }];
        }
        throw new Error(`unexpected command: ${cmd}`);
      }),
    );
    render(<App />);
    await waitFor(() => screen.getByText("ral-fresh"));
    expect(screen.getByTitle("idle").className).toContain("bg-gray-300");
    expect(screen.getByTitle("idle").className).not.toContain("bg-green-500");
  });

  test("once a session's turns have been seen, it stays white across a remount -- not just for the current window", async () => {
    mockIPC(
      withDefaults((cmd) => {
        if (cmd === "session_list") {
          return [{ id: "ral-old1", agentId: "ralph", state: "idle", turns: 2, costUsd: 0 }];
        }
        throw new Error(`unexpected command: ${cmd}`);
      }),
    );
    const { unmount } = render(<App />);
    await waitFor(() => screen.getByText("ral-old1"));
    expect(screen.getByTitle("idle").className).toContain("bg-green-500");

    fireEvent.click(screen.getByText("ral-old1"));
    await waitFor(() => expect(screen.getByTitle("idle").className).toContain("bg-gray-300"));
    expect(JSON.parse(localStorage.getItem("jstack.lastSeenTurns")!)).toEqual({ "ral-old1": 2 });

    unmount();
    render(<App />);
    await waitFor(() => screen.getByText("ral-old1"));
    // Same 2 turns, but this is a fresh mount -- stays white because "seen" was persisted, not
    // held only in the unmounted component's state.
    expect(screen.getByTitle("idle").className).toContain("bg-gray-300");
  });

  test("picking an avatar for an agent shows it on both the group header and the collapsed rail", async () => {
    mockIPC(
      withDefaults((cmd) => {
        if (cmd === "session_list") {
          return [{ id: "ral-old1", agentId: "ralph", state: "idle", turns: 1, costUsd: 0 }];
        }
        throw new Error(`unexpected command: ${cmd}`);
      }),
    );
    render(<App />);
    await waitFor(() => screen.getByText("ral-old1"));

    fireEvent.click(screen.getByTitle("Change Ralph's avatar"));
    await screen.findByText("Avatar for Ralph");
    fireEvent.click(screen.getByTitle("🦊"));

    // The dialog closes itself after picking, and the fox shows up wherever Ralph's avatar is
    // rendered -- persisted to localStorage, not just local component state.
    await waitFor(() => expect(screen.queryByText("Avatar for Ralph")).toBeNull());
    expect(screen.getAllByText("🦊").length).toBeGreaterThan(0);
    expect(JSON.parse(localStorage.getItem("jstack.agentAvatars")!)).toEqual({
      ralph: { kind: "emoji", value: "🦊" },
    });
  });

  test("collapsing an agent group persists across a remount, and glows faintly while it hides a failed session", async () => {
    mockIPC(
      withDefaults((cmd) => {
        if (cmd === "session_list") {
          return [{ id: "ral-old1", agentId: "ralph", state: "failed", turns: 1, costUsd: 0 }];
        }
        throw new Error(`unexpected command: ${cmd}`);
      }),
    );
    const { unmount } = render(<App />);
    await waitFor(() => screen.getByText("ral-old1"));

    const groupHeader = screen.getByRole("button", { name: /Ralph \(1\)/ });
    expect(groupHeader.className).not.toContain("shadow-[0_0_10px_1px_rgba(239,68,68");

    fireEvent.click(groupHeader);
    await waitFor(() => expect(screen.queryByText("ral-old1")).toBeNull());
    // Collapsed while it contains a failed session -- the header should glow red.
    expect(screen.getByRole("button", { name: /Ralph \(1\)/ }).className).toContain(
      "shadow-[0_0_10px_1px_rgba(239,68,68",
    );

    unmount();
    render(<App />);
    await waitFor(() => screen.getByRole("button", { name: /Ralph \(1\)/ }));
    // Stayed collapsed across the remount (localStorage-persisted), so the session itself is
    // still hidden.
    expect(screen.queryByText("ral-old1")).toBeNull();
  });

  // Base UI's Collapsible sets `data-open`/`data-closed` (booleans), not Radix's
  // `data-state="open"|"closed"` -- a chevron styled with `group-data-[state=open]:rotate-90`
  // (the Radix convention) silently never matches and never rotates, always looking collapsed
  // regardless of actual state. This asserts against the real attribute Base UI puts on the DOM,
  // so a regression back to the Radix-shaped selector would fail here even though jsdom can't
  // render the resulting CSS transform itself.
  test("the sidebar group header's chevron rotation targets Base UI's real data-open/data-closed attributes, not Radix's data-state", async () => {
    mockIPC(
      withDefaults((cmd) => {
        if (cmd === "session_list") {
          return [{ id: "ral-old1", agentId: "ralph", state: "idle", turns: 0, costUsd: 0 }];
        }
        throw new Error(`unexpected command: ${cmd}`);
      }),
    );
    render(<App />);
    const groupHeader = await screen.findByRole("button", { name: /Ralph \(1\)/ });
    const chevron = groupHeader.querySelector("svg");
    expect(chevron).toBeTruthy();
    expect(chevron!.getAttribute("class")).toContain("group-data-[open]");

    const collapsibleRoot = groupHeader.closest('[data-slot="collapsible"]')!;
    expect(collapsibleRoot).toBeTruthy();
    // Open by default (no stored preference yet).
    expect(collapsibleRoot.hasAttribute("data-open")).toBe(true);
    expect(collapsibleRoot.hasAttribute("data-closed")).toBe(false);

    fireEvent.click(groupHeader);
    await waitFor(() => expect(collapsibleRoot.hasAttribute("data-closed")).toBe(true));
    expect(collapsibleRoot.hasAttribute("data-open")).toBe(false);
  });

  // Note: the "..." menu's Rename/Close items (a Base UI DropdownMenu, same as elsewhere in
  // this file) aren't covered by a jsdom test here -- floating-ui positioning inside Base UI's
  // portal-rendered popups reliably hangs jsdom regardless of how the menu is triggered (click
  // or contextmenu), a limitation hit earlier in this app's test suite too. Verified instead via
  // a real headless-Chromium run against `bun run dev`, the established workaround.

  test("clicking a listed session switches to it, loads its history, and marks it active without a new session_new call", async () => {
    let sessionNewCalls = 0;
    let openPathCalls: unknown[] = [];
    mockIPC(
      withDefaults((cmd, payload) => {
        if (cmd === "plugin:opener|open_path") {
          openPathCalls.push(payload);
          return undefined;
        }
        if (cmd === "session_list") {
          return [{ id: "ral-old1", agentId: "scout", state: "idle", turns: 2, costUsd: 0.02 }];
        }
        if (cmd === "session_history") {
          expect(payload).toEqual({ id: "ral-old1" });
          return [
            { role: "user", text: "earlier question", at: "2026-01-01T00:00:00.000Z" },
            {
              role: "assistant",
              text: "earlier answer",
              costUsd: 0.001,
              toolEvents: [
                {
                  id: "toolu_1",
                  name: "Read",
                  input: { file_path: "/x" },
                  output: "1\thello world\n",
                  isError: false,
                },
              ],
              at: "2026-01-01T00:00:01.000Z",
            },
          ];
        }
        if (cmd === "session_new") {
          sessionNewCalls++;
          return { id: "ral-new1", sessionId: "y" };
        }
        throw new Error(`unexpected command: ${cmd}`);
      }),
    );
    render(<App />);
    await waitFor(() => screen.getByText("ral-old1"));

    fireEvent.click(screen.getByText("ral-old1"));

    await waitFor(() =>
      expect(screen.getByText("ral-old1").closest("div")?.className).toContain("border-primary"),
    );
    expect(sessionNewCalls).toBe(0);

    await waitFor(() => screen.getByText(/earlier question/));
    expect(screen.getByText(/earlier answer/)).toBeTruthy();
    expect(screen.getByText("Read")).toBeTruthy();
    // The tool's real output must render, not just its name/input -- this is the fix for
    // "the grep command isn't showing really anything." Tool calls render collapsed by
    // default (/impeccable critique), so expand it first via its header.
    expect(screen.getByText("Completed")).toBeTruthy();
    fireEvent.click(screen.getByText("Read"));
    expect(await screen.findByText(/hello world/)).toBeTruthy();

    // The Read tool's file_path shows up as a clickable "open file" affordance in the tool
    // header, wired to the OS opener plugin -- not just inert text inside the JSON input blob.
    fireEvent.click(screen.getByTitle("Open /x"));
    await waitFor(() => expect(openPathCalls).toEqual([{ path: "/x", with: undefined }]));
  });

  // Closing a session from the chat window itself was removed (the button lived right next to
  // the agent name/session id header, both dropped for a cleaner chat view) -- this now drives
  // the same handleCloseSessionById through the horizontal tab strip's close (x) button instead
  // of the sidebar's "..." menu, since that menu is a Base UI dropdown that hangs in jsdom (see
  // this file's other notes on that limitation) and the tab strip's close button is a plain,
  // directly-clickable one.
  test("closing a session (via a tab's close button) reports what the self-retro learned and clears the active session", async () => {
    localStorage.setItem("jstack.navigationLayout", "horizontal");
    let created = false;
    let cancelled = false;
    mockIPC(
      withDefaults((cmd, payload) => {
        if (cmd === "session_list") {
          return created && !cancelled
            ? [{ id: "ral-close", agentId: "ralph", state: "idle", turns: 0, costUsd: 0 }]
            : [];
        }
        if (cmd === "session_new") {
          created = true;
          return { id: "ral-close", sessionId: "z" };
        }
        if (cmd === "session_history") return [];
        if (cmd === "session_cancel") {
          expect(payload).toEqual({ id: "ral-close" });
          cancelled = true;
          return {
            ok: true,
            retro: {
              ran: true,
              costUsd: 0.002,
              saved: [{ id: "m1", agentId: "ralph", kind: "preference", content: "Prefers terse replies." }],
            },
          };
        }
        throw new Error(`unexpected command: ${cmd}`);
      }),
    );

    render(<App />);
    await waitFor(() => screen.getByTitle("New chat"));
    clickNewChat();
    await waitFor(() => screen.getByText("ral-close"));

    fireEvent.click(screen.getByTitle("Close"));
    fireEvent.click(await screen.findByRole("button", { name: "Close session" }));

    await waitFor(() => screen.getByText(/Session closed\. Learned:/));
    expect(screen.getByText(/Prefers terse replies\./)).toBeTruthy();
    expect(screen.queryByText("ral-close")).toBeNull();
  });

  test("a cancelled session from session_list never appears in the sidebar -- the daemon's ledger keeps closed sessions around for history, but the desktop client's session switcher should only ever show open chats", async () => {
    mockIPC(
      withDefaults((cmd) => {
        if (cmd === "session_list") {
          return [
            { id: "ral-open1", agentId: "ralph", state: "idle", turns: 2, costUsd: 0 },
            { id: "ral-closed1", agentId: "ralph", state: "cancelled", turns: 3, costUsd: 0 },
          ];
        }
        throw new Error(`unexpected command: ${cmd}`);
      }),
    );

    render(<App />);
    await waitFor(() => screen.getByText("ral-open1"));
    expect(screen.queryByText("ral-closed1")).toBeNull();
  });

  test("no agents configured shows the onboarding wizard instead of the chat layout", async () => {
    mockIPC((cmd) => {
      if (cmd === "agent_list") return [];
      if (cmd === "set_tray_status" || cmd === "update_tray_menu") return null;
      throw new Error(`unexpected command: ${cmd}`);
    });
    render(<App />);
    await waitFor(() => screen.getByText("Create your first agent"));
    expect(screen.queryByTitle("New chat")).toBeNull();
  });

  test("submitting the onboarding form creates the agent and drops into the normal chat view", async () => {
    mockIPC((cmd, payload) => {
      if (cmd === "agent_list") return [];
      if (cmd === "agent_create") {
        expect(payload).toMatchObject({ id: "scout", name: "Scout" });
        return {
          id: "scout",
          agent: {
            name: "Scout",
            enabled: true,
            model: "claude-sonnet-5",
            persona: "",
            tools: ["Read", "Grep", "Glob"],
            mcp: "none",
            proactiveChecks: [],
          },
        };
      }
      if (cmd === "session_list") return [];
      if (cmd === "daemon_status") {
        return {
          tasks: 0,
          outbox: 0,
          spentToday: 0,
          watermarks: 0,
          enabled: true,
          mode: "dry_run",
          resident: true,
          uptimeMs: 0,
          perAgent: [],
        };
      }
      if (cmd === "set_tray_status" || cmd === "update_tray_menu") return null;
      throw new Error(`unexpected command: ${cmd}`);
    });
    render(<App />);
    await waitFor(() => screen.getByText("Create your first agent"));

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Scout" } });
    // The form pre-selects a random emoji on its own (see pickRandomUnusedEmoji) -- picking a
    // specific one here just makes the assertion below deterministic, not testing that picking
    // works per se (that's covered by avatars.test.ts's uniqueness tests).
    fireEvent.click(screen.getByTitle("🦉"));
    fireEvent.click(screen.getByText("Create agent"));

    await waitFor(() => screen.getByTitle("New chat"));
    expect(screen.getByTitle(/Switch agent \(currently Scout\)/)).toBeTruthy();
    // Persisted immediately on creation, not just held in the form's own local state -- the
    // sidebar shows it right away without a separate "now go set an avatar" step.
    expect(JSON.parse(localStorage.getItem("jstack.agentAvatars")!)).toMatchObject({
      scout: { kind: "emoji", value: "🦉" },
    });
  });

  // Settings dialog behavior (status, debug log polling) is covered directly in
  // SettingsDialog.test.tsx, rendering it standalone with `open` already true -- reaching it
  // through the app now means opening the header's "more" menu first, a Base UI Menu, which
  // (like the session "..." menu and the old right-click one) reliably hangs jsdom regardless
  // of trigger. The command palette route to Settings above IS covered here since cmdk/Dialog
  // don't have that problem.
});

import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import App from "./App";

/**
 * Exercises the React chat view against a mocked Tauri IPC layer (the same technique Tauri
 * documents for testing frontend code with no real backend/webview) -- this is the closest
 * automated coverage available without a way to drive the real desktop app's window, which
 * would need GUI automation tooling this environment doesn't have.
 */
afterEach(() => {
  cleanup();
  clearMocks();
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
      return { tasks: 0, outbox: 0, spentToday: 0, watermarks: 0, enabled: true, mode: "dry_run" };
    }
    return handler(cmd, payload);
  };
}

function clickNewChat(): void {
  fireEvent.click(screen.getByTitle("New chat"));
}

async function openSettings(): Promise<void> {
  fireEvent.click(screen.getByTitle("Settings"));
  await screen.findByText("Status");
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
          expect(payload).toEqual({ id: "ral-abcd", message: "hello there" });
          return { ok: true, text: "hi! how can I help?", costUsd: 0.0042, toolEvents: [] };
        }
        throw new Error(`unexpected command: ${cmd}`);
      }),
    );

    render(<App />);
    await waitFor(() => screen.getByTitle("New chat"));
    clickNewChat();
    await waitFor(() => screen.getByText(/session ral-abcd/));

    fireEvent.change(screen.getByLabelText("message"), {
      target: { value: "hello there" },
    });
    fireEvent.click(screen.getByText("Send"));

    await waitFor(() => screen.getByText(/hi! how can I help\?/));
    expect(
      screen.getByText(/hello there/).closest('[data-role="user"]'),
    ).toBeTruthy();
    expect(screen.getByText(/\$0\.0042/)).toBeTruthy();
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
    await waitFor(() => screen.getByText(/session ral-fail/));

    fireEvent.change(screen.getByLabelText("message"), {
      target: { value: "anything" },
    });
    fireEvent.click(screen.getByText("Send"));

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
    expect(screen.getByText("Send")).toBeDisabled();
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

  test("creating a folder shows it with a count and lists both sessions as Unfiled", async () => {
    mockIPC(
      withDefaults((cmd) => {
        if (cmd === "session_list") {
          return [
            { id: "ral-aaaa", agentId: "ralph", state: "idle", turns: 1, costUsd: 0 },
            { id: "ral-bbbb", agentId: "ralph", state: "idle", turns: 1, costUsd: 0 },
          ];
        }
        throw new Error(`unexpected command: ${cmd}`);
      }),
    );
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("Work");
    render(<App />);
    await waitFor(() => screen.getByText("ral-aaaa"));

    fireEvent.click(screen.getByTitle("New folder"));
    expect(promptSpy).toHaveBeenCalled();
    await waitFor(() => screen.getByText(/Work \(0\)/));

    // Neither session has been assigned yet, so both still list under Unfiled, each with its
    // own folder-assignment control now that a folder exists to move them into.
    expect(screen.getByText("ral-aaaa")).toBeTruthy();
    expect(screen.getByText("ral-bbbb")).toBeTruthy();
    expect(screen.getAllByRole("combobox")).toHaveLength(2);

    promptSpy.mockRestore();
  });

  test("declining the folder-name prompt creates no folder", async () => {
    mockIPC(withDefaults((cmd) => (cmd === "session_list" ? [] : Promise.reject())));
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue(null);
    render(<App />);
    await waitFor(() => screen.getByText("No sessions yet"));

    fireEvent.click(screen.getByTitle("New folder"));
    expect(promptSpy).toHaveBeenCalled();
    expect(screen.queryByRole("combobox")).toBeNull();

    promptSpy.mockRestore();
  });

  test("collapsing the sidebar hides the session list and folder controls", async () => {
    mockIPC(withDefaults((cmd) => (cmd === "session_list" ? [] : Promise.reject())));
    render(<App />);
    await waitFor(() => screen.getByText("No sessions yet"));

    fireEvent.click(screen.getByTitle("Collapse sidebar"));
    expect(screen.queryByText("No sessions yet")).toBeNull();
    expect(screen.queryByTitle("Settings")).toBeNull();

    fireEvent.click(screen.getByTitle("Expand sidebar"));
    expect(screen.getByText("No sessions yet")).toBeTruthy();
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
    expect(screen.getByText("idle")).toBeTruthy();
    expect(screen.getByText(/ralph/)).toBeTruthy();
    expect(screen.getByText(/3 turns/)).toBeTruthy();
  });

  test("clicking a listed session switches to it, loads its history, and marks it active without a new session_new call", async () => {
    let sessionNewCalls = 0;
    mockIPC(
      withDefaults((cmd, payload) => {
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

    await waitFor(() => screen.getByText(/session ral-old1/));
    expect(sessionNewCalls).toBe(0);
    expect(screen.getByText("ral-old1").closest("button")?.className).toContain(
      "border-primary",
    );

    await waitFor(() => screen.getByText(/earlier question/));
    expect(screen.getByText(/earlier answer/)).toBeTruthy();
    expect(screen.getByText("Read")).toBeTruthy();
    // The tool's real output must render, not just its name/input -- this is the fix for
    // "the grep command isn't showing really anything."
    expect(screen.getByText("Completed")).toBeTruthy();
    expect(await screen.findByText(/hello world/)).toBeTruthy();
  });

  test("closing a session reports what the self-retro learned and clears the active session", async () => {
    mockIPC(
      withDefaults((cmd, payload) => {
        if (cmd === "session_list") return [];
        if (cmd === "session_new") return { id: "ral-close", sessionId: "z" };
        if (cmd === "session_cancel") {
          expect(payload).toEqual({ id: "ral-close" });
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
    await waitFor(() => screen.getByText(/session ral-close/));

    fireEvent.click(screen.getByText("Close session"));

    await waitFor(() => screen.getByText(/Session closed\. Learned:/));
    expect(screen.getByText(/Prefers terse replies\./)).toBeTruthy();
    expect(screen.queryByText(/session ral-close/)).toBeNull();
  });

  test("the header shows the active agent's name instead of a hardcoded 'jstack'", async () => {
    mockIPC(withDefaults((cmd) => (cmd === "session_list" ? [] : Promise.reject())));
    render(<App />);
    await waitFor(() => screen.getByRole("heading", { name: "Ralph" }));
  });

  test("no agents configured shows the onboarding wizard instead of the chat layout", async () => {
    mockIPC((cmd) => {
      if (cmd === "agent_list") return [];
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
          },
        };
      }
      if (cmd === "session_list") return [];
      if (cmd === "daemon_status") {
        return { tasks: 0, outbox: 0, spentToday: 0, watermarks: 0, enabled: true, mode: "dry_run" };
      }
      throw new Error(`unexpected command: ${cmd}`);
    });
    render(<App />);
    await waitFor(() => screen.getByText("Create your first agent"));

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Scout" } });
    fireEvent.click(screen.getByText("Create agent"));

    await waitFor(() => screen.getByTitle("New chat"));
    expect(screen.getByRole("heading", { name: "Scout" })).toBeTruthy();
  });

  test("settings dialog: status and debug logs are behind the gear icon, not always visible", async () => {
    let recentLogsCalls = 0;
    mockIPC(
      withDefaults((cmd) => {
        if (cmd === "session_list") return [];
        if (cmd === "recent_logs") {
          recentLogsCalls++;
          return { lines: ["line one", "line two"] };
        }
        throw new Error(`unexpected command: ${cmd}`);
      }),
    );
    render(<App />);
    await waitFor(() => screen.getByText("No sessions yet"));
    expect(screen.queryByText("Status")).toBeNull();
    expect(recentLogsCalls).toBe(0);

    await openSettings();
    expect(screen.getByText(/enabled: true/)).toBeTruthy();

    fireEvent.click(screen.getByText("Show debug logs"));
    await waitFor(() => screen.getByText("line one"));
    expect(screen.getByText("line two")).toBeTruthy();
    expect(recentLogsCalls).toBeGreaterThanOrEqual(1);
  });

  test("debug logs stop polling once hidden again", async () => {
    vi.useFakeTimers();
    try {
      let recentLogsCalls = 0;
      mockIPC(
        withDefaults((cmd) => {
          if (cmd === "session_list") return [];
          if (cmd === "recent_logs") {
            recentLogsCalls++;
            return { lines: [`call ${recentLogsCalls}`] };
          }
          throw new Error(`unexpected command: ${cmd}`);
        }),
      );
      render(<App />);
      await vi.waitFor(() => screen.getByTitle("Settings"));
      fireEvent.click(screen.getByTitle("Settings"));
      await vi.waitFor(() => screen.getByText("Show debug logs"));

      fireEvent.click(screen.getByText("Show debug logs"));
      await vi.waitFor(() => expect(recentLogsCalls).toBe(1));

      await vi.advanceTimersByTimeAsync(3000);
      expect(recentLogsCalls).toBe(2);

      fireEvent.click(screen.getByText("Hide debug logs"));
      const callsWhenHidden = recentLogsCalls;
      await vi.advanceTimersByTimeAsync(10000);
      expect(recentLogsCalls).toBe(callsWhenHidden);
    } finally {
      vi.useRealTimers();
    }
  });
});

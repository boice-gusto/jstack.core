import { afterEach, describe, expect, test } from "vitest";
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
});

/**
 * App calls daemon_status on mount (the sidebar's status panel) on top of whatever the test is
 * actually exercising. Only daemon_status gets a blanket default here -- session_list is what
 * several of these tests exercise directly, so each test's own handler answers it explicitly
 * rather than risking a shared default silently shadowing a per-test override.
 */
function withStatusDefault(
  handler: (cmd: string, payload?: unknown) => unknown,
): (cmd: string, payload?: unknown) => unknown {
  return (cmd, payload) => {
    if (cmd === "daemon_status") {
      return { tasks: 0, outbox: 0, spentToday: 0, watermarks: 0, enabled: true, mode: "dry_run" };
    }
    return handler(cmd, payload);
  };
}

describe("App", () => {
  test("creating a session, sending a message, and seeing a real reply", async () => {
    mockIPC(
      withStatusDefault((cmd, payload) => {
        if (cmd === "session_list") return [];
        if (cmd === "session_new") {
          expect(payload).toEqual({ agentId: "ralph" });
          return { id: "ral-abcd", sessionId: "11111111-1111-1111-1111-111111111111" };
        }
        if (cmd === "session_prompt") {
          expect(payload).toEqual({ id: "ral-abcd", message: "hello there" });
          return { ok: true, text: "hi! how can I help?", costUsd: 0.0042 };
        }
        throw new Error(`unexpected command: ${cmd}`);
      }),
    );

    render(<App />);

    fireEvent.click(screen.getByText("New session"));
    await waitFor(() => screen.getByText(/session ral-abcd/));

    fireEvent.change(screen.getByLabelText("message"), {
      target: { value: "hello there" },
    });
    fireEvent.click(screen.getByText("Send"));

    await waitFor(() => screen.getByText(/hi! how can I help\?/));
    expect(screen.getByText(/hello there/).className).toContain("message-user");
    expect(screen.getByText(/\$0\.0042/)).toBeTruthy();
  });

  test("a session_prompt error result is shown as an error message, not silently dropped", async () => {
    mockIPC(
      withStatusDefault((cmd) => {
        if (cmd === "session_list") return [];
        if (cmd === "session_new") return { id: "ral-fail", sessionId: "x" };
        if (cmd === "session_prompt") {
          return { ok: false, text: "daily budget cap ($20) reached", costUsd: 0 };
        }
        throw new Error(`unexpected command: ${cmd}`);
      }),
    );

    render(<App />);
    fireEvent.click(screen.getByText("New session"));
    await waitFor(() => screen.getByText(/session ral-fail/));

    fireEvent.change(screen.getByLabelText("message"), {
      target: { value: "anything" },
    });
    fireEvent.click(screen.getByText("Send"));

    await waitFor(() => screen.getByText(/daily budget cap/));
  });

  test("a transport failure (daemon not running) surfaces as a session error, not a crash", async () => {
    mockIPC(
      withStatusDefault((cmd) => {
        if (cmd === "session_list") return [];
        if (cmd === "session_new") {
          throw new Error("could not connect to /Users/x/.jstack/crew/agent.sock: No such file");
        }
        throw new Error(`unexpected command: ${cmd}`);
      }),
    );

    render(<App />);
    fireEvent.click(screen.getByText("New session"));

    await waitFor(() => screen.getByText(/could not connect/));
  });

  test("Send is disabled until a session exists", () => {
    mockIPC(
      withStatusDefault((cmd) => {
        if (cmd === "session_list") return [];
        throw new Error(`no session command should fire before New session is clicked: ${cmd}`);
      }),
    );
    render(<App />);
    expect(screen.getByLabelText("message")).toBeDisabled();
    expect(screen.getByText("Send")).toBeDisabled();
  });

  test("existing sessions render in the sidebar on load", async () => {
    mockIPC(
      withStatusDefault((cmd) => {
        if (cmd === "session_list") {
          return [{ id: "ral-old1", agentId: "ralph", state: "idle", turns: 3, costUsd: 0.01 }];
        }
        throw new Error(`unexpected command: ${cmd}`);
      }),
    );
    render(<App />);
    await waitFor(() => screen.getByText("ral-old1"));
    expect(screen.getByText(/ralph · idle · 3 turns/)).toBeTruthy();
  });

  test("clicking a listed session switches to it and marks it active, without a new session_new call", async () => {
    let sessionNewCalls = 0;
    mockIPC(
      withStatusDefault((cmd) => {
        if (cmd === "session_list") {
          return [{ id: "ral-old1", agentId: "scout", state: "idle", turns: 2, costUsd: 0.02 }];
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
    expect(screen.getByDisplayValue("scout")).toBeTruthy();
    expect(sessionNewCalls).toBe(0);
    expect(screen.getByText("ral-old1").closest("button")?.className).toContain("active");
  });
});

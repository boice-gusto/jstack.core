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

describe("App", () => {
  test("creating a session, sending a message, and seeing a real reply", async () => {
    mockIPC((cmd, payload) => {
      if (cmd === "session_new") {
        expect(payload).toEqual({ agentId: "ralph" });
        return { id: "ral-abcd", sessionId: "11111111-1111-1111-1111-111111111111" };
      }
      if (cmd === "session_prompt") {
        expect(payload).toEqual({ id: "ral-abcd", message: "hello there" });
        return { ok: true, text: "hi! how can I help?", costUsd: 0.0042 };
      }
      throw new Error(`unexpected command: ${cmd}`);
    });

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
    mockIPC((cmd) => {
      if (cmd === "session_new") return { id: "ral-fail", sessionId: "x" };
      if (cmd === "session_prompt") {
        return { ok: false, text: "daily budget cap ($20) reached", costUsd: 0 };
      }
      throw new Error(`unexpected command: ${cmd}`);
    });

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
    mockIPC((cmd) => {
      if (cmd === "session_new") {
        throw new Error("could not connect to /Users/x/.jstack/crew/agent.sock: No such file");
      }
      throw new Error(`unexpected command: ${cmd}`);
    });

    render(<App />);
    fireEvent.click(screen.getByText("New session"));

    await waitFor(() => screen.getByText(/could not connect/));
  });

  test("Send is disabled until a session exists", () => {
    mockIPC(() => {
      throw new Error("no command should be invoked before New session is clicked");
    });
    render(<App />);
    expect(screen.getByLabelText("message")).toBeDisabled();
    expect(screen.getByText("Send")).toBeDisabled();
  });
});

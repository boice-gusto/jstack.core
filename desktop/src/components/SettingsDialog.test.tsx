import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { SettingsDialog, type SettingsTab } from "./SettingsDialog";

/**
 * Rendered standalone with `open` already true, bypassing whatever triggers it in the real app
 * (the header's "more" menu, or the command palette) -- both are Base UI Menu/cmdk-driven and
 * not the concern of this component. This also sidesteps the Menu-in-jsdom hang that would come
 * from going through App.tsx's own render (see App.test.tsx's note on the same limitation).
 */
afterEach(() => {
  cleanup();
  clearMocks();
});

function withDefaults(
  handler: (cmd: string, payload?: unknown) => unknown,
): (cmd: string, payload?: unknown) => unknown {
  return (cmd, payload) => {
    if (cmd === "daemon_status") {
      return { tasks: 0, outbox: 0, spentToday: 0, watermarks: 0, enabled: true, mode: "dry_run" };
    }
    return handler(cmd, payload);
  };
}

/** `activeTab` is controlled from App.tsx in the real app -- this stands in for that, defaulting
 * to whatever tab a test needs to start on. */
function Wrapper(props: Omit<Parameters<typeof SettingsDialog>[0], "activeTab" | "onActiveTabChange"> & {
  initialTab?: SettingsTab;
}) {
  const { initialTab = "general", ...rest } = props;
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  return <SettingsDialog {...rest} activeTab={tab} onActiveTabChange={setTab} />;
}

describe("SettingsDialog", () => {
  test("the Debug tab shows a nicely formatted, auto-polling log tail -- only while it's the active tab", async () => {
    let recentLogsCalls = 0;
    mockIPC(
      withDefaults((cmd) => {
        if (cmd === "recent_logs") {
          recentLogsCalls++;
          return { lines: ["line one", "line two"] };
        }
        throw new Error(`unexpected command: ${cmd}`);
      }),
    );
    render(
      <Wrapper
        open
        onOpenChange={() => {}}
        onRefresh={() => {}}
        navigationLayout="vertical"
        onNavigationLayoutChange={() => {}}
      />,
    );
    expect(screen.queryByText("line one")).toBeNull();
    expect(recentLogsCalls).toBe(0);

    fireEvent.click(screen.getByRole("tab", { name: "Debug" }));
    await waitFor(() => screen.getByText("line one"));
    expect(screen.getByText("line two")).toBeTruthy();
    expect(recentLogsCalls).toBeGreaterThanOrEqual(1);
  });

  test("Debug tab polling stops once you leave the tab", async () => {
    vi.useFakeTimers();
    try {
      let recentLogsCalls = 0;
      mockIPC(
        withDefaults((cmd) => {
          if (cmd === "recent_logs") {
            recentLogsCalls++;
            return { lines: [`call ${recentLogsCalls}`] };
          }
          throw new Error(`unexpected command: ${cmd}`);
        }),
      );
      render(
        <Wrapper
          open
          onOpenChange={() => {}}
          onRefresh={() => {}}
          navigationLayout="vertical"
          onNavigationLayoutChange={() => {}}
        />,
      );
      fireEvent.click(screen.getByRole("tab", { name: "Debug" }));
      await vi.waitFor(() => expect(recentLogsCalls).toBe(1));

      await vi.advanceTimersByTimeAsync(3000);
      expect(recentLogsCalls).toBe(2);

      fireEvent.click(screen.getByRole("tab", { name: "General" }));
      const callsWhenLeft = recentLogsCalls;
      await vi.advanceTimersByTimeAsync(10000);
      expect(recentLogsCalls).toBe(callsWhenLeft);
    } finally {
      vi.useRealTimers();
    }
  });

  // The ModelSelector is cmdk/Dialog-backed, same as the command palette -- both work fine in
  // jsdom once wrapped in a real `<Command>` root (see App.test.tsx's command-palette tests and
  // the bug that fix caught), so this is a real interaction test, not just a render check.
  test("the model picker shows the active agent's model and can change it via agent/update", async () => {
    mockIPC(
      withDefaults((cmd, payload) => {
        if (cmd === "agent_update") {
          expect(payload).toEqual({ id: "ralph", model: "claude-opus-5" });
          return {
            id: "ralph",
            agent: {
              name: "Ralph",
              enabled: true,
              model: "claude-opus-5",
              persona: "",
              tools: ["Read"],
              mcp: "none",
            },
          };
        }
        throw new Error(`unexpected command: ${cmd}`);
      }),
    );
    const onAgentUpdated = vi.fn();
    render(
      <Wrapper
        open
        onOpenChange={() => {}}
        onRefresh={() => {}}
        navigationLayout="vertical"
        onNavigationLayoutChange={() => {}}
        agents={[
          {
            id: "ralph",
            name: "Ralph",
            enabled: true,
            model: "claude-sonnet-5",
            persona: "",
            tools: ["Read"],
            mcp: "none",
          },
        ]}
        agentId="ralph"
        onAgentUpdated={onAgentUpdated}
      />,
    );
    await screen.findByText("Model (Ralph)");
    expect(screen.getByText("claude-sonnet-5")).toBeTruthy();

    fireEvent.click(screen.getByText("claude-sonnet-5"));
    fireEvent.click(await screen.findByRole("option", { name: /claude-opus-5/ }));

    await waitFor(() => expect(onAgentUpdated).toHaveBeenCalled());
    expect(onAgentUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ id: "ralph", model: "claude-opus-5" }),
    );
    // The picker closes itself after a selection.
    expect(screen.queryByPlaceholderText("Search models...")).toBeNull();
  });

  test("toggling a tool checkbox calls agent/update with the new tool list, and MCP inherit toggles mcp", async () => {
    const updateCalls: unknown[] = [];
    mockIPC(
      withDefaults((cmd, payload) => {
        if (cmd === "agent_update") {
          updateCalls.push(payload);
          return {
            id: "ralph",
            agent: {
              name: "Ralph",
              enabled: true,
              model: "claude-sonnet-5",
              persona: "",
              tools: ["Read", "Write"],
              mcp: "inherit",
            },
          };
        }
        throw new Error(`unexpected command: ${cmd}`);
      }),
    );
    render(
      <Wrapper
        open
        onOpenChange={() => {}}
        onRefresh={() => {}}
        navigationLayout="vertical"
        onNavigationLayoutChange={() => {}}
        agents={[
          {
            id: "ralph",
            name: "Ralph",
            enabled: true,
            model: "claude-sonnet-5",
            persona: "",
            tools: ["Read"],
            mcp: "none",
          },
        ]}
        agentId="ralph"
        onAgentUpdated={() => {}}
      />,
    );
    await screen.findByText("Access (Ralph)");

    fireEvent.click(screen.getByText("Write"));
    await waitFor(() =>
      expect(updateCalls).toContainEqual({ id: "ralph", tools: ["Read", "Write"] }),
    );

    fireEvent.click(screen.getByText("Inherit MCP servers"));
    await waitFor(() =>
      expect(updateCalls).toContainEqual({ id: "ralph", mcp: "inherit" }),
    );
  });

  test("the Advanced tab shows Status and an always-expanded Agents & skills panel (fetched as soon as the dialog opens, no toggle button)", async () => {
    let skillsCalls = 0;
    mockIPC(
      withDefaults((cmd) => {
        if (cmd === "skills_index") {
          skillsCalls++;
          return {
            skills: [
              { path: "/x", rel: "skills/foo/SKILL.md", name: "jstack-foo", description: "does foo", origin: "core" },
            ],
          };
        }
        throw new Error(`unexpected command: ${cmd}`);
      }),
    );
    render(
      <Wrapper
        open
        onOpenChange={() => {}}
        onRefresh={() => {}}
        navigationLayout="vertical"
        onNavigationLayoutChange={() => {}}
        agents={[
          { id: "ralph", name: "Ralph", enabled: true, model: "claude-sonnet-5", persona: "", tools: [], mcp: "none" },
        ]}
      />,
    );
    // Fetched immediately on open, before Advanced is even the visible tab.
    await waitFor(() => expect(skillsCalls).toBe(1));

    fireEvent.click(screen.getByRole("tab", { name: "Advanced" }));
    await screen.findByText("jstack-foo");
    expect(screen.getByText("Ralph")).toBeTruthy();
    await screen.findByText(/enabled/i);
  });

  test("the Agents tab lists every agent (including disabled ones) and can toggle enabled via agent/update", async () => {
    const updateCalls: unknown[] = [];
    mockIPC(
      withDefaults((cmd, payload) => {
        if (cmd === "agent_update") {
          updateCalls.push(payload);
          return {
            id: "beta",
            agent: {
              name: "Beta",
              enabled: true,
              model: "claude-sonnet-5",
              persona: "",
              tools: [],
              mcp: "none",
            },
          };
        }
        throw new Error(`unexpected command: ${cmd}`);
      }),
    );
    render(
      <Wrapper
        open
        onOpenChange={() => {}}
        onRefresh={() => {}}
        navigationLayout="vertical"
        onNavigationLayoutChange={() => {}}
        agents={[
          { id: "ralph", name: "Ralph", enabled: true, model: "claude-sonnet-5", persona: "", tools: [], mcp: "none" },
          { id: "beta", name: "Beta", enabled: false, model: "claude-sonnet-5", persona: "", tools: [], mcp: "none" },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Agents" }));
    await screen.findByText("Ralph");
    expect(screen.getByText("Beta")).toBeTruthy();
    expect(screen.getByText("(disabled)")).toBeTruthy();

    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(2);
    fireEvent.click(switches[1]!); // Beta's, the disabled one
    await waitFor(() =>
      expect(updateCalls).toContainEqual({ id: "beta", enabled: true }),
    );
  });

  test("the Appearance tab holds theme/accent plus the vertical/horizontal chat navigation picker, which calls back with the chosen layout", async () => {
    mockIPC(withDefaults(() => ({})));
    const onNavigationLayoutChange = vi.fn();
    render(
      <Wrapper
        open
        onOpenChange={() => {}}
        onRefresh={() => {}}
        navigationLayout="vertical"
        onNavigationLayoutChange={onNavigationLayoutChange}
      />,
    );

    // General tab's content is what's active by default -- Theme/Accent/Chat navigation only
    // show up once Appearance is selected.
    expect(screen.queryByText("Chat navigation")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Appearance" }));

    await screen.findByText("Chat navigation");
    expect(screen.getByText("Theme")).toBeTruthy();
    expect(screen.getByText("Accent color")).toBeTruthy();

    fireEvent.click(screen.getByText("Horizontal"));
    expect(onNavigationLayoutChange).toHaveBeenCalledWith("horizontal");
  });

  test("the Info tab's keyboard-shortcuts accordion is open by default, since it's the only section today", async () => {
    mockIPC(withDefaults(() => ({})));
    render(
      <Wrapper
        open
        onOpenChange={() => {}}
        onRefresh={() => {}}
        navigationLayout="vertical"
        onNavigationLayoutChange={() => {}}
        initialTab="info"
      />,
    );

    await screen.findByText("Keyboard shortcuts");
    expect(screen.getByText("Open search / command palette")).toBeTruthy();
    expect(screen.getByText("Send message")).toBeTruthy();
  });
});

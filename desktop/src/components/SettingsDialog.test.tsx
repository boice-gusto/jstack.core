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
            proactiveChecks: [],
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
            proactiveChecks: [],
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
          {
            id: "ralph",
            name: "Ralph",
            enabled: true,
            model: "claude-sonnet-5",
            persona: "",
            tools: [],
            mcp: "none",
            proactiveChecks: [],
          },
        ]}
      />,
    );
    // Fetched immediately on open, before Advanced is even the visible tab.
    await waitFor(() => expect(skillsCalls).toBe(1));

    fireEvent.click(screen.getByRole("tab", { name: "Advanced" }));
    await screen.findByText("jstack-foo");
    expect(screen.getByText("Ralph")).toBeTruthy();
  });

  test("the Schedule tab shows daemon resident/uptime status and per-agent activity", async () => {
    // Deliberately not withDefaults here -- its blanket daemon_status stub would shadow the
    // uptime/perAgent values this test needs to assert on.
    mockIPC((cmd) => {
      if (cmd === "daemon_status") {
        return {
          tasks: 3,
          outbox: 0,
          spentToday: 0.05,
          watermarks: 0,
          enabled: true,
          mode: "dry_run",
          resident: true,
          uptimeMs: 65_000,
          perAgent: [{ agentId: "ralph", tasks: 2, turns: 4, costUsd: 0.02 }],
        };
      }
      if (cmd === "schedule_list") return { schedules: [] };
      if (cmd === "skills_index") return { skills: [] };
      throw new Error(`unexpected command: ${cmd}`);
    });
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
            tools: [],
            mcp: "none",
            proactiveChecks: [],
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Schedule" }));
    await screen.findByText("Yes"); // Resident: Yes
    expect(screen.getByText("1m 5s")).toBeTruthy(); // formatUptime(65_000)
    expect(screen.getByText(/2 sessions · 4 turns · \$0\.0200/)).toBeTruthy();
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
          {
            id: "ralph",
            name: "Ralph",
            enabled: true,
            model: "claude-sonnet-5",
            persona: "",
            tools: [],
            mcp: "none",
            proactiveChecks: [],
          },
          {
            id: "beta",
            name: "Beta",
            enabled: false,
            model: "claude-sonnet-5",
            persona: "",
            tools: [],
            mcp: "none",
            proactiveChecks: [],
          },
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

  test("the Diagnostics tab fetches and renders checks once, and Re-run fetches again", async () => {
    let diagnosticsCalls = 0;
    mockIPC(
      withDefaults((cmd) => {
        if (cmd === "skills_index") return { skills: [] };
        if (cmd === "run_diagnostics") {
          diagnosticsCalls++;
          return {
            claudeCli: { found: true, path: "/opt/homebrew/bin/claude", version: "2.1.0" },
            projectRoot: { path: "/Users/x/jstack.core", hasConfig: true },
            pluginRoot: { path: "/Users/x/jstack.core", hasSkillsDir: true },
            skills: { count: 42 },
            agents: [
              {
                id: "ralph",
                enabled: true,
                model: "claude-sonnet-5",
                workspace: "/tmp/ws",
                workspaceExists: false,
                mcp: "none",
              },
            ],
            mcp: { anyAgentInherits: false },
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
        initialTab="diagnostics"
      />,
    );

    await screen.findByText("2.1.0");
    expect(screen.getByText("42 skills loaded")).toBeTruthy();
    expect(screen.getByText("ralph")).toBeTruthy();
    expect(screen.getByText("Workspace directory does not exist.")).toBeTruthy();
    expect(diagnosticsCalls).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "Re-run" }));
    await waitFor(() => expect(diagnosticsCalls).toBe(2));
  });

  test("the Diagnostics tab shows an error state when claude isn't found, without crashing", async () => {
    mockIPC(
      withDefaults((cmd) => {
        if (cmd === "skills_index") return { skills: [] };
        if (cmd === "run_diagnostics") {
          return {
            claudeCli: { found: false },
            projectRoot: { path: "/Users/x/jstack.core", hasConfig: true },
            pluginRoot: { path: "/Users/x/jstack.core", hasSkillsDir: true },
            skills: { count: 0 },
            agents: [],
            mcp: { anyAgentInherits: false },
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
        initialTab="diagnostics"
      />,
    );

    await screen.findByText(/Not found on PATH/);
  });

  test("the Integrations tab fetches and renders the slack-dm card", async () => {
    mockIPC(
      withDefaults((cmd) => {
        if (cmd === "integrations_list") {
          return {
            integrations: [
              {
                id: "slack-dm",
                name: "Slack DM",
                description: "Agents can monitor your personal Slack DM...",
                configured: true,
                mcpAvailable: false,
                mcpDetail: "no servers configured",
              },
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
        initialTab="integrations"
      />,
    );

    await screen.findByText("Slack DM");
    expect(screen.getByText("Configured")).toBeTruthy();
    expect(screen.getByText(/isn't available to claude/)).toBeTruthy();
    expect(screen.getByText("no servers configured")).toBeTruthy();
  });

  test("creating a scheduled prompt with a notify channel sends it through and shows it in the list", async () => {
    let createPayload: unknown;
    let schedules: Array<{
      id: string;
      agentId: string;
      sessionId: string | null;
      prompt: string;
      cron: string;
      notifyChannel: string | null;
      enabled: boolean;
      createdAt: number;
      lastRunAt: number | null;
      lastRunOk: boolean | null;
    }> = [];
    // Deliberately not withDefaults here -- its blanket schedule_list stub (always `[]`) would
    // shadow the mutable `schedules` this test needs schedule_create to actually affect.
    mockIPC((cmd, payload) => {
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
      if (cmd === "skills_index") return { skills: [] };
      if (cmd === "schedule_list") return { schedules };
      if (cmd === "schedule_create") {
        createPayload = payload;
        schedules = [
          {
            id: "sch-abc1",
            agentId: "ralph",
            sessionId: null,
            prompt: "Summarize open PRs",
            cron: "0 9 * * *",
            notifyChannel: "D0MYDM001",
            enabled: true,
            createdAt: Date.now(),
            lastRunAt: null,
            lastRunOk: null,
          },
        ];
        return { id: "sch-abc1" };
      }
      throw new Error(`unexpected command: ${cmd}`);
    });
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
            tools: [],
            mcp: "none",
            proactiveChecks: [],
          },
        ]}
        initialTab="schedule"
      />,
    );
    await screen.findByText("No scheduled prompts yet.");

    fireEvent.change(screen.getByLabelText("schedule agent"), {
      target: { value: "ralph" },
    });
    fireEvent.change(screen.getByLabelText("schedule prompt"), {
      target: { value: "Summarize open PRs" },
    });
    fireEvent.change(screen.getByLabelText("schedule cron"), {
      target: { value: "0 9 * * *" },
    });
    fireEvent.change(screen.getByLabelText("schedule notify channel"), {
      target: { value: "D0MYDM001" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add schedule" }));

    await waitFor(() =>
      expect(createPayload).toEqual({
        agentId: "ralph",
        prompt: "Summarize open PRs",
        cron: "0 9 * * *",
        notifyChannel: "D0MYDM001",
      }),
    );
    await screen.findByText("D0MYDM001");
  });
});

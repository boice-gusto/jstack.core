import { useEffect, useState } from "react";
import {
  createSchedule,
  daemonStatus,
  deleteSchedule,
  listIntegrations,
  listSchedules,
  recentLogs,
  runDiagnostics,
  setScheduleEnabled,
  skillsIndex,
  updateAgent,
  type AgentSummary,
  type DaemonStatus,
  type DiagnosticsReport,
  type Integration,
  type ScheduledPrompt,
  type SkillSummary,
} from "../lib/agent";
import type { NavigationLayout } from "../lib/navigationLayout";
import { IntegrationCard } from "./IntegrationCard";
import { AVAILABLE_TOOLS, MODELS } from "./Onboarding";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Switch } from "./ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "./ai-elements/model-selector";
import {
  CheckIcon,
  ChevronsUpDownIcon,
  MonitorIcon,
  MoonIcon,
  PanelLeftIcon,
  PanelTopIcon,
  SparkleIcon,
  SunIcon,
  XIcon,
} from "lucide-react";
import {
  THEME_COLORS,
  loadStoredThemeId,
  setStoredThemeId,
  loadStoredThemeMode,
  setStoredThemeMode,
  type ThemeMode,
} from "../lib/theme";

const THEME_MODES: { id: ThemeMode; name: string; icon: typeof SunIcon }[] = [
  { id: "light", name: "Light", icon: SunIcon },
  { id: "dark", name: "Dark", icon: MoonIcon },
  { id: "system", name: "System", icon: MonitorIcon },
];

const NAVIGATION_LAYOUTS: {
  id: NavigationLayout;
  name: string;
  description: string;
  icon: typeof PanelLeftIcon;
}[] = [
  {
    id: "vertical",
    name: "Vertical",
    description: "Agents and sessions grouped in a side panel.",
    icon: PanelLeftIcon,
  },
  {
    id: "horizontal",
    name: "Horizontal",
    description: "Sessions as tabs across the top of the chat.",
    icon: PanelTopIcon,
  },
];

const isMac = typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac");
const MOD = isMac ? "⌘" : "Ctrl";

/** The single source of truth for the Info tab's "Keyboard shortcuts" accordion -- a developer
 * adding a new global shortcut should update this alongside it, same spirit as keeping a
 * CHANGELOG by hand rather than deriving it from commits. */
const SHORTCUTS: { keys: string[]; description: string }[] = [
  { keys: [MOD, "K"], description: "Open search / command palette" },
  { keys: [MOD, "/"], description: "Open Settings' info tab" },
  { keys: ["Enter"], description: "Send message" },
  { keys: ["Shift", "Enter"], description: "New line in message" },
  { keys: ["Esc"], description: "Close a dialog or cancel a rename" },
];

/** How often the debug tab polls logs/recent while it's the active tab. The RPC transport has no
 * push/streaming, so "live" here means "refreshed on this interval," not truly real-time. */
const LOG_POLL_MS = 3000;

export type SettingsTab =
  | "general"
  | "agents"
  | "appearance"
  | "advanced"
  | "schedule"
  | "integrations"
  | "diagnostics"
  | "debug"
  | "info";

/** "2h 14m" / "45m" / "12s" -- coarse on purpose, this is "has the daemon been up a while" not a
 * stopwatch. Drops to the next-smaller unit rather than always showing two, so "12s" doesn't
 * render as "0h 0m". */
function formatUptime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/**
 * Controlled (open/onOpenChange from App.tsx) rather than self-triggering, same pattern as
 * CreateAgentDialog -- it's reached from the header's "more" menu and the command palette, not a
 * dedicated gear button. `activeTab`/`onActiveTabChange` are lifted to App.tsx too, so ⌘/ can open
 * straight to the Info tab's keyboard-shortcuts accordion instead of a separate dialog.
 */
export function SettingsDialog({
  open,
  onOpenChange,
  onRefresh,
  agents,
  agentId,
  onAgentUpdated,
  navigationLayout,
  onNavigationLayoutChange,
  activeTab,
  onActiveTabChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
  /** Undefined until the first agent_list resolves (App.tsx's loading state) -- the model
   * picker just doesn't render yet rather than showing a select with nothing in it. */
  agents?: AgentSummary[];
  agentId?: string;
  onAgentUpdated?: (agent: AgentSummary) => void;
  navigationLayout: NavigationLayout;
  onNavigationLayoutChange: (layout: NavigationLayout) => void;
  activeTab: SettingsTab;
  onActiveTabChange: (tab: SettingsTab) => void;
}) {
  const [status, setStatus] = useState<DaemonStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [logError, setLogError] = useState<string | null>(null);
  const [themeId, setThemeId] = useState(() => loadStoredThemeId());
  const [themeMode, setThemeMode] = useState(() => loadStoredThemeMode());
  const [modelError, setModelError] = useState<string | null>(null);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [agentsError, setAgentsError] = useState<string | null>(null);
  const [skills, setSkills] = useState<SkillSummary[] | null>(null);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<ScheduledPrompt[]>([]);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsReport | null>(null);
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [newScheduleAgentId, setNewScheduleAgentId] = useState("");
  const [newSchedulePrompt, setNewSchedulePrompt] = useState("");
  const [newScheduleCron, setNewScheduleCron] = useState("");
  const [newScheduleNotifyChannel, setNewScheduleNotifyChannel] = useState("");
  const [integrations, setIntegrations] = useState<Integration[] | null>(null);
  const [integrationsError, setIntegrationsError] = useState<string | null>(null);
  const activeAgent = agents?.find((a) => a.id === agentId);

  async function handleModelChange(model: string): Promise<void> {
    if (!activeAgent) return;
    setModelError(null);
    try {
      const { agent } = await updateAgent(activeAgent.id, { model });
      onAgentUpdated?.({ ...agent, id: activeAgent.id });
    } catch (e) {
      console.error(`[jstack] updateAgent(${activeAgent.id}) failed:`, e);
      setModelError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleToolToggle(tool: string): Promise<void> {
    if (!activeAgent) return;
    const next = activeAgent.tools.includes(tool)
      ? activeAgent.tools.filter((t) => t !== tool)
      : [...activeAgent.tools, tool];
    setAccessError(null);
    try {
      const { agent } = await updateAgent(activeAgent.id, { tools: next });
      onAgentUpdated?.({ ...agent, id: activeAgent.id });
    } catch (e) {
      console.error(`[jstack] updateAgent(${activeAgent.id}) failed:`, e);
      setAccessError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleMcpToggle(inherit: boolean): Promise<void> {
    if (!activeAgent) return;
    setAccessError(null);
    try {
      const { agent } = await updateAgent(activeAgent.id, {
        mcp: inherit ? "inherit" : "none",
      });
      onAgentUpdated?.({ ...agent, id: activeAgent.id });
    } catch (e) {
      console.error(`[jstack] updateAgent(${activeAgent.id}) failed:`, e);
      setAccessError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleAgentEnabledToggle(id: string, enabled: boolean): Promise<void> {
    setAgentsError(null);
    try {
      const { agent } = await updateAgent(id, { enabled });
      onAgentUpdated?.({ ...agent, id });
    } catch (e) {
      console.error(`[jstack] updateAgent(${id}) failed:`, e);
      setAgentsError(e instanceof Error ? e.message : String(e));
    }
  }

  // Agents & skills is always-expanded now (no toggle button) -- fetched once as soon as the
  // dialog opens, same trigger as refreshStatus below, rather than waiting for a click.
  useEffect(() => {
    if (!open || skills !== null) return;
    skillsIndex()
      .then((r) => setSkills(r.skills))
      .catch((e) => {
        console.error("[jstack] skillsIndex failed:", e);
        setSkillsError(e instanceof Error ? e.message : String(e));
      });
  }, [open, skills]);

  async function refreshStatus(): Promise<void> {
    try {
      setStatus(await daemonStatus());
      setStatusError(null);
    } catch (e) {
      console.error("[jstack] daemonStatus failed:", e);
      setStatusError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    if (open) refreshStatus();
  }, [open]);

  async function refreshSchedules(): Promise<void> {
    try {
      const { schedules: fetched } = await listSchedules();
      setSchedules(fetched);
      setScheduleError(null);
    } catch (e) {
      console.error("[jstack] listSchedules failed:", e);
      setScheduleError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    if (open) refreshSchedules();
  }, [open]);

  async function handleCreateSchedule(): Promise<void> {
    if (!newScheduleAgentId || !newSchedulePrompt.trim() || !newScheduleCron.trim()) {
      setScheduleError("Pick an agent and fill in both the prompt and cron fields.");
      return;
    }
    setScheduleError(null);
    try {
      await createSchedule(
        newScheduleAgentId,
        newSchedulePrompt.trim(),
        newScheduleCron.trim(),
        newScheduleNotifyChannel.trim() || undefined,
      );
      setNewSchedulePrompt("");
      setNewScheduleCron("");
      setNewScheduleNotifyChannel("");
      await refreshSchedules();
    } catch (e) {
      console.error("[jstack] createSchedule failed:", e);
      setScheduleError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleToggleSchedule(id: string, enabled: boolean): Promise<void> {
    setScheduleError(null);
    try {
      await setScheduleEnabled(id, enabled);
      await refreshSchedules();
    } catch (e) {
      console.error(`[jstack] setScheduleEnabled(${id}) failed:`, e);
      setScheduleError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleDeleteSchedule(id: string): Promise<void> {
    setScheduleError(null);
    try {
      await deleteSchedule(id);
      await refreshSchedules();
    } catch (e) {
      console.error(`[jstack] deleteSchedule(${id}) failed:`, e);
      setScheduleError(e instanceof Error ? e.message : String(e));
    }
  }

  // Polls only while Debug is the actual visible tab -- no point hitting the socket every 3s for
  // a log tail nobody's looking at.
  useEffect(() => {
    if (!open || activeTab !== "debug") return;
    let cancelled = false;
    const poll = async (): Promise<void> => {
      try {
        const { lines } = await recentLogs();
        if (!cancelled) {
          setLogLines(lines);
          setLogError(null);
        }
      } catch (e) {
        console.error("[jstack] recentLogs failed:", e);
        if (!cancelled) setLogError(e instanceof Error ? e.message : String(e));
      }
    };
    poll();
    const interval = setInterval(poll, LOG_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [open, activeTab]);

  async function refreshDiagnostics(): Promise<void> {
    setDiagnosticsLoading(true);
    try {
      setDiagnostics(await runDiagnostics());
      setDiagnosticsError(null);
    } catch (e) {
      console.error("[jstack] runDiagnostics failed:", e);
      setDiagnosticsError(e instanceof Error ? e.message : String(e));
    } finally {
      setDiagnosticsLoading(false);
    }
  }

  // Fetched once when Diagnostics becomes the visible tab (not polled -- these are point-in-time
  // checks, e.g. "is claude on PATH right now," not a live stream), plus whenever "Re-run" is
  // clicked. Deliberately keyed only on [open, activeTab]: including diagnostics/diagnosticsLoading
  // would re-fire this effect the moment refreshDiagnostics's own setState calls land, since
  // they're read (not just set) here as a "don't double-fetch" guard.
  useEffect(() => {
    if (open && activeTab === "diagnostics" && diagnostics === null && !diagnosticsLoading) {
      refreshDiagnostics();
    }
  }, [open, activeTab]);

  // Same "fetch once when the tab becomes visible" reasoning as Diagnostics -- checking MCP
  // availability shells out to `claude mcp list`, not worth doing on every dialog open.
  useEffect(() => {
    if (!(open && activeTab === "integrations" && integrations === null)) return;
    listIntegrations()
      .then((r) => {
        setIntegrations(r.integrations);
        setIntegrationsError(null);
      })
      .catch((e) => {
        console.error("[jstack] listIntegrations failed:", e);
        setIntegrationsError(e instanceof Error ? e.message : String(e));
      });
  }, [open, activeTab]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Fixed size regardless of which tab is active -- Schedule's content is much taller than
          General's, and letting the dialog grow/shrink per tab made switching tabs visually jump
          around. Each TabsContent scrolls internally (overflow-y-auto) instead. */}
      <DialogContent className="flex h-[640px] max-h-[85vh] w-[640px] max-w-[90vw] flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => onActiveTabChange(v as SettingsTab)}
          className="flex-1 overflow-hidden"
        >
          <TabsList className="w-full">
            <TabsTrigger value="general" className="flex-1">
              General
            </TabsTrigger>
            <TabsTrigger value="agents" className="flex-1">
              Agents
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex-1">
              Appearance
            </TabsTrigger>
            <TabsTrigger value="advanced" className="flex-1">
              Advanced
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex-1">
              Schedule
            </TabsTrigger>
            <TabsTrigger value="integrations" className="flex-1">
              Integrations
            </TabsTrigger>
            <TabsTrigger value="diagnostics" className="flex-1">
              Diagnostics
            </TabsTrigger>
            <TabsTrigger value="debug" className="flex-1">
              Debug
            </TabsTrigger>
            <TabsTrigger value="info" className="flex-1">
              Info
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="flex h-full flex-col gap-4 overflow-y-auto pt-2">
            {activeAgent && (
              <div aria-label="model">
                <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                  Model ({activeAgent.name})
                </h3>
                <ModelSelector open={modelPickerOpen} onOpenChange={setModelPickerOpen}>
                  <ModelSelectorTrigger
                    render={
                      <Button type="button" variant="outline" className="w-full justify-between">
                        <span className="flex items-center gap-2">
                          <SparkleIcon className="size-3.5 text-muted-foreground" />
                          <ModelSelectorName>{activeAgent.model}</ModelSelectorName>
                        </span>
                        <ChevronsUpDownIcon className="size-4 opacity-50" />
                      </Button>
                    }
                  />
                  <ModelSelectorContent title="Choose a model">
                    <ModelSelectorInput placeholder="Search models..." />
                    <ModelSelectorList>
                      <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                      <ModelSelectorGroup heading="Claude">
                        {MODELS.map((m) => (
                          <ModelSelectorItem
                            key={m}
                            value={m}
                            onSelect={() => {
                              handleModelChange(m);
                              setModelPickerOpen(false);
                            }}
                          >
                            <SparkleIcon className="size-3.5 text-muted-foreground" />
                            <ModelSelectorName>{m}</ModelSelectorName>
                            {activeAgent.model === m && <CheckIcon className="size-4" />}
                          </ModelSelectorItem>
                        ))}
                      </ModelSelectorGroup>
                    </ModelSelectorList>
                  </ModelSelectorContent>
                </ModelSelector>
                {modelError && <p className="mt-1 text-sm text-destructive">{modelError}</p>}
              </div>
            )}

            {activeAgent && (
              <div aria-label="access">
                <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                  Access ({activeAgent.name})
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_TOOLS.map((tool) => (
                    <label key={tool} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={activeAgent.tools.includes(tool)}
                        onCheckedChange={() => handleToolToggle(tool)}
                      />
                      {tool}
                    </label>
                  ))}
                </div>
                <label className="mt-2 flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={activeAgent.mcp === "inherit"}
                    onCheckedChange={(checked) => handleMcpToggle(checked === true)}
                  />
                  <span>
                    Inherit MCP servers
                    <span className="block text-xs text-muted-foreground">
                      Gives this agent your configured MCP tools instead of none. Bash stays
                      disallowed and skills stay disabled either way -- that boundary isn't
                      editable here.
                    </span>
                  </span>
                </label>
                {accessError && <p className="mt-1 text-sm text-destructive">{accessError}</p>}
              </div>
            )}
          </TabsContent>

          <TabsContent value="agents" className="flex h-full flex-col gap-3 overflow-y-auto pt-2">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground">Agents</h3>
              <p className="text-xs text-muted-foreground">
                A disabled agent won't be offered when starting a new chat, but its existing
                sessions and history stay exactly as they are.
              </p>
            </div>
            {agentsError && <p className="text-sm text-destructive">{agentsError}</p>}
            <ul className="flex flex-col gap-1.5">
              {(agents ?? []).map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-md border p-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium">{a.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{a.model}</span>
                    {!a.enabled && (
                      <span className="shrink-0 text-xs text-muted-foreground">(disabled)</span>
                    )}
                  </div>
                  <Switch
                    checked={a.enabled}
                    onCheckedChange={(checked) => handleAgentEnabledToggle(a.id, checked)}
                  />
                </li>
              ))}
              {(agents ?? []).length === 0 && (
                <li className="text-sm text-muted-foreground">No agents yet.</li>
              )}
            </ul>
          </TabsContent>

          <TabsContent value="appearance" className="flex h-full flex-col gap-4 overflow-y-auto pt-2">
            <div aria-label="theme">
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Theme</h3>
              <div className="flex gap-2">
                {THEME_MODES.map((m) => (
                  <Button
                    key={m.id}
                    type="button"
                    variant={themeMode === m.id ? "secondary" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setThemeMode(m.id);
                      setStoredThemeMode(m.id);
                    }}
                  >
                    <m.icon className="size-3.5" />
                    {m.name}
                  </Button>
                ))}
              </div>
            </div>

            <div aria-label="accent color">
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Accent color</h3>
              <div className="flex flex-wrap gap-2">
                {THEME_COLORS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    title={t.name}
                    onClick={() => {
                      setThemeId(t.id);
                      setStoredThemeId(t.id);
                    }}
                    className="flex size-7 items-center justify-center rounded-full ring-1 ring-foreground/10"
                    style={{ backgroundColor: t.swatch }}
                  >
                    {themeId === t.id && <CheckIcon className="size-3.5 text-white" />}
                  </button>
                ))}
              </div>
            </div>

            <div aria-label="navigation layout">
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                Chat navigation
              </h3>
              <div className="flex flex-col gap-2">
                {NAVIGATION_LAYOUTS.map((l) => (
                  <Button
                    key={l.id}
                    type="button"
                    variant={navigationLayout === l.id ? "secondary" : "outline"}
                    className="h-auto w-full justify-start gap-3 py-2 text-left"
                    onClick={() => onNavigationLayoutChange(l.id)}
                  >
                    <l.icon className="size-4 shrink-0" />
                    <span className="flex flex-col">
                      <span className="text-sm font-medium">{l.name}</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {l.description}
                      </span>
                    </span>
                    {navigationLayout === l.id && (
                      <CheckIcon className="ml-auto size-4 shrink-0" />
                    )}
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="flex h-full flex-col gap-5 overflow-y-auto pt-2">
            <div aria-label="loaded">
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                Agents &amp; skills
              </h3>
              <div className="flex flex-col gap-3">
                <div>
                  <h4 className="mb-1 text-xs font-semibold text-muted-foreground">
                    Agents ({agents?.length ?? 0})
                  </h4>
                  <ul className="max-h-32 overflow-y-auto rounded-md bg-muted p-2 text-xs">
                    {(agents ?? []).map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-2 py-0.5">
                        <span className="truncate">{a.name}</span>
                        <span className="shrink-0 text-muted-foreground">{a.model}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="mb-1 text-xs font-semibold text-muted-foreground">
                    Skills installed ({skills?.length ?? "..."})
                  </h4>
                  <p className="mb-1 text-xs text-muted-foreground">
                    Read-only -- crew agents run with skills disabled entirely (a deliberate
                    security boundary), so this is "what's on disk," not "what an agent can use."
                  </p>
                  {skillsError && <p className="mb-1 text-xs text-destructive">{skillsError}</p>}
                  <ul className="max-h-40 overflow-y-auto rounded-md bg-muted p-2 font-mono text-xs">
                    {(skills ?? []).map((s) => (
                      <li key={s.rel} title={s.description} className="truncate py-0.5">
                        {s.name}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="schedule" className="flex h-full flex-col gap-5 overflow-y-auto pt-2">
            <div aria-label="daemon status">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground">Daemon</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    refreshStatus();
                    refreshSchedules();
                    onRefresh();
                  }}
                >
                  Refresh
                </Button>
              </div>
              {statusError && <p className="mb-2 text-sm text-destructive">{statusError}</p>}
              {status && (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-md border bg-muted/30 p-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Resident</dt>
                    <dd className="font-medium">{status.resident ? "Yes" : "No"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Uptime</dt>
                    <dd className="font-medium">{formatUptime(status.uptimeMs)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Mode</dt>
                    <dd className="font-medium">{status.mode}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Spent today</dt>
                    <dd className="font-medium">${status.spentToday.toFixed(4)}</dd>
                  </div>
                </dl>
              )}
            </div>

            <div aria-label="per-agent stats">
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                Per-agent activity
              </h3>
              {status && status.perAgent.length > 0 ? (
                <ul className="flex flex-col gap-1 rounded-md border bg-muted/30 p-2 text-sm">
                  {status.perAgent.map((a) => {
                    const name = agents?.find((ag) => ag.id === a.agentId)?.name ?? a.agentId;
                    return (
                      <li key={a.agentId} className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {a.tasks} session{a.tasks === 1 ? "" : "s"} · {a.turns} turn
                          {a.turns === 1 ? "" : "s"} · ${a.costUsd.toFixed(4)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              )}
            </div>

            <div aria-label="slack proactive checks">
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                Slack proactive checks
              </h3>
              <p className="mb-2 text-xs text-muted-foreground">
                Read-only -- these run on a cron against a fixed Slack channel and are managed via{" "}
                <code className="rounded bg-muted px-1 py-0.5">
                  jstackc crew agents edit --proactive-check
                </code>
                , not from this app.
              </p>
              {(() => {
                // proactiveChecks can be missing at runtime if the desktop app was updated
                // before the resident daemon was rebuilt to match (they're deployed
                // separately) -- `?? []` keeps that version skew from crashing the whole
                // app instead of just showing an empty list here.
                const allChecks = (agents ?? []).flatMap((a) =>
                  (a.proactiveChecks ?? []).map((c) => ({ agent: a, check: c })),
                );
                return allChecks.length > 0 ? (
                  <ul className="flex flex-col gap-1.5">
                    {allChecks.map(({ agent, check }) => (
                      <li
                        key={`${agent.id}:${check.id}`}
                        className="rounded-md border p-2 text-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">
                            {agent.name} · {check.id}
                          </span>
                          <code className="shrink-0 text-xs text-muted-foreground">
                            {check.schedule}
                          </code>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {check.prompt}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">None configured.</p>
                );
              })()}
            </div>

            <div aria-label="scheduled prompts">
              <h3 className="mb-1 text-sm font-semibold text-muted-foreground">
                Scheduled prompts
              </h3>
              <p className="mb-2 text-xs text-muted-foreground">
                Re-runs a message against an agent on a cron interval, resuming the same session
                each time so it keeps context across runs.
              </p>
              {scheduleError && <p className="mb-2 text-sm text-destructive">{scheduleError}</p>}
              <div className="mb-3 flex flex-col gap-2 rounded-md border p-2">
                <select
                  aria-label="schedule agent"
                  value={newScheduleAgentId}
                  onChange={(e) => setNewScheduleAgentId(e.target.value)}
                  className="h-8 rounded-md border bg-background px-2 text-sm"
                >
                  <option value="">Select an agent...</option>
                  {(agents ?? []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <textarea
                  aria-label="schedule prompt"
                  placeholder="Prompt to send each time..."
                  value={newSchedulePrompt}
                  onChange={(e) => setNewSchedulePrompt(e.target.value)}
                  className="min-h-16 rounded-md border bg-background p-2 text-sm"
                />
                <input
                  aria-label="schedule cron"
                  placeholder="Cron expression, e.g. 0 9 * * *"
                  value={newScheduleCron}
                  onChange={(e) => setNewScheduleCron(e.target.value)}
                  className="h-8 rounded-md border bg-background px-2 font-mono text-sm"
                />
                <input
                  aria-label="schedule notify channel"
                  placeholder="Notify via Slack DM (channel id, optional)"
                  value={newScheduleNotifyChannel}
                  onChange={(e) => setNewScheduleNotifyChannel(e.target.value)}
                  className="h-8 rounded-md border bg-background px-2 font-mono text-sm"
                />
                <Button type="button" size="sm" onClick={handleCreateSchedule}>
                  Add schedule
                </Button>
              </div>
              <ul className="flex flex-col gap-1.5">
                {schedules.map((s) => {
                  const name = agents?.find((a) => a.id === s.agentId)?.name ?? s.agentId;
                  return (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{name}</span>
                          <code className="shrink-0 text-xs text-muted-foreground">{s.cron}</code>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{s.prompt}</p>
                        {s.lastRunAt && (
                          <p className="text-xs text-muted-foreground">
                            Last ran {new Date(s.lastRunAt).toLocaleString()} ·{" "}
                            {s.lastRunOk ? "ok" : "failed"}
                          </p>
                        )}
                        {s.notifyChannel && (
                          <p className="text-xs text-muted-foreground">
                            Notifies Slack: <code>{s.notifyChannel}</code>
                          </p>
                        )}
                      </div>
                      <Switch
                        checked={s.enabled}
                        onCheckedChange={(checked) => handleToggleSchedule(s.id, checked)}
                      />
                      <Button
                        type="button"
                        variant="icon"
                        size="icon"
                        title="Delete schedule"
                        onClick={() => handleDeleteSchedule(s.id)}
                      >
                        <XIcon className="size-4" />
                      </Button>
                    </li>
                  );
                })}
                {schedules.length === 0 && (
                  <li className="text-sm text-muted-foreground">No scheduled prompts yet.</li>
                )}
              </ul>
            </div>
          </TabsContent>

          <TabsContent
            value="integrations"
            className="flex h-full flex-col gap-3 overflow-y-auto pt-2"
          >
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground">Integrations</h3>
              <p className="text-xs text-muted-foreground">
                External things jstack can push to or read from, beyond an agent's own tools.
              </p>
            </div>
            {integrationsError && (
              <p className="text-sm text-destructive">{integrationsError}</p>
            )}
            {integrations?.map((i) => (
              <IntegrationCard key={i.id} integration={i}>
                {i.id === "slack-dm" && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Set a channel id when creating a scheduled prompt (Schedule tab) to have its
                    result pushed here automatically.
                  </p>
                )}
              </IntegrationCard>
            ))}
          </TabsContent>

          <TabsContent
            value="diagnostics"
            className="flex h-full flex-col gap-4 overflow-y-auto pt-2"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground">Diagnostics</h3>
                <p className="text-xs text-muted-foreground">
                  Point-in-time checks for "why isn't this working" -- re-run after fixing
                  something rather than trusting a stale result.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={refreshDiagnostics}
                disabled={diagnosticsLoading}
              >
                {diagnosticsLoading ? "Running..." : "Re-run"}
              </Button>
            </div>
            {diagnosticsError && (
              <p className="text-sm text-destructive">{diagnosticsError}</p>
            )}
            {diagnostics && (
              <div className="flex flex-col gap-4 text-sm">
                <div>
                  <h4 className="mb-1 text-xs font-semibold text-muted-foreground">Claude CLI</h4>
                  <div className="flex items-start gap-2 rounded-md border p-2">
                    {diagnostics.claudeCli.found ? (
                      <CheckIcon className="mt-0.5 size-4 shrink-0 text-green-600 dark:text-green-500" />
                    ) : (
                      <XIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
                    )}
                    <div className="min-w-0">
                      {diagnostics.claudeCli.found ? (
                        <>
                          <p className="font-medium">{diagnostics.claudeCli.version ?? "found"}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {diagnostics.claudeCli.path}
                          </p>
                        </>
                      ) : (
                        <p>
                          Not found on PATH -- the daemon can't run any agent turns until{" "}
                          <code className="rounded bg-muted px-1 py-0.5">claude</code> is
                          installed and reachable.
                        </p>
                      )}
                      {diagnostics.claudeCli.error && (
                        <p className="mt-1 text-xs text-destructive">
                          {diagnostics.claudeCli.error}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="mb-1 text-xs font-semibold text-muted-foreground">Roots</h4>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-start gap-2 rounded-md border p-2">
                      {diagnostics.projectRoot.hasConfig ? (
                        <CheckIcon className="mt-0.5 size-4 shrink-0 text-green-600 dark:text-green-500" />
                      ) : (
                        <XIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium">Project root</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {diagnostics.projectRoot.path}
                        </p>
                        {!diagnostics.projectRoot.hasConfig && (
                          <p className="text-xs text-destructive">
                            No jstack.config.json found here.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start gap-2 rounded-md border p-2">
                      {diagnostics.pluginRoot.hasSkillsDir ? (
                        <CheckIcon className="mt-0.5 size-4 shrink-0 text-green-600 dark:text-green-500" />
                      ) : (
                        <XIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium">Plugin root</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {diagnostics.pluginRoot.path}
                        </p>
                        {!diagnostics.pluginRoot.hasSkillsDir && (
                          <p className="text-xs text-destructive">No skills/ directory found here.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="mb-1 text-xs font-semibold text-muted-foreground">Skills</h4>
                  <div className="flex items-start gap-2 rounded-md border p-2">
                    {diagnostics.skills.error ? (
                      <XIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
                    ) : (
                      <CheckIcon className="mt-0.5 size-4 shrink-0 text-green-600 dark:text-green-500" />
                    )}
                    <p>
                      {diagnostics.skills.error
                        ? diagnostics.skills.error
                        : `${diagnostics.skills.count} skill${diagnostics.skills.count === 1 ? "" : "s"} loaded`}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="mb-1 text-xs font-semibold text-muted-foreground">
                    Agent workspaces
                  </h4>
                  <ul className="flex flex-col gap-1.5">
                    {diagnostics.agents.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-start gap-2 rounded-md border p-2"
                      >
                        {a.workspaceExists ? (
                          <CheckIcon className="mt-0.5 size-4 shrink-0 text-green-600 dark:text-green-500" />
                        ) : (
                          <XIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium">
                            {a.id}
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              {a.mcp === "inherit" ? "mcp: inherit" : "mcp: none"}
                            </span>
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{a.workspace}</p>
                          {!a.workspaceExists && (
                            <p className="text-xs text-destructive">
                              Workspace directory does not exist.
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {diagnostics.mcp.anyAgentInherits && (
                  <div>
                    <h4 className="mb-1 text-xs font-semibold text-muted-foreground">MCP</h4>
                    <div className="flex items-start gap-2 rounded-md border p-2">
                      {diagnostics.mcp.claudeMcpListOk ? (
                        <CheckIcon className="mt-0.5 size-4 shrink-0 text-green-600 dark:text-green-500" />
                      ) : (
                        <XIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium">
                          {diagnostics.mcp.claudeMcpListOk ? "claude mcp list succeeded" : "claude mcp list failed"}
                        </p>
                        {diagnostics.mcp.claudeMcpListDetail && (
                          <pre className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap rounded bg-muted p-1.5 font-mono text-xs">
                            {diagnostics.mcp.claudeMcpListDetail}
                          </pre>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="debug" className="flex h-full flex-col gap-2 overflow-y-auto pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground">Debug logs</h3>
              <span className="text-xs text-muted-foreground">
                {logLines.length} line{logLines.length === 1 ? "" : "s"} · refreshes every{" "}
                {LOG_POLL_MS / 1000}s
              </span>
            </div>
            {logError && <p className="text-sm text-destructive">{logError}</p>}
            <div className="max-h-96 overflow-y-auto rounded-md border bg-muted/30 font-mono text-xs">
              {logLines.length === 0 ? (
                <p className="p-3 text-muted-foreground">No log lines yet.</p>
              ) : (
                logLines.map((line, i) => {
                  const isError = /\berror\b/i.test(line);
                  const isWarn = !isError && /\bwarn(ing)?\b/i.test(line);
                  return (
                    <div
                      key={i}
                      className={`border-b border-border/50 px-3 py-1.5 break-all last:border-b-0 ${
                        isError
                          ? "bg-destructive/10 text-destructive"
                          : isWarn
                            ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                            : i % 2 === 0
                              ? "bg-transparent"
                              : "bg-foreground/[0.02]"
                      }`}
                    >
                      {line}
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>

          <TabsContent value="info" className="h-full overflow-y-auto pt-2">
            <Accordion defaultValue={["shortcuts"]}>
              <AccordionItem value="shortcuts">
                <AccordionTrigger>Keyboard shortcuts</AccordionTrigger>
                <AccordionContent>
                  <ul className="flex flex-col gap-2">
                    {SHORTCUTS.map((s) => (
                      <li
                        key={s.description}
                        className="flex items-center justify-between gap-4 text-sm"
                      >
                        <span className="text-muted-foreground">{s.description}</span>
                        <span className="flex shrink-0 gap-1">
                          {s.keys.map((k) => (
                            <kbd
                              key={k}
                              className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs"
                            >
                              {k}
                            </kbd>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState, type ReactNode } from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "./ui/command";
import type { AgentSummary, SessionSummary } from "../lib/agent";
import { setStoredThemeMode } from "../lib/theme";
import {
  MessageCircleIcon,
  MonitorIcon,
  MoonIcon,
  PanelLeftIcon,
  PlusIcon,
  SettingsIcon,
  SunIcon,
  UserIcon,
} from "lucide-react";

/**
 * The Spotlight/Finder-style "search everything" entry point (⌘K, or the icon-only search
 * button next to the header's "..." menu) -- jumps to a chat or agent, or runs a handful of
 * app-level commands. `shouldFilter={false}` on `<Command>` because filtering is done here
 * instead of cmdk's own fuzzy match: that's what makes slash-command mode possible (see below).
 */
export function CommandPalette({
  open,
  onOpenChange,
  agents,
  sessions,
  sessionNames,
  onSwitchSession,
  onSwitchAgent,
  onNewChat,
  onNewAgent,
  onOpenSettings,
  onToggleSidebar,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: AgentSummary[];
  sessions: SessionSummary[];
  sessionNames: Record<string, string>;
  onSwitchSession: (s: SessionSummary) => void;
  onSwitchAgent: (id: string) => void;
  onNewChat: () => void;
  onNewAgent: () => void;
  onOpenSettings: () => void;
  onToggleSidebar: () => void;
}) {
  const [query, setQuery] = useState("");
  // Starts fresh every time it's reopened -- a stale query (or stale slash-mode) left over from
  // the last time this closed would be confusing, not a feature.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  function run(action: () => void): void {
    onOpenChange(false);
    action();
  }

  // Typing "/" first narrows to just Actions (app-level commands), the same convention Slack/
  // Notion/Linear use for "I know I want to run something, not search my chats." Plain typing
  // (no leading "/") still searches everything, same as before.
  const isSlashCommand = query.startsWith("/");
  const q = (isSlashCommand ? query.slice(1) : query).trim().toLowerCase();
  const matches = (value: string): boolean => q.length === 0 || value.toLowerCase().includes(q);

  const filteredSessions = isSlashCommand
    ? []
    : sessions.filter((s) => matches(`${sessionNames[s.id] ?? ""} ${s.id}`));
  const filteredAgents = isSlashCommand ? [] : agents.filter((a) => matches(a.name));

  const actions: { value: string; label: string; icon: ReactNode; onSelect: () => void }[] = [
    { value: "new chat", label: "New chat", icon: <PlusIcon />, onSelect: () => run(onNewChat) },
    { value: "new agent", label: "New agent", icon: <UserIcon />, onSelect: () => run(onNewAgent) },
    {
      value: "settings",
      label: "Settings",
      icon: <SettingsIcon />,
      onSelect: () => run(onOpenSettings),
    },
    {
      value: "toggle collapse expand sidebar",
      label: "Toggle sidebar",
      icon: <PanelLeftIcon />,
      onSelect: () => run(onToggleSidebar),
    },
    {
      value: "theme light mode appearance",
      label: "Light mode",
      icon: <SunIcon />,
      onSelect: () => run(() => setStoredThemeMode("light")),
    },
    {
      value: "theme dark mode appearance",
      label: "Dark mode",
      icon: <MoonIcon />,
      onSelect: () => run(() => setStoredThemeMode("dark")),
    },
    {
      value: "theme system mode appearance",
      label: "Match system theme",
      icon: <MonitorIcon />,
      onSelect: () => run(() => setStoredThemeMode("system")),
    },
  ];
  const filteredActions = actions.filter((a) => matches(a.value));

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command palette"
      description="Jump to a chat, switch agents, or run a command. Start with / to jump straight to commands."
    >
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="Search chats, agents, settings... (try /)"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {filteredSessions.length > 0 && (
            <CommandGroup heading="Chats">
              {filteredSessions.map((s) => (
                <CommandItem
                  key={s.id}
                  value={`${sessionNames[s.id] ?? ""} ${s.id}`}
                  onSelect={() => run(() => onSwitchSession(s))}
                >
                  <MessageCircleIcon />
                  {sessionNames[s.id] ?? s.id}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {filteredAgents.length > 0 && (
            <CommandGroup heading="Agents">
              {filteredAgents.map((a) => (
                <CommandItem
                  key={a.id}
                  value={a.name}
                  onSelect={() => run(() => onSwitchAgent(a.id))}
                >
                  <UserIcon />
                  {a.name}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {filteredActions.length > 0 && (
            <>
              {!isSlashCommand && <CommandSeparator />}
              <CommandGroup heading="Actions">
                {filteredActions.map((a) => (
                  <CommandItem key={a.value} value={a.value} onSelect={a.onSelect}>
                    {a.icon}
                    {a.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
